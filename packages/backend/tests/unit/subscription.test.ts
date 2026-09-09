import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../../src/domain/errors.js';
import { PLANS, Subscription } from '../../src/domain/subscription.js';
import { BILLING_PERMISSIONS, SubscriptionService } from '../../src/application/subscription-service.js';
import type { ActorContext } from '../../src/domain/authorization.js';
import { InMemoryAuditEventRepository } from '../../src/infrastructure/memory/repositories.js';
import { InMemoryLedgerStore } from '../../src/infrastructure/memory/payments.js';
import { InMemorySubscriptionRepository } from '../../src/infrastructure/memory/subscriptions.js';

const DAY = 24 * 3600 * 1000;
const T0 = new Date('2026-09-09T12:00:00.000Z');

function platform(): ActorContext {
  return { userId: 'platform-admin', tenantId: null, permissions: [BILLING_PERMISSIONS.subscriptionManage], correlationId: 'corr-1' };
}

function setup(now: Date = T0) {
  const subscriptions = new InMemorySubscriptionRepository();
  const ledger = new InMemoryLedgerStore();
  const audits = new InMemoryAuditEventRepository();
  const service = new SubscriptionService(subscriptions, ledger, audits, { now: () => now }, randomUUID);
  return { subscriptions, ledger, audits, service };
}

describe('saas billing (08/DEC-SaaS)', () => {
  it('pins the V1 plan catalog', () => {
    expect(PLANS['launch']).toMatchObject({ monthlyPriceMinor: 59900, maxDrivers: 100, maxRidesPerMonth: 10000, maxAreas: 1 });
    expect(PLANS['growth']).toMatchObject({ monthlyPriceMinor: 149900, maxDrivers: 500, maxRidesPerMonth: 50000, maxAreas: 5 });
    expect(PLANS['enterprise']).toMatchObject({ monthlyPriceMinor: 399900, maxDrivers: 2000, maxRidesPerMonth: 200000, maxAreas: 20 });
  });

  it('trials run 14 days free with demo limits', async () => {
    const { service } = setup();
    const subscription = await service.startTrial(platform(), 'tenant-a');
    expect(subscription.status).toBe('TRIAL');
    expect(subscription.isOperational(T0)).toBe(true);
    expect(subscription.limits()).toMatchObject({ maxDrivers: 50, maxRidesPerMonth: 2000 });
    expect(subscription.isOperational(new Date(T0.getTime() + 15 * DAY))).toBe(false);
  });

  it('subscribing posts the charge on the saas ledger', async () => {
    const { service, ledger, subscriptions } = setup();
    await service.startTrial(platform(), 'tenant-a');
    await service.subscribe(platform(), 'tenant-a', 'growth');
    const subId = (await subscriptions.findByTenantId('tenant-a'))!.id;
    const entries = await ledger.listByReference(subId);
    expect(entries).toHaveLength(2);
    for (const entry of entries) expect(entry.ledger).toBe('saas');
    const debit = entries.find((e) => e.direction === 'debit');
    expect(debit?.amountMinor).toBe(149900);
  });

  it('keeps operating through the 7-day grace, then lapses to SUSPENDED', async () => {
    let now = T0;
    const { subscriptions, ledger, audits } = setup(T0);
    const service = new SubscriptionService(subscriptions, ledger, audits, { now: () => now }, randomUUID);
    await service.startTrial(platform(), 'tenant-a');
    await service.subscribe(platform(), 'tenant-a', 'launch');
    now = new Date(T0.getTime() + 30 * DAY);
    await service.recordChargeFailure(platform(), 'tenant-a');
    const sub = (await subscriptions.findByTenantId('tenant-a'))!;
    expect(sub.status).toBe('PAST_DUE');
    expect(sub.isOperational(new Date(now.getTime() + 6 * DAY))).toBe(true);
    expect(sub.isOperational(new Date(now.getTime() + 8 * DAY))).toBe(false);
    now = new Date(now.getTime() + 8 * DAY);
    expect(await service.lapse(platform(), 'tenant-a')).toBe('SUSPENDED');
    expect((await subscriptions.findByTenantId('tenant-a'))!.status).toBe('SUSPENDED');
  });

  it('recovers to ACTIVE on payment and enforces plan limits', async () => {
    const { service, subscriptions } = setup();
    await service.startTrial(platform(), 'tenant-a');
    await service.subscribe(platform(), 'tenant-a', 'launch');
    await service.recordChargeFailure(platform(), 'tenant-a');
    await service.subscribe(platform(), 'tenant-a', 'launch');
    const sub = (await subscriptions.findByTenantId('tenant-a'))!;
    expect(sub.status).toBe('ACTIVE');
    expect(() => sub.assertDriverLimit(100)).toThrowError(DomainError);
    expect(() => sub.assertDriverLimit(99)).not.toThrow();
    expect(() => sub.assertRideLimit(10000)).toThrowError(DomainError);
  });

  it('expires lapsed trials', async () => {
    const { subscriptions, ledger, audits } = setup(T0);
    const service = new SubscriptionService(subscriptions, ledger, audits, { now: () => T0 }, randomUUID);
    await service.startTrial(platform(), 'tenant-a');
    const later = new SubscriptionService(subscriptions, ledger, audits, { now: () => new Date(T0.getTime() + 15 * DAY) }, randomUUID);
    expect(await later.lapse(platform(), 'tenant-a')).toBe('EXPIRED');
  });
});
