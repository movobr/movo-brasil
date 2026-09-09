import { describe, expect, it } from 'vitest';
import { buildReceipt } from '../../src/domain/receipt.js';

const BASE = {
  rideId: 'ride-1',
  tenantId: 'tenant-a',
  rideStatus: 'COMPLETED',
  quotedMinor: 2500,
  tenantDiscountsMinor: 0,
  movoDiscountsMinor: 0,
  paymentMethod: 'pix' as const,
  paymentStatus: 'paid' as const,
  paidMinor: 2500,
  completedAt: new Date('2026-09-09T12:30:00Z'),
};

describe('passenger receipt (26-9)', () => {
  it('composes quoted fare, exact split and payment state', () => {
    const receipt = buildReceipt(BASE);
    expect(receipt.quotedMinor).toBe(2500);
    expect(receipt.split.driverMinor).toBe(2000);
    expect(receipt.split.tenantMinor).toBe(425);
    expect(receipt.split.movoMinor).toBe(75);
    expect(receipt.split.driverMinor + receipt.split.tenantMinor + receipt.split.movoMinor).toBe(2500);
    expect(receipt.paymentStatus).toBe('paid');
  });

  it('refuses receipts for non-completed rides', () => {
    expect(() => buildReceipt({ ...BASE, rideStatus: 'IN_PROGRESS' })).toThrow(/only for completed rides/);
    expect(() => buildReceipt({ ...BASE, completedAt: null })).toThrow(/completion timestamp/);
  });
});
