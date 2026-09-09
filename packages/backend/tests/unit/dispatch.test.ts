import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import {
  WAVES,
  acceptRide,
  closeWithoutDriver,
  isEligible,
  planWaveOffers,
  rankCandidates,
  type DispatchRequest,
  type DriverCandidate,
  type RideAssignment,
} from '../../src/domain/dispatch.js';

const REQUEST: DispatchRequest = { tenantId: 'tenant-a', serviceCategory: 'car' };

function candidate(overrides: Partial<DriverCandidate> = {}): DriverCandidate {
  return {
    driverId: 'driver-1',
    tenantId: 'tenant-a',
    activeVerified: true,
    available: true,
    serviceCategories: ['car'],
    zoneCompatible: true,
    locationAgeSeconds: 5,
    distanceKm: 1.2,
    etaSeconds: 180,
    locationTimestamp: 1000,
    idleSeconds: 60,
    assignedToActiveRide: false,
    ...overrides,
  };
}

describe('dispatch eligibility (13)', () => {
  it('accepts a fully qualified candidate', () => {
    expect(isEligible(candidate(), REQUEST)).toBe(true);
  });

  it('rejects each violation independently', () => {
    const violations: Array<Partial<DriverCandidate>> = [
      { tenantId: 'tenant-b' },
      { activeVerified: false },
      { available: false },
      { serviceCategories: ['motorcycle'] },
      { zoneCompatible: false },
      { locationAgeSeconds: 21 },
      { assignedToActiveRide: true },
    ];
    for (const violation of violations) {
      expect(isEligible(candidate(violation), REQUEST)).toBe(false);
    }
  });

  it('accepts location age exactly at the 20 s boundary', () => {
    expect(isEligible(candidate({ locationAgeSeconds: 20 }), REQUEST)).toBe(true);
  });
});

describe('lexicographic ranking (13)', () => {
  it('orders by ETA, then freshness, then idleness, then driver UUID', () => {
    const c1 = candidate({ driverId: 'driver-b', etaSeconds: 300, locationTimestamp: 2000, idleSeconds: 10 });
    const c2 = candidate({ driverId: 'driver-a', etaSeconds: 120, locationTimestamp: 1000, idleSeconds: 10 });
    const c3 = candidate({ driverId: 'driver-c', etaSeconds: 120, locationTimestamp: 3000, idleSeconds: 10 });
    const c4 = candidate({ driverId: 'driver-d', etaSeconds: 120, locationTimestamp: 3000, idleSeconds: 90 });
    const c5 = candidate({ driverId: 'driver-0', etaSeconds: 120, locationTimestamp: 3000, idleSeconds: 90 });
    const ranked = rankCandidates([c1, c2, c3, c4, c5]).map((c) => c.driverId);
    expect(ranked).toEqual(['driver-0', 'driver-d', 'driver-c', 'driver-a', 'driver-b']);
  });
});

describe('search waves (13)', () => {
  it('uses radii 2/4/7 km with up to 5 offers and 12 s timeout', () => {
    expect(WAVES.map((w) => w.radiusKm)).toEqual([2, 4, 7]);
    for (const wave of WAVES) {
      expect(wave.maxOffers).toBe(5);
      expect(wave.timeoutSeconds).toBe(12);
    }
  });

  it('caps offers at 5 per wave within the radius', () => {
    const ranked = rankCandidates(
      Array.from({ length: 8 }, (_, i) => candidate({ driverId: `driver-${i}`, distanceKm: 1 })),
    );
    const offers = planWaveOffers(ranked, WAVES[0]!, new Set());
    expect(offers.driverIds).toHaveLength(5);
  });

  it('never re-offers drivers from previous waves and widens the radius', () => {
    const ranked = rankCandidates([
      candidate({ driverId: 'near-1', distanceKm: 1 }),
      candidate({ driverId: 'mid-1', distanceKm: 3 }),
      candidate({ driverId: 'far-1', distanceKm: 6 }),
    ]);
    const wave1 = planWaveOffers(ranked, WAVES[0]!, new Set());
    expect(wave1.driverIds).toEqual(['near-1']);
    const offered = new Set(wave1.driverIds);
    const wave2 = planWaveOffers(ranked, WAVES[1]!, offered);
    expect(wave2.driverIds).toEqual(['mid-1']);
    for (const id of wave2.driverIds) offered.add(id);
    const wave3 = planWaveOffers(ranked, WAVES[2]!, offered);
    expect(wave3.driverIds).toEqual(['far-1']);
  });
});

describe('atomic winner (13/DEC-DISP-007)', () => {
  it('lets the first valid acceptance win and rejects later ones', () => {
    const open: RideAssignment = { rideId: 'ride-1', status: 'OPEN', winnerDriverId: null };
    const assigned = acceptRide(open, 'driver-1');
    expect(assigned.status).toBe('ASSIGNED');
    expect(assigned.winnerDriverId).toBe('driver-1');
    try {
      acceptRide(assigned, 'driver-2');
      expect.unreachable();
    } catch (error) {
      expect((error as DomainError).code).toBe('CONFLICT');
    }
    expect(assigned.winnerDriverId).toBe('driver-1');
  });
});

describe('no availability (13)', () => {
  it('closes with no_driver_available plus event after wave 3', () => {
    const { assignment, event } = closeWithoutDriver('ride-1', 'tenant-a');
    expect(assignment.status).toBe('NO_DRIVER_AVAILABLE');
    expect(assignment.winnerDriverId).toBeNull();
    expect(event).toEqual({ type: 'dispatch.no_driver_available', rideId: 'ride-1', tenantId: 'tenant-a' });
    expect(() => acceptRide(assignment, 'driver-9')).toThrowError(DomainError);
  });
});
