import { DomainError } from './errors.js';
import { moneyMinor, type MoneyMinor } from './money.js';

/**
 * Pricing V1 — 14-PRICING-CONTRACT + DEC-PRICE-001..009.
 *
 * Pipeline (ordem do contrato): metered -> max(minimum) -> ×surge
 * (sobre os componentes de tarifa, antes de descontos e pedágios) ->
 * +tolls +waiting −discounts, com UM arredondamento ao final (DEC-PRICE-008).
 *
 * Exatidão: toda a conta é feita em inteiros sobre o denominador comum
 * 60000 (base×60000 + metros×rateKm×60 + segundos×rateMin×1000); divisão e
 * arredondamento half-up ocorrem uma única vez. Nenhum float é verdade.
 */
export const PRICING_CALCULATION_VERSION = 'pricing-v1';
export const PRICING_CURRENCY = 'BRL';
export const QUOTE_TTL_SECONDS = 120;
export const FREE_WAITING_SECONDS = 180;
export const SURGE_MIN_MILLI = 1000;
export const SURGE_MAX_MILLI = 1800;

export type RideCategory = 'car' | 'motorcycle';

export interface RateCatalog {
  baseMinor: number;
  perKmMinor: number;
  perMinMinor: number;
  minimumMinor: number;
  waitingPerMinMinor: number;
}

/** Catálogo padrão V1 — DEC-PRICE-002/003/004. */
export const DEFAULT_CATALOG: Readonly<Record<RideCategory, RateCatalog>> = {
  car: { baseMinor: 300, perKmMinor: 180, perMinMinor: 35, minimumMinor: 800, waitingPerMinMinor: 30 },
  motorcycle: { baseMinor: 250, perKmMinor: 130, perMinMinor: 25, minimumMinor: 600, waitingPerMinMinor: 25 },
};

export type DiscountSponsor = 'TENANT' | 'MOVO';

export interface Discount {
  readonly code: string | null;
  readonly amountMinor: number;
  readonly sponsor: DiscountSponsor;
}

export interface QuoteInput {
  readonly category: RideCategory;
  /** Metros inteiros (conversão exata de km×1000) — DERIVED-006. */
  readonly distanceMeters: number;
  /** Segundos inteiros (conversão exata de min×60) — DERIVED-006. */
  readonly durationSeconds: number;
  readonly tollsMinor: number;
  /** Segundos desde a chegada; 0 em cotação antecipada. */
  readonly waitingSeconds: number;
  readonly coupon: Discount | null;
  readonly automaticPromotion: Discount | null;
  /** Milésimos; 1000 = desativado. Faixa 1000–1800 (DEC-PRICE-006). */
  readonly surgeMilli: number;
  readonly origin: string;
  readonly destination: string;
  readonly catalog: RateCatalog;
}

export interface FareQuote {
  readonly category: RideCategory;
  readonly origin: string;
  readonly destination: string;
  readonly subtotal: MoneyMinor;
  readonly surgeMilli: number;
  readonly tolls: MoneyMinor;
  readonly waiting: MoneyMinor;
  readonly discounts: MoneyMinor;
  readonly total: MoneyMinor;
  readonly calculationVersion: string;
  readonly policySnapshot: RateCatalog;
  readonly quotedAt: Date;
  readonly expiresAt: Date;
}

const SCALE = 60000;

export function quoteFare(input: QuoteInput, now: Date): FareQuote {
  assertNonNegativeInt(input.distanceMeters, 'distanceMeters');
  assertNonNegativeInt(input.durationSeconds, 'durationSeconds');
  assertNonNegativeInt(input.tollsMinor, 'tollsMinor');
  assertNonNegativeInt(input.waitingSeconds, 'waitingSeconds');
  for (const discount of [input.coupon, input.automaticPromotion]) {
    if (discount !== null && (!Number.isInteger(discount.amountMinor) || discount.amountMinor < 0)) {
      throw new DomainError('VALIDATION_FAILED', 'Discount amounts must be non-negative integers.');
    }
  }
  if (
    !Number.isInteger(input.surgeMilli) ||
    input.surgeMilli < SURGE_MIN_MILLI ||
    input.surgeMilli > SURGE_MAX_MILLI
  ) {
    throw new DomainError('VALIDATION_FAILED', 'Surge multiplier must be between 1.00 and 1.80.', {
      surgeMilli: input.surgeMilli,
    });
  }

  const rates = input.catalog;
  const meteredNumerator =
    rates.baseMinor * SCALE +
    input.distanceMeters * rates.perKmMinor * 60 +
    input.durationSeconds * rates.perMinMinor * 1000;
  const flooredNumerator = Math.max(meteredNumerator, rates.minimumMinor * SCALE);
  const surgedNumerator = Math.round((flooredNumerator * input.surgeMilli) / 1000);

  const billableWaitingSeconds = Math.max(0, input.waitingSeconds - FREE_WAITING_SECONDS);
  const waitingNumerator = billableWaitingSeconds * rates.waitingPerMinMinor * 1000;

  const preDiscountNumerator = surgedNumerator + input.tollsMinor * SCALE + waitingNumerator;
  let discountsNumerator =
    (input.coupon?.amountMinor ?? 0) * SCALE + (input.automaticPromotion?.amountMinor ?? 0) * SCALE;
  if (discountsNumerator > preDiscountNumerator) discountsNumerator = preDiscountNumerator;

  const round = (numerator: number): number => Math.round(numerator / SCALE);
  const subtotal = moneyMinor(round(surgedNumerator), PRICING_CURRENCY);
  const tolls = moneyMinor(input.tollsMinor, PRICING_CURRENCY);
  const waiting = moneyMinor(round(waitingNumerator), PRICING_CURRENCY);
  const discounts = moneyMinor(round(discountsNumerator), PRICING_CURRENCY);
  const total = moneyMinor(round(preDiscountNumerator - discountsNumerator), PRICING_CURRENCY);

  return {
    category: input.category,
    origin: input.origin,
    destination: input.destination,
    subtotal,
    surgeMilli: input.surgeMilli,
    tolls,
    waiting,
    discounts,
    total,
    calculationVersion: PRICING_CALCULATION_VERSION,
    policySnapshot: { ...rates },
    quotedAt: now,
    expiresAt: new Date(now.getTime() + QUOTE_TTL_SECONDS * 1000),
  };
}

/** DEC-PRICE-009: cotação expira em 2 min ou se origem/destino mudarem. */
export function isQuoteValidFor(quote: FareQuote, origin: string, destination: string, now: Date): boolean {
  return quote.origin === origin && quote.destination === destination && now.getTime() <= quote.expiresAt.getTime();
}

function assertNonNegativeInt(value: number, field: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new DomainError('VALIDATION_FAILED', `${field} must be a non-negative integer.`, { field });
  }
}
