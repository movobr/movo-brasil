import { describe, expect, it } from 'vitest';
import { splitFare } from '@movo/brasil/src/domain/ledger.js';
import {
  ONLINE_IDLE_UPDATE_SECONDS,
  ON_RIDE_UPDATE_SECONDS,
  createTracker,
  freshnessOf,
  tick,
  updateIntervalSeconds,
  type LocationProvider,
} from '../src/lib/location-tracker.js';
import { navigationHandoffUri } from '../src/lib/navigation.js';

const NOW = new Date('2026-09-09T12:00:00Z');

function providerAt(latitude: number, longitude: number): LocationProvider {
  return { getCurrentPosition: async () => ({ latitude, longitude }) };
}

describe('driver journey (20/16)', () => {
  it('uses 5 s on-ride and 15 s idle cadence', () => {
    expect(updateIntervalSeconds(true)).toBe(ON_RIDE_UPDATE_SECONDS);
    expect(updateIntervalSeconds(false)).toBe(ONLINE_IDLE_UPDATE_SECONDS);
    expect(ON_RIDE_UPDATE_SECONDS).toBe(5);
    expect(ONLINE_IDLE_UPDATE_SECONDS).toBe(15);
  });

  it('emits only when the cadence elapses and rejects bad coordinates', async () => {
    const provider = providerAt(-23.55, -46.63);
    let tracker = createTracker('drv-1', 'tenant-a');
    const first = await tick(tracker, provider, NOW);
    tracker = first.state;
    expect(first.location).not.toBeNull();
    expect(first.location?.driverId).toBe('drv-1');
    const immediate = await tick(tracker, provider, new Date(NOW.getTime() + 1000));
    expect(immediate.location).toBeNull();
    await expect(tick(createTracker('d', 't'), providerAt(200, 0), NOW)).rejects.toThrow();
  });

  it('reports freshness from the contracted engine', async () => {
    const provider = providerAt(-23.55, -46.63);
    const { location } = await tick(createTracker('drv-1', 'tenant-a'), provider, NOW);
    expect(location !== null && freshnessOf(location, new Date(NOW.getTime() + 61_000))).toBe('expired');
  });

  it('builds navigation handoff URIs', () => {
    expect(navigationHandoffUri(-23.55, -46.63, 'Destino')).toBe('geo:-23.55,-46.63?q=-23.55,-46.63(Destino)');
  });

  it('computes the driver share with the real split', () => {
    const split = splitFare({ grossMinor: 2500, tenantDiscountsMinor: 0, movoDiscountsMinor: 0 });
    expect(split.driverMinor).toBe(2000);
  });
});
