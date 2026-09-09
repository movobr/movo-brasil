/**
 * Política de localização — 16-MAPS-GEOLOCATION (location policy).
 * Limites do contrato: >20s inelegível p/ matching, >60s fora do pool.
 * Puro e determinístico; relógio injetado pelo chamador. O pool vivo
 * (realtime) é infra com credenciais; aqui, a regra que o governará.
 */
export const MATCHING_STALE_SECONDS = 20;
export const POOL_EXPIRY_SECONDS = 60;

export type LocationFreshness = 'fresh' | 'stale' | 'expired';

export interface DriverLocation {
  readonly driverId: string;
  readonly tenantId: string;
  readonly latitude: number;
  readonly longitude: number;
  readonly updatedAt: Date;
  readonly onRide: boolean;
}

export function validateCoordinates(latitude: number, longitude: number): void {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new RangeError('Coordinates must be finite numbers.');
  }
  if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
    throw new RangeError('Coordinates out of range.');
  }
}

export function classifyFreshness(updatedAt: Date, now: Date): LocationFreshness {
  const ageSeconds = (now.getTime() - updatedAt.getTime()) / 1000;
  if (ageSeconds <= MATCHING_STALE_SECONDS) return 'fresh';
  if (ageSeconds <= POOL_EXPIRY_SECONDS) return 'stale';
  return 'expired';
}

/** 16: >60s remove do pool; 20–60s permanece mas inelegível (stale). */
export function prunePool(locations: ReadonlyArray<DriverLocation>, now: Date): {
  pooled: DriverLocation[];
  removed: DriverLocation[];
} {
  const pooled: DriverLocation[] = [];
  const removed: DriverLocation[] = [];
  for (const location of locations) {
    if (classifyFreshness(location.updatedAt, now) === 'expired') removed.push(location);
    else pooled.push(location);
  }
  return { pooled, removed };
}
