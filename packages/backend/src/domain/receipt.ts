import { DomainError } from './errors.js';
import { splitFare, type SplitResult } from './ledger.js';
import type { PaymentMethod, PaymentStatus } from './payment.js';

/**
 * Recibo do passageiro — 26-9, cadeia 42 (Completion → … → Receipt).
 * Read-model puro e determinístico: compõe apenas dados decididos
 * (tarifa cotada, split 80/17/3, estado do pagamento). Sem comportamento
 * novo, sem moeda inventada: tudo em centavos, mesmos tipos do ledger.
 */
export interface ReceiptInput {
  readonly rideId: string;
  readonly tenantId: string;
  readonly rideStatus: string;
  readonly quotedMinor: number;
  readonly tenantDiscountsMinor: number;
  readonly movoDiscountsMinor: number;
  readonly paymentMethod: PaymentMethod | null;
  readonly paymentStatus: PaymentStatus | null;
  readonly paidMinor: number | null;
  readonly completedAt: Date | null;
}

export interface Receipt {
  readonly rideId: string;
  readonly tenantId: string;
  readonly quotedMinor: number;
  readonly split: SplitResult;
  readonly movoDiscountsMinor: number;
  readonly paymentMethod: PaymentMethod | null;
  readonly paymentStatus: PaymentStatus | null;
  readonly paidMinor: number | null;
  readonly completedAt: Date;
}

export function buildReceipt(input: ReceiptInput): Receipt {
  if (input.rideStatus !== 'COMPLETED') {
    throw new DomainError('VALIDATION_FAILED', 'Receipts exist only for completed rides.');
  }
  if (input.completedAt === null) {
    throw new DomainError('VALIDATION_FAILED', 'Completed rides require a completion timestamp.');
  }
  const split = splitFare({
    grossMinor: input.quotedMinor,
    tenantDiscountsMinor: input.tenantDiscountsMinor,
    movoDiscountsMinor: input.movoDiscountsMinor,
  });
  return {
    rideId: input.rideId,
    tenantId: input.tenantId,
    quotedMinor: input.quotedMinor,
    split,
    movoDiscountsMinor: input.movoDiscountsMinor,
    paymentMethod: input.paymentMethod,
    paymentStatus: input.paymentStatus,
    paidMinor: input.paidMinor,
    completedAt: input.completedAt,
  };
}
