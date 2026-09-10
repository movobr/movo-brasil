import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { Tenant } from '../../src/domain/tenant.js';
import { RIDE_PERMISSIONS, RideOrchestrator } from '../../src/application/ride-orchestrator.js';
import type { ActorContext } from '../../src/domain/authorization.js';
import { PaymentService } from '../../src/application/payment-service.js';
import {
  InMemoryAuditEventRepository,
  InMemoryRideRepository,
  InMemoryTenantRepository,
} from '../../src/infrastructure/memory/repositories.js';
import { InMemoryLedgerStore, InMemoryPaymentStore } from '../../src/infrastructure/memory/payments.js';
import { FakePaymentProvider } from '../helpers/fake-payment-provider.js';
import { FakeMapsProvider, InMemoryEventCollector } from '../helpers/fakes.js';

const NOW = new Date('2026-09-09T12:00:00.000Z');

async function activeTenant(tenants: InMemoryTenantRepository, slug: string) {
  const tenant = Tenant.provision({ id: slug, slug, name: slug, now: NOW });
  tenant.transitionTo('CONFIGURING', NOW);
  tenant.transitionTo('PENDING_ACTIVATION', NOW);
  tenant.transitionTo('ACTIVE', NOW);
  await tenants.save(tenant);
  return tenant;
}

function setup() {
  const tenants = new InMemoryTenantRepository();
  const rides = new InMemoryRideRepository();
  const audits = new InMemoryAuditEventRepository();
  const events = new InMemoryEventCollector();
  const maps = new FakeMapsProvider();
  const provider = new FakePaymentProvider();
  const paymentStore = new InMemoryPaymentStore();
  const ledger = new InMemoryLedgerStore();
  const payments = new PaymentService(provider, paymentStore, ledger, { now: () => NOW }, randomUUID);
  const orchestrator = new RideOrchestrator(tenants, rides, audits, events, maps, payments, { now: () => NOW }, randomUUID);
  return { tenants, rides, audits, events, payments, orchestrator };
}

function actor(overrides: Partial<ActorContext>): ActorContext {
  return { userId: 'pax-1', tenantId: 'tenant-a', permissions: [], correlationId: 'corr-1', ...overrides };
}

describe('ride orchestration end-to-end (42)', () => {
  it('runs the Pix journey: request -> paid -> match -> accept -> complete', async () => {
    const { tenants, events, payments, orchestrator } = setup();
    await activeTenant(tenants, 'tenant-a');
    const passenger = actor({ permissions: [RIDE_PERMISSIONS.rideRequest] });
    const operator = actor({ userId: 'op-1', permissions: [RIDE_PERMISSIONS.rideDispatch] });
    const driver = actor({ userId: 'driver-1', permissions: [RIDE_PERMISSIONS.rideAccept] });

    const { ride, quote, paymentId } = await orchestrator.requestRide(passenger, {
      origin: 'orig-a',
      destination: 'dest-b',
      category: 'car',
      paymentMethod: 'pix',
    });
    expect(quote.total.amountMinor).toBe(2800);
    expect(paymentId).not.toBeNull();
    expect(ride.status).toBe('REQUESTED');
    expect(ride.routeDistanceMeters).toBe(10000);
    expect(ride.routeDurationSeconds).toBe(1200);

    await expect(orchestrator.startMatching(operator, ride.id)).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    const intents = await payments.findIntentsByRide(ride.id);
    await payments.handleWebhook(intents[0]!.id, '{}', {}, { eventId: 'evt-pay', providerStatus: 'paid' });

    await orchestrator.startMatching(operator, ride.id);
    await orchestrator.acceptOffer(driver, ride.id, 'driver-1');
    await orchestrator.advanceRide(operator, ride.id, 'DRIVER_ARRIVING', 'system');
    await orchestrator.advanceRide(operator, ride.id, 'DRIVER_ARRIVED', 'location-rule');
    await orchestrator.advanceRide(operator, ride.id, 'IN_PROGRESS', 'driver-start');
    const done = await orchestrator.advanceRide(operator, ride.id, 'COMPLETED', 'driver-completion');
    expect(done.status).toBe('COMPLETED');

    const types = events.types();
    for (const expected of ['ride.requested.v1', 'ride.matching.v1', 'ride.driver_assigned.v1', 'ride.started.v1', 'ride.completed.v1']) {
      expect(types).toContain(expected);
    }
    for (const event of events.events) {
      expect(event.version).toBe(1);
      expect(event.tenantId).toBe('tenant-a');
      expect(event.correlationId).toBe('corr-1');
      expect(event.eventId.length).toBeGreaterThan(0);
    }
  });

  it('lets card rides match without upfront payment', async () => {
    const { tenants, orchestrator } = setup();
    await activeTenant(tenants, 'tenant-a');
    const passenger = actor({ permissions: [RIDE_PERMISSIONS.rideRequest] });
    const operator = actor({ userId: 'op-1', permissions: [RIDE_PERMISSIONS.rideDispatch] });
    const { ride, paymentId } = await orchestrator.requestRide(passenger, {
      origin: 'orig-a',
      destination: 'dest-b',
      category: 'motorcycle',
      paymentMethod: 'card',
    });
    expect(paymentId).toBeNull();
    await orchestrator.startMatching(operator, ride.id);
  });

  it('refuses new rides for non-ACTIVE tenants', async () => {
    const { tenants, orchestrator } = setup();
    const tenant = Tenant.provision({ id: 'tenant-b', slug: 'tenant-b', name: 'B', now: NOW });
    tenant.transitionTo('CONFIGURING', NOW);
    await tenants.save(tenant);
    const passenger = actor({ tenantId: 'tenant-b', permissions: [RIDE_PERMISSIONS.rideRequest] });
    await expect(
      orchestrator.requestRide(passenger, { origin: 'a', destination: 'b', category: 'car', paymentMethod: 'card' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('denies cross-tenant acceptance', async () => {
    const { tenants, orchestrator } = setup();
    await activeTenant(tenants, 'tenant-a');
    const passenger = actor({ permissions: [RIDE_PERMISSIONS.rideRequest] });
    const { ride } = await orchestrator.requestRide(passenger, {
      origin: 'orig-a',
      destination: 'dest-b',
      category: 'car',
      paymentMethod: 'card',
    });
    const foreignDriver = actor({ userId: 'driver-x', tenantId: 'tenant-b', permissions: [RIDE_PERMISSIONS.rideAccept] });
    await expect(orchestrator.acceptOffer(foreignDriver, ride.id, 'driver-x')).rejects.toMatchObject({
      code: 'CROSS_TENANT_DENIED',
    });
  });
});
