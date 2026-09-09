/**
 * CORS allowlist para futuras rotas /api/* (33: CORS allowlist).
 * Padrão deny-by-default: somente origens explícitas passam.
 */
export function isOriginAllowed(origin: string | null, allowlist: ReadonlyArray<string>): boolean {
  if (origin === null || origin === '') return false;
  return allowlist.includes(origin);
}

export function corsHeadersFor(origin: string | null, allowlist: ReadonlyArray<string>): Record<string, string> {
  if (!isOriginAllowed(origin, allowlist)) return {};
  return {
    'Access-Control-Allow-Origin': origin as string,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Idempotency-Key',
    Vary: 'Origin',
  };
}
