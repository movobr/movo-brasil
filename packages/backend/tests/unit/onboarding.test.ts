import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../../src/domain/errors.js';
import { DriverProfile } from '../../src/domain/driver-profile.js';
import { DRIVER_PERMISSIONS, OnboardingService } from '../../src/application/onboarding-service.js';
import type { ActorContext } from '../../src/domain/authorization.js';
import { RIDE_PERMISSIONS, RideOrchestrator } from '../../src/application/ride-orchestrator.js';
import { Tenant } from '../../src/domain/tenant.js';
import {
  InMemoryAuditEventRepository,
  InMemoryRideRepository,
  InMemoryTenantRepository,
} from '../../src/infrastructure/memory/repositories.js';
import { InMemoryLedgerStore, InMemoryPaymentStore } from '../../src/infrastructure/memory/payments.js';
import {
  InMemoryDriverProfileRepository,
  InMemoryPassengerProfileRepository,
  InMemoryVehicleRepository,
} from '../../src/infrastructure/memory/onboarding.js';
import { PaymentService } from '../../src/application/payment-service.js';
import { FakePaymentProvider } from '../helpers/fake-payment-provider.js';
import { FakeMapsProvider, InMemoryEventCollector } from '../helpers/fakes.js';

const NOW = new Date('2026-09-09T12:00:00.000Z');

function admin(): ActorContext {
  return {
    userId: 'admin-a',
    tenantId: 'tenant-a',
    permissions: [DRIVER_PERMISSIONS.driverManage, DRIVER_PERMISSIONS.driverRead, RIDE_PERMISSIONS.rideRequest, RIDE_PERMISSIONS.rideDispatch, RIDE_PERMISSIONS.rideAccept],
    correlationId: 'corr-1',
  };
}

function setup() {
  const drivers = new InMemoryDriverProfileRepository();
  const passengers = new InMemoryPassengerProfileRepository();
  const vehicles = new InMemoryVehicleRepository();
  const audits = new InMemoryAuditEventRepository();
  const service = new OnboardingService(drivers, passengers, vehicles, audits, { now: () => NOW }, randomUUID);
  return { drivers, passengers, vehicles, audits, service };
}

describe('driver verification lifecycle (58)', () => {
  it('walks APPLICATION to APPROVED', () => {
    const profile = DriverProfile.register({ id: 'd-1', tenantId: 't-a', userId: 'u-1', status: 'ACTIVE', now: NOW });
    expect(profile.canReceiveOffers()).toBe(false);
    profile.transitionVerification('DOCUMENT_REVIEW', NOW);
    profile.transitionVerification('VERIFICATION', NOW);
    profile.transitionVerification('APPROVED', NOW);
    profile.setAvailable(true);
    expect(profile.canReceiveOffers()).toBe(true);
  });

  it('rejects skips and terminal exits deterministically', () => {
    const profile = DriverProfile.register({ id: 'd-1', tenantId: 't-a', userId: 'u-1', status: 'ACTIVE', now: NOW });
    expect(() => profile.transitionVerification('APPROVED', NOW)).toThrowError(DomainError);
    profile.transitionVerification('DOCUMENT_REVIEW', NOW);
    profile.transitionVerification('VERIFICATION', NOW);
    profile.transitionVerification('REJECTED', NOW);
    expect(() => profile.transitionVerification('APPROVED', NOW)).toThrowError(DomainError);
  });

  it('blocks availability before approval and suspends from approved', () => {
    const profile = DriverProfile.register({ id: 'd-1', tenantId: 't-a', userId: 'u-1', status: 'ACTIVE', now: NOW });
    expect(() => profile.setAvailable(true)).toThrowError(DomainError);
    profile.transitionVerification('DOCUMENT_REVIEW', NOW);
    profile.transitionVerification('VERIFICATION', NOW);
    profile.transitionVerification('APPROVED', NOW);
    profile.setAvailable(true);
    profile.transitionVerification('SUSPENDED', NOW);
    expect(profile.canReceiveOffers()).toBe(false);
  });
});

describe('onboarding service (58/20/21)', () => {
  it('registers drivers, vehicles and passengers with audit', async () => {
    const { service, audits } = setup();
    const driver = await service.registerDriver(admin(), { tenantId: 'tenant-a', userId: 'u-1', status: 'ACTIVE' });
    expect(driver.verificationStatus).toBe('APPLICATION');
    await service.advanceVerification(admin(), driver.id, 'DOCUMENT_REVIEW');
    await service.advanceVerification(admin(), driver.id, 'VERIFICATION');
    await service.advanceVerification(admin(), driver.id, 'APPROVED');
    await service.setAvailability(admin(), driver.id, true);
    const vehicle = await service.registerVehicle(admin(), {
      tenantId: 'tenant-a',
      driverUserId: 'u-1',
      typeId: 'type-car',
      serviceCategory: 'car',
      plate: 'ABC1D23',
      status: 'ACTIVE',
    });
    expect(vehicle.servesCategory('car')).toBe(true);
    expect(vehicle.servesCategory('motorcycle')).toBe(false);
    await service.registerPassenger(admin(), { tenantId: 'tenant-a', userId: 'u-9', status: 'ACTIVE' });
    const events = await audits.listByTenant('tenant-a');
    expect(events.length).toBeGreaterThanOrEqual(4);
  });

  it('denies cross-tenant onboarding reads', async () => {
    const { service } = setup();
    const driver = await service.registerDriver(admin(), { tenantId: 'tenant-a', userId: 'u-1', status: 'ACTIVE' });
    const foreign = { ...admin(), tenantId: 'tenant-b', userId: 'admin-b' };
    await expect(service.advanceVerification(foreign, driver.id, 'DOCUMENT_REVIEW')).rejects.toMatchObject({
      code: 'CROSS_TENANT_DENIED',
    });
  });

  it('blocks unverified drivers at offer acceptance', async () => {
    const tenants = new InMemoryTenantRepository();
    const tenant = Tenant.provision({ id: 'tenant-a', slug: 'tenant-a', name: 'A', now: NOW });
    tenant.transitionTo('CONFIGURING', NOW);
    tenant.transitionTo('PENDING_ACTIVATION', NOW);
    tenant.transitionTo('ACTIVE', NOW);
    await tenants.save(tenant);
    const { service: onboarding, drivers } = setup();
    await onboarding.registerDriver(admin(), { tenantId: 'tenant-a', userId: 'driver-1', status: 'ACTIVE' });
    const rides = new InMemoryRideRepository();
    const audits = new InMemoryAuditEventRepository();
    const events = new InMemoryEventCollector();
    const payments = new PaymentService(new FakePaymentProvider(), new InMemoryPaymentStore(), new InMemoryLedgerStore(), { now: () => NOW }, randomUUID);
    const orchestrator = new RideOrchestrator(tenants, rides, audits, events, new FakeMapsProvider(), payments, { now: () => NOW }, randomUUID, drivers);
    const { ride } = await orchestrator.requestRide(admin(), {
      origin: 'a',
      destination: 'b',
      category: 'car',
      paymentMethod: 'card',
    });
    await orchestrator.startMatching(admin(), ride.id);
    await expect(orchestrator.acceptOffer(admin(), ride.id, 'driver-1')).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });
});
