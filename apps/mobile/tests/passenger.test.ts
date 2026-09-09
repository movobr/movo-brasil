import { describe, expect, it } from 'vitest';
import {
  completedTotalMinor,
  isDriverPositionStale,
  isPaymentChoice,
  stepLabel,
  trackingReceipt,
} from '../src/lib/tracking.js';

const NOW = new Date('2026-09-09T12:00:00Z');

describe('passenger journey (21)', () => {
  it('labels every tracking status', () => {
    expect(stepLabel('MATCHING')).toMatch(/motorista/i);
    expect(stepLabel('COMPLETED')).toBe('Concluída');
    expect(stepLabel('CANCELLED')).toBe('Cancelada');
  });

  it('flags driver positions older than 20 s as stale', () => {
    expect(isDriverPositionStale(new Date(NOW.getTime() - 21_000), NOW)).toBe(true);
    expect(isDriverPositionStale(new Date(NOW.getTime() - 19_000), NOW)).toBe(false);
  });

  it('covers the payment states too (12)', () => {
    expect(stepLabel('PAYMENT_PENDING')).toBe('Processando pagamento…');
    expect(stepLabel('PAID')).toBe('Paga');
    expect(stepLabel('PAYMENT_FAILED')).toBe('Pagamento falhou');
  });

  it('uses the contracted payment types (15)', () => {
    const receipt = trackingReceipt({
      rideId: 'r-1',
      tenantId: 't-a',
      quotedMinor: 2500,
      paymentMethod: 'pix',
      paymentStatus: 'paid',
      paidMinor: 2500,
      completedAt: NOW,
    });
    expect(receipt.split.driverMinor).toBe(2000);
  });

  it('offers only pix and card', () => {
    expect(isPaymentChoice('pix')).toBe(true);
    expect(isPaymentChoice('card')).toBe(true);
    expect(isPaymentChoice('cash')).toBe(false);
  });

  it('totals paid amounts, never quotes (40)', () => {
    expect(
      completedTotalMinor([
        { rideId: 'a', status: 'COMPLETED', quotedMinor: 2500, paidMinor: 2500 },
        { rideId: 'b', status: 'CANCELLED', quotedMinor: 9999, paidMinor: null },
        { rideId: 'c', status: 'COMPLETED', quotedMinor: 2500, paidMinor: null },
      ]),
    ).toBe(2500);
  });
});
