import { DomainError } from './errors.js';

/**
 * Dinheiro em unidades menores inteiras + moeda explícita (00 §9, 11).
 * Nenhum float binário é fonte de verdade: o valor é sempre inteiro.
 */
export interface MoneyMinor {
  readonly amountMinor: number;
  readonly currency: string;
}

export function moneyMinor(amountMinor: number, currency: string): MoneyMinor {
  if (!Number.isInteger(amountMinor)) {
    throw new DomainError('VALIDATION_FAILED', 'Money must be an integer number of minor units.', {
      amountMinor,
    });
  }
  if (currency.trim() === '') {
    throw new DomainError('VALIDATION_FAILED', 'Money requires an explicit currency.');
  }
  return { amountMinor, currency };
}

export function addMoney(a: MoneyMinor, b: MoneyMinor): MoneyMinor {
  assertSameCurrency(a, b);
  return { amountMinor: a.amountMinor + b.amountMinor, currency: a.currency };
}

function assertSameCurrency(a: MoneyMinor, b: MoneyMinor): void {
  if (a.currency !== b.currency) {
    throw new DomainError('VALIDATION_FAILED', 'Cannot mix currencies.', {
      left: a.currency,
      right: b.currency,
    });
  }
}
