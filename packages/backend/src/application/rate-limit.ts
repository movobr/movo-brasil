/**
 * Rate limiting — controle 33-SECURITY-BASELINE. Token bucket por chave,
 * limites sempre explícitos (valores são config por tenant/plano, nunca
 * assumidos aqui).
 */
export interface RateLimit {
  readonly maxTokens: number;
  readonly refillTokensPerSecond: number;
}

export class RateLimiter {
  private readonly buckets = new Map<string, { tokens: number; updatedAtMs: number }>();

  constructor(private readonly nowMs: () => number = () => Date.now()) {}

  /**
   * Retorna true quando a chamada pode prosseguir (consome 1 token).
   * Determinístico dado o relógio injetado.
   */
  allow(key: string, limit: RateLimit): boolean {
    const now = this.nowMs();
    const stored = this.buckets.get(key) ?? { tokens: limit.maxTokens, updatedAtMs: now };
    const elapsedSeconds = (now - stored.updatedAtMs) / 1000;
    const refilled = Math.min(limit.maxTokens, stored.tokens + elapsedSeconds * limit.refillTokensPerSecond);
    if (refilled < 1) {
      this.buckets.set(key, { tokens: refilled, updatedAtMs: now });
      return false;
    }
    this.buckets.set(key, { tokens: refilled - 1, updatedAtMs: now });
    return true;
  }
}
