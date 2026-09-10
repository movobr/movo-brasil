import { describe, expect, it } from 'vitest';
import { RatingService } from '../../src/application/rating-service.js';
import {
  InMemoryRatingStore,
  actorWith,
} from '../../src/infrastructure/memory/communication.js';

function buildService(rideStatus = 'COMPLETED', driverUserId: string | null = 'drv-1') {
  const ratings = new InMemoryRatingStore();
  let counter = 0;
  const service = new RatingService(
    ratings,
    {
      findById: async () =>
        rideStatus === 'MISSING'
          ? null
          : { status: rideStatus, passengerUserId: 'pax-1', driverUserId },
    },
    () => `rating-${(counter += 1)}`,
    () => new Date('2026-09-09T12:00:00Z'),
  );
  return { service, ratings };
}

describe('ride ratings — bilateral 1–5 (Owner DECIDED)', () => {
  it('accepts passenger→driver and driver→passenger ratings', async () => {
    const { service } = buildService();
    const passenger = actorWith(['ride.rate'], 'tenant-a', 'pax-1');
    const toDriver = await service.submitRating(passenger, 'tenant-a', 'ride-1', 5);
    expect(toDriver.direction).toBe('passenger_to_driver');
    expect(toDriver.rateeUserId).toBe('drv-1');
    const driver = actorWith(['ride.rate'], 'tenant-a', 'drv-1');
    const toPassenger = await service.submitRating(driver, 'tenant-a', 'ride-1', 4);
    expect(toPassenger.direction).toBe('driver_to_passenger');
    expect(await service.listRatings(passenger, 'tenant-a', 'ride-1')).toHaveLength(2);
  });

  it('rejects out-of-range stars, duplicates, outsiders and open rides', async () => {
    const { service } = buildService();
    const passenger = actorWith(['ride.rate'], 'tenant-a', 'pax-1');
    await expect(service.submitRating(passenger, 'tenant-a', 'ride-1', 0)).rejects.toThrow(/1 and 5/);
    await expect(service.submitRating(passenger, 'tenant-a', 'ride-1', 6)).rejects.toThrow(/1 and 5/);
    await service.submitRating(passenger, 'tenant-a', 'ride-1', 5);
    await expect(service.submitRating(passenger, 'tenant-a', 'ride-1', 4)).rejects.toThrow(/already rated/);
    const outsider = actorWith(['ride.rate'], 'tenant-a', 'stranger-1');
    await expect(service.submitRating(outsider, 'tenant-a', 'ride-1', 5)).rejects.toThrow(/participants/);
    const noPerm = actorWith(['ride.read'], 'tenant-a', 'pax-1');
    await expect(service.submitRating(noPerm, 'tenant-a', 'ride-1', 5)).rejects.toThrow();
    const open = buildService('IN_PROGRESS').service;
    await expect(open.submitRating(passenger, 'tenant-a', 'ride-1', 5)).rejects.toThrow(/completed/);
  });

  it('refuses rides without a driver or missing rides', async () => {
    const noDriver = buildService('COMPLETED', null).service;
    const passenger = actorWith(['ride.rate'], 'tenant-a', 'pax-1');
    await expect(noDriver.submitRating(passenger, 'tenant-a', 'ride-1', 5)).rejects.toThrow(/without an assigned driver/);
    const missing = buildService('MISSING').service;
    await expect(missing.submitRating(passenger, 'tenant-a', 'ride-1', 5)).rejects.toThrow(/not found/);
  });
});
