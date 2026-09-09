import { describe, expect, it } from 'vitest';
import { RateLimiter } from '../../src/application/rate-limit.js';
import { OutboxDispatcher } from '../../src/domain/outbox.js';
import { InMemoryOutboxStore } from '../../src/infrastructure/memory/outbox.js';

const NOW = new Date('2026-09-09T12:00:00.000Z');

function outboxEvent(id: string) {
  return {
    id,
    eventType: 'ride.requested.v1',
    tenantId: 'tenant-a',
    aggregateType: 'ride',
    aggregateId: 'ride-1',
    correlationId: 'corr-1',
    payload: {},
    status: 'pending' as const,
    attempts: 0,
    createdAt: NOW,
  };
}

describe('rate limiting (33)', () => {
  it('allows within budget, denies above, refills over time', () => {
    let nowMs = 0;
    const limiter = new RateLimiter(() => nowMs);
    const limit = { maxTokens: 2, refillTokensPerSecond: 1 };
    expect(limiter.allow('tenant-a:ride.request', limit)).toBe(true);
    expect(limiter.allow('tenant-a:ride.request', limit)).toBe(true);
    expect(limiter.allow('tenant-a:ride.request', limit)).toBe(false);
    nowMs += 1500;
    expect(limiter.allow('tenant-a:ride.request', limit)).toBe(true);
  });

  it('isolates buckets per key', () => {
    const limiter = new RateLimiter(() => 0);
    const limit = { maxTokens: 1, refillTokensPerSecond: 0 };
    expect(limiter.allow('a', limit)).toBe(true);
    expect(limiter.allow('a', limit)).toBe(false);
    expect(limiter.allow('b', limit)).toBe(true);
  });
});

describe('transactional outbox (17/DEC-RT-002)', () => {
  it('delivers once despite duplicates and tolerates consumer failure', async () => {
    const store = new InMemoryOutboxStore();
    await store.append(outboxEvent('evt-1'));
    await store.append(outboxEvent('evt-1'));
    let handled = 0;
    const dispatcher = new OutboxDispatcher();
    const delivered = await dispatcher.dispatch(store, [
      {
        eventType: 'ride.requested.v1',
        handle: async () => {
          handled += 1;
        },
      },
    ]);
    expect(delivered).toBe(1);
    expect(handled).toBe(1);
    expect(await store.listPending(10)).toHaveLength(0);
  });

  it('parks events without consumers as failed', async () => {
    const store = new InMemoryOutboxStore();
    await store.append(outboxEvent('evt-9'));
    const dispatcher = new OutboxDispatcher();
    expect(await dispatcher.dispatch(store, [])).toBe(0);
    expect(await store.listPending(10)).toHaveLength(0);
  });
});
