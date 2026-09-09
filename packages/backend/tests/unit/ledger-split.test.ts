import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import { compensate, postSettlement, splitFare } from '../../src/domain/ledger.js';

const NOW = new Date('2026-09-09T12:00:00.000Z');

describe('financial split (DEC-FIN-001/002)', () => {
  it('splits 80/17/3 exactly over the eligible base', () => {
    // Bruto 2800, sem descontos: 2240 + 476 + 84 = 2800.
    expect(splitFare({ grossMinor: 2800, tenantDiscountsMinor: 0, movoDiscountsMinor: 0 })).toEqual({
      driverMinor: 2240,
      tenantMinor: 476,
      movoMinor: 84,
    });
  });

  it('excludes tenant-funded discounts from the driver base, keeps MOVO-sponsored', () => {
    // Bruto 2800, 800 do tenant, 300 do MOVO: base 2000 -> 1600 + 340 + 60.
    const split = splitFare({ grossMinor: 2800, tenantDiscountsMinor: 800, movoDiscountsMinor: 300 });
    expect(split).toEqual({ driverMinor: 1600, tenantMinor: 340, movoMinor: 60 });
  });

  it('rejects discounts above the gross fare', () => {
    expect(() => splitFare({ grossMinor: 100, tenantDiscountsMinor: 200, movoDiscountsMinor: 0 })).toThrowError(
      DomainError,
    );
  });
});

describe('settlement ledger (57/DEC-FIN-003/004)', () => {
  it('posts ride settlement with deterministic idempotency keys', () => {
    const split = splitFare({ grossMinor: 2800, tenantDiscountsMinor: 0, movoDiscountsMinor: 0 });
    const entries = postSettlement({
      settlementId: 'stl-pay-1',
      tenantId: 'tenant-a',
      rideId: 'ride-1',
      currency: 'BRL',
      split,
      gatewayFeeMinor: 99,
      now: NOW,
    });
    expect(entries).toHaveLength(4);
    for (const entry of entries) {
      expect(entry.ledger).toBe('ride');
      expect(entry.idempotencyKey).toBe(entry.id);
    }
    const fee = entries.find((e) => e.source === 'ride.settlement.gateway_fee');
    expect(fee?.direction).toBe('debit');
    expect(fee?.amountMinor).toBe(99);
  });

  it('compensates without mutating history', () => {
    const split = splitFare({ grossMinor: 2800, tenantDiscountsMinor: 0, movoDiscountsMinor: 0 });
    const [driver] = postSettlement({
      settlementId: 'stl-pay-1',
      tenantId: 'tenant-a',
      rideId: 'ride-1',
      currency: 'BRL',
      split,
      gatewayFeeMinor: 0,
      now: NOW,
    });
    const reversal = compensate(driver!, 'rev-1', NOW);
    expect(reversal.direction).toBe('debit');
    expect(reversal.amountMinor).toBe(driver!.amountMinor);
    expect(reversal.reversesEntryId).toBe(driver!.id);
    expect(reversal.ledger).toBe('ride');
  });
});
