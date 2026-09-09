import { describe, expect, it } from 'vitest';
import { classifyFreshness, prunePool, type DriverLocation } from '../../src/domain/driver-location.js';
import { removeExpiredCandidates, type DriverCandidate } from '../../src/domain/dispatch.js';
import { haversineMeters, isServiceable, validateServiceArea, type ServicePolygon } from '../../src/domain/geofence.js';

const NOW = new Date('2026-09-09T12:00:00Z');
const secondsAgo = (seconds: number) => new Date(NOW.getTime() - seconds * 1000);

function location(driverId: string, updatedAt: Date): DriverLocation {
  return { driverId, tenantId: 'tenant-a', latitude: -23.55, longitude: -46.63, updatedAt, onRide: false };
}

/** Polígono ~1 km² em torno da Praça da Sé (ordem qualquer). */
const POLYGON: ServicePolygon = [
  { latitude: -23.545, longitude: -46.635 },
  { latitude: -23.545, longitude: -46.625 },
  { latitude: -23.555, longitude: -46.625 },
  { latitude: -23.555, longitude: -46.635 },
];

describe('location policy (16)', () => {
  it('classifies freshness on the contracted edges', () => {
    expect(classifyFreshness(secondsAgo(20), NOW)).toBe('fresh');
    expect(classifyFreshness(secondsAgo(21), NOW)).toBe('stale');
    expect(classifyFreshness(secondsAgo(60), NOW)).toBe('stale');
    expect(classifyFreshness(secondsAgo(61), NOW)).toBe('expired');
  });

  it('prunes only expired drivers from the pool', () => {
    const { pooled, removed } = prunePool(
      [location('fresh-1', secondsAgo(5)), location('stale-1', secondsAgo(30)), location('gone-1', secondsAgo(120))],
      NOW,
    );
    expect(pooled.map((l) => l.driverId).sort()).toEqual(['fresh-1', 'stale-1']);
    expect(removed.map((l) => l.driverId)).toEqual(['gone-1']);
  });
});

describe('geofence (16)', () => {
  it('accepts inside points and the 100 m tolerance band', () => {
    const inside = { latitude: -23.55, longitude: -46.63 };
    expect(isServiceable(inside, [POLYGON])).toBe(true);
    // ~50 m ao norte da borda norte (-23.545): dentro da tolerância.
    const nearEdge = { latitude: -23.54455, longitude: -46.63 };
    expect(isServiceable(nearEdge, [POLYGON])).toBe(true);
    // ~500 m ao norte: fora.
    const far = { latitude: -23.5405, longitude: -46.63 };
    expect(isServiceable(far, [POLYGON])).toBe(false);
  });

  it('validates pickup and dropoff independently, closed with no polygons', () => {
    const inside = { latitude: -23.55, longitude: -46.63 };
    const far = { latitude: -23.5405, longitude: -46.63 };
    expect(validateServiceArea(inside, far, [POLYGON])).toEqual({ pickupOk: true, dropoffOk: false });
    expect(validateServiceArea(inside, inside, [])).toEqual({ pickupOk: false, dropoffOk: false });
  });

  it('measures haversine sanely (Sé → ~111 m por 0,001° de latitude)', () => {
    const meters = haversineMeters({ latitude: -23.55, longitude: -46.63 }, { latitude: -23.549, longitude: -46.63 });
    expect(meters).toBeGreaterThan(100);
    expect(meters).toBeLessThan(125);
  });

  it('removes expired candidates before dispatch waves', () => {
    const candidate = (driverId: string, locationAgeSeconds: number): DriverCandidate => ({
      driverId,
      tenantId: 'tenant-a',
      activeVerified: true,
      available: true,
      serviceCategories: ['car'],
      zoneCompatible: true,
      locationAgeSeconds,
      distanceKm: 1,
      etaSeconds: 120,
      locationTimestamp: NOW.getTime() - locationAgeSeconds * 1000,
      idleSeconds: 60,
      assignedToActiveRide: false,
    });
    const survivors = removeExpiredCandidates([candidate('a', 10), candidate('b', 60), candidate('c', 61)]);
    expect(survivors.map((c) => c.driverId)).toEqual(['a', 'b']);
  });
});
