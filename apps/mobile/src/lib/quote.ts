import { DEFAULT_CATALOG, quoteFare, type FareQuote, type RideCategory } from '@movo/brasil/src/domain/pricing.js';

/**
 * Cotação no device com o MESMO motor do backend (14): nenhuma tarifa
 * autoritativa nasce aqui — o valor exibido é estimativa; o backend
 * recalcula e assina a cotação no requestRide.
 */
export function estimateFare(
  category: RideCategory,
  distanceMeters: number,
  durationSeconds: number,
  now: Date = new Date(),
): FareQuote {
  return quoteFare(
    {
      category,
      distanceMeters,
      durationSeconds,
      tollsMinor: 0,
      waitingSeconds: 0,
      coupon: null,
      automaticPromotion: null,
      surgeMilli: 1000,
      origin: 'device-origin',
      destination: 'device-destination',
      catalog: DEFAULT_CATALOG[category],
    },
    now,
  );
}

export function formatBrl(amountMinor: number): string {
  return `R$ ${(amountMinor / 100).toFixed(2).replace('.', ',')}`;
}
