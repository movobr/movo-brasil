import { DomainError } from './errors.js';

/**
 * Ledger financeiro — 57-FINANCIAL-LEDGER + DEC-FIN-001..004.
 * Lançamentos imutáveis + estornos por compensação; SaaS e corridas em
 * ledgers logicamente separados; UI nunca escreve verdade contábil.
 */
export type LedgerKind = 'ride' | 'saas';
export type LedgerDirection = 'credit' | 'debit';

export interface LedgerEntry {
  readonly id: string;
  readonly ledger: LedgerKind;
  readonly tenantId: string | null;
  readonly currency: string;
  readonly amountMinor: number;
  readonly direction: LedgerDirection;
  readonly source: string;
  readonly reference: string;
  readonly idempotencyKey: string | null;
  readonly reversesEntryId: string | null;
  readonly createdAt: Date;
}

export interface SplitInput {
  /** Bruto pré-descontos, em centavos. */
  readonly grossMinor: number;
  /** Descontos financiados pelo tenant (reduzem a base do motorista). */
  readonly tenantDiscountsMinor: number;
  /** Descontos patrocinados pelo MOVO (NÃO reduzem a base — DEC-FIN-001). */
  readonly movoDiscountsMinor: number;
}

export interface SplitResult {
  readonly driverMinor: number;
  readonly tenantMinor: number;
  readonly movoMinor: number;
}

/**
 * Split padrão V1 80/17/3 sobre o fare elegível antes de descontos
 * financiados pelo tenant (DEC-FIN-001). Aritmética inteira: motorista e
 * tenant por quociente, resto absorvido pelo MOVO — a soma é exata.
 */
export function splitFare(input: SplitInput): SplitResult {
  for (const [field, value] of Object.entries(input)) {
    if (!Number.isInteger(value) || (value as number) < 0) {
      throw new DomainError('VALIDATION_FAILED', `${field} must be a non-negative integer.`, { field });
    }
  }
  const eligibleBase = input.grossMinor - input.tenantDiscountsMinor;
  if (eligibleBase < 0) {
    throw new DomainError('VALIDATION_FAILED', 'Tenant discounts cannot exceed the gross fare.');
  }
  const driverMinor = Math.floor((eligibleBase * 80) / 100);
  const tenantMinor = Math.floor((eligibleBase * 17) / 100);
  const movoMinor = eligibleBase - driverMinor - tenantMinor;
  return { driverMinor, tenantMinor, movoMinor };
}

export interface SettlementInput {
  readonly settlementId: string;
  readonly tenantId: string;
  readonly rideId: string;
  readonly currency: string;
  readonly split: SplitResult;
  /** Taxa do gateway: despesa do tenant, não reduz o motorista (DEC-FIN-002). */
  readonly gatewayFeeMinor: number;
  readonly now: Date;
}

/**
 * Liquidação ledger-driven e idempotente (DEC-FIN-003): 3 créditos do split
 * + débito da taxa do gateway no tenant. Chaves de idempotência
 * determinísticas por settlement permitem reexecução segura.
 */
export function postSettlement(input: SettlementInput): LedgerEntry[] {
  if (!Number.isInteger(input.gatewayFeeMinor) || input.gatewayFeeMinor < 0) {
    throw new DomainError('VALIDATION_FAILED', 'Gateway fee must be a non-negative integer.');
  }
  const entry = (
    party: string,
    direction: LedgerDirection,
    amountMinor: number,
    source: string,
  ): LedgerEntry => ({
    id: `${input.settlementId}:${party}`,
    ledger: 'ride',
    tenantId: input.tenantId,
    currency: input.currency,
    amountMinor,
    direction,
    source,
    reference: input.rideId,
    idempotencyKey: `${input.settlementId}:${party}`,
    reversesEntryId: null,
    createdAt: input.now,
  });
  return [
    entry('driver', 'credit', input.split.driverMinor, 'ride.settlement.driver'),
    entry('tenant', 'credit', input.split.tenantMinor, 'ride.settlement.tenant'),
    entry('movo', 'credit', input.split.movoMinor, 'ride.settlement.movo'),
    entry('tenant-gateway-fee', 'debit', input.gatewayFeeMinor, 'ride.settlement.gateway_fee'),
  ];
}

/** Estorno por compensação: nunca muta o fato histórico (57). */
export function compensate(entry: LedgerEntry, id: string, now: Date): LedgerEntry {
  return {
    id,
    ledger: entry.ledger,
    tenantId: entry.tenantId,
    currency: entry.currency,
    amountMinor: entry.amountMinor,
    direction: entry.direction === 'credit' ? 'debit' : 'credit',
    source: `${entry.source}.reversal`,
    reference: entry.reference,
    idempotencyKey: `${entry.id}:reversal`,
    reversesEntryId: entry.id,
    createdAt: now,
  };
}
