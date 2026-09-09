import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import { Ride } from '../../src/domain/ride.js';

const NOW = new Date('2026-09-09T12:00:00.000Z');

function requested(): Ride {
  return Ride.request({
    id: 'ride-1',
    tenantId: 'tenant-a',
    passengerId: 'pax-1',
    serviceTypeId: 'car',
    pickupLat: -23.5505,
    pickupLng: -46.6333,
    dropoffLat: -23.5645,
    dropoffLng: -46.6433,
    quotedMinor: 2800,
    currency: 'BRL',
    now: NOW,
  });
}

function toArrived(): Ride {
  const ride = requested();
  ride.transitionTo('MATCHING', 'system', NOW);
  ride.transitionTo('ACCEPTED', 'driver-acceptance', NOW);
  ride.assignDriver('driver-1');
  ride.transitionTo('DRIVER_ARRIVING', 'system', NOW);
  ride.transitionTo('DRIVER_ARRIVED', 'location-rule', NOW);
  return ride;
}

describe('ride state machine (12)', () => {
  it('walks the happy path to PAID with attributed triggers', () => {
    const ride = toArrived();
    ride.transitionTo('IN_PROGRESS', 'driver-start', NOW);
    ride.transitionTo('COMPLETED', 'driver-completion', NOW);
    ride.transitionTo('PAYMENT_PENDING', 'system', NOW);
    ride.transitionTo('PAID', 'verified-provider-event', NOW);
    expect(ride.status).toBe('PAID');
    expect(ride.history.length).toBeGreaterThan(0);
    for (const change of ride.history) {
      expect(change.trigger.length).toBeGreaterThan(0);
    }
  });

  it('rejects undocumented transitions deterministically', () => {
    const ride = requested();
    expect(() => ride.transitionTo('IN_PROGRESS', 'driver-start', NOW)).toThrowError(DomainError);
    expect(() => ride.transitionTo('PAID', 'verified-provider-event', NOW)).toThrowError(DomainError);
  });

  it('cannot start after cancellation nor complete twice', () => {
    const ride = toArrived();
    ride.transitionTo('CANCELLED', 'passenger', NOW);
    expect(() => ride.transitionTo('IN_PROGRESS', 'driver-start', NOW)).toThrowError(DomainError);
    const ride2 = toArrived();
    ride2.transitionTo('IN_PROGRESS', 'driver-start', NOW);
    ride2.transitionTo('COMPLETED', 'driver-completion', NOW);
    expect(() => ride2.transitionTo('COMPLETED', 'driver-completion', NOW)).toThrowError(DomainError);
  });

  it('keeps a single winning driver', () => {
    const ride = requested();
    ride.assignDriver('driver-1');
    expect(() => ride.assignDriver('driver-2')).toThrowError(DomainError);
  });

  it('refuses client-side payment triggers (CXL-006/12)', () => {
    const ride = toArrived();
    ride.transitionTo('IN_PROGRESS', 'driver-start', NOW);
    ride.transitionTo('COMPLETED', 'driver-completion', NOW);
    ride.transitionTo('PAYMENT_PENDING', 'system', NOW);
    expect(() => ride.transitionTo('PAID', 'passenger-app', NOW)).toThrowError(DomainError);
    expect(() => ride.transitionTo('PAYMENT_FAILED', 'driver-app', NOW)).toThrowError(DomainError);
    ride.transitionTo('PAYMENT_FAILED', 'system-reconciliation', NOW);
    expect(ride.status).toBe('PAYMENT_FAILED');
  });
});
