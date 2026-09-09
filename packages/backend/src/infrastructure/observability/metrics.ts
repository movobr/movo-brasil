/**
 * Métricas críticas — 36-OBSERVABILITY (nomes do contrato; thresholds são
 * decisões NFR, nunca assumidos aqui).
 */
export const CRITICAL_METRICS = [
  'request_error_rate',
  'ride_request_success',
  'dispatch_latency_ms',
  'active_drivers',
  'stale_location_rate',
  'payment_failures',
  'webhook_retries',
  'queue_lag_ms',
  'authentication_failures',
] as const;

export type CriticalMetric = (typeof CRITICAL_METRICS)[number];

export class MetricsRegistry {
  private readonly counters = new Map<string, number>();
  private readonly gauges = new Map<string, number>();
  private readonly observations: number[] = [];

  increment(metric: CriticalMetric, by = 1): void {
    this.counters.set(metric, (this.counters.get(metric) ?? 0) + by);
  }

  gauge(metric: CriticalMetric, value: number): void {
    this.gauges.set(metric, value);
  }

  observeDispatchLatencyMs(valueMs: number): void {
    this.observations.push(valueMs);
  }

  snapshot(): { counters: Record<string, number>; gauges: Record<string, number>; dispatchLatencyP95: number | null } {
    if (this.observations.length === 0) {
      return { counters: Object.fromEntries(this.counters), gauges: Object.fromEntries(this.gauges), dispatchLatencyP95: null };
    }
    const sorted = [...this.observations].sort((a, b) => a - b);
    const index = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      dispatchLatencyP95: sorted[index] ?? null,
    };
  }
}
