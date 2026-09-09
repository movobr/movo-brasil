import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import {
  DEFAULT_CATALOG,
  isQuoteValidFor,
  quoteFare,
  type QuoteInput,
} from '../../src/domain/pricing.js';

const NOW = new Date('2026-09-09T12:00:00.000Z');

function baseInput(overrides: Partial<QuoteInput> = {}): QuoteInput {
  return {
    category: 'car',
    distanceMeters: 10000,
    durationSeconds: 1200,
    tollsMinor: 0,
    waitingSeconds: 0,
    coupon: null,
    automaticPromotion: null,
    surgeMilli: 1000,
    origin: 'orig-a',
    destination: 'dest-b',
    catalog: DEFAULT_CATALOG.car,
    ...overrides,
  };
}

describe('pricing V1 (14/DEC-PRICE)', () => {
  it('computes the metered fare: 300 + 1800 + 700 = 2800', () => {
    const quote = quoteFare(baseInput(), NOW);
    expect(quote.total.amountMinor).toBe(2800);
    expect(quote.total.currency).toBe('BRL');
    expect(quote.calculationVersion).toBe('pricing-v1');
  });

  it('floors short motorcycle rides at the R$ 6,00 minimum', () => {
    const quote = quoteFare(
      baseInput({
        category: 'motorcycle',
        distanceMeters: 1000,
        durationSeconds: 60,
        catalog: DEFAULT_CATALOG.motorcycle,
      }),
      NOW,
    );
    // 250 + 130 + 25 = 405 -> max(600).
    expect(quote.subtotal.amountMinor).toBe(600);
    expect(quote.total.amountMinor).toBe(600);
  });

  it('gives 3 free waiting minutes, then charges per minute', () => {
    const free = quoteFare(baseInput({ waitingSeconds: 180 }), NOW);
    expect(free.waiting.amountMinor).toBe(0);
    const paid = quoteFare(baseInput({ waitingSeconds: 300 }), NOW);
    // 120 s × 30/min / 60 = 60.
    expect(paid.waiting.amountMinor).toBe(60);
    expect(paid.total.amountMinor).toBe(2800 + 60);
  });

  it('passes tolls through integrally', () => {
    const quote = quoteFare(baseInput({ tollsMinor: 1450 }), NOW);
    expect(quote.total.amountMinor).toBe(2800 + 1450);
  });

  it('rounds once at the end (10000 m + 61 s car -> 2136)', () => {
    const quote = quoteFare(baseInput({ durationSeconds: 61 }), NOW);
    // (300×60000 + 10000×180×60 + 61×35×1000)/60000 = 2135.5833 -> 2136.
    expect(quote.total.amountMinor).toBe(2136);
  });

  it('applies coupon first, then one automatic promo, capped at the subtotal', () => {
    const quote = quoteFare(
      baseInput({
        coupon: { code: 'CUPOM10', amountMinor: 500, sponsor: 'TENANT' },
        automaticPromotion: { code: 'AUTO', amountMinor: 300, sponsor: 'MOVO' },
      }),
      NOW,
    );
    expect(quote.discounts.amountMinor).toBe(800);
    expect(quote.total.amountMinor).toBe(2000);
  });

  it('never lets discounts create a negative total', () => {
    const quote = quoteFare(
      baseInput({ coupon: { code: 'BIG', amountMinor: 99999, sponsor: 'TENANT' } }),
      NOW,
    );
    expect(quote.discounts.amountMinor).toBe(2800);
    expect(quote.total.amountMinor).toBe(0);
  });

  it('multiplies fare components by surge before tolls, within 1.00–1.80', () => {
    const quote = quoteFare(baseInput({ surgeMilli: 1500, tollsMinor: 1000 }), NOW);
    // 2800 × 1.5 = 4200, then +1000 tolls (not surged).
    expect(quote.subtotal.amountMinor).toBe(4200);
    expect(quote.total.amountMinor).toBe(5200);
    expect(() => quoteFare(baseInput({ surgeMilli: 999 }), NOW)).toThrowError(DomainError);
    expect(() => quoteFare(baseInput({ surgeMilli: 1801 }), NOW)).toThrowError(DomainError);
  });

  it('expires quotes after 2 minutes or on origin/destination change', () => {
    const quote = quoteFare(baseInput(), NOW);
    expect(quote.expiresAt.getTime() - NOW.getTime()).toBe(120000);
    expect(isQuoteValidFor(quote, 'orig-a', 'dest-b', NOW)).toBe(true);
    expect(isQuoteValidFor(quote, 'orig-a', 'dest-b', new Date(NOW.getTime() + 120001))).toBe(false);
    expect(isQuoteValidFor(quote, 'orig-a', 'dest-CHANGED', NOW)).toBe(false);
  });

  it('rejects non-integer money at the boundary', () => {
    expect(() => quoteFare(baseInput({ distanceMeters: 1.5 }), NOW)).toThrowError(DomainError);
  });
});
