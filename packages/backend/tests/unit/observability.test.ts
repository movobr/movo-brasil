import { describe, expect, it } from 'vitest';
import { Logger, type LogRecord } from '../../src/infrastructure/observability/logger.js';
import { CRITICAL_METRICS, MetricsRegistry } from '../../src/infrastructure/observability/metrics.js';
import { checkHealth } from '../../src/infrastructure/observability/health.js';

describe('observability (36)', () => {
  it('emits structured logs with correlation ID', () => {
    const records: LogRecord[] = [];
    const logger = new Logger({ write: (r) => records.push(r) }, () => new Date('2026-09-09T12:00:00.000Z'));
    logger.info('ride.requested', 'corr-1', 'tenant-a', { rideId: 'r-1' });
    expect(records[0]).toMatchObject({ level: 'info', message: 'ride.requested', correlationId: 'corr-1', tenantId: 'tenant-a' });
    expect(JSON.stringify(records[0])).toContain('corr-1');
  });

  it('covers every critical metric name from the contract', () => {
    expect(CRITICAL_METRICS).toContain('request_error_rate');
    expect(CRITICAL_METRICS).toContain('dispatch_latency_ms');
    expect(CRITICAL_METRICS).toContain('payment_failures');
    const registry = new MetricsRegistry();
    registry.increment('ride_request_success');
    registry.increment('ride_request_success');
    registry.observeDispatchLatencyMs(100);
    registry.observeDispatchLatencyMs(200);
    const snapshot = registry.snapshot();
    expect(snapshot.counters['ride_request_success']).toBe(2);
    expect(snapshot.dispatchLatencyP95).toBe(200);
  });

  it('reports healthy/degraded/down from dependency checks', async () => {
    const healthy = await checkHealth('0.1.0', [{ name: 'db', check: async () => true }]);
    expect(healthy.status).toBe('healthy');
    const degraded = await checkHealth('0.1.0', [
      { name: 'db', check: async () => true },
      { name: 'redis', check: async () => false },
    ]);
    expect(degraded.status).toBe('degraded');
    const down = await checkHealth('0.1.0', [{ name: 'db', check: async () => { throw new Error('x'); } }]);
    expect(down.status).toBe('down');
  });
});
