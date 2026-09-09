import { classifyFreshness } from '@movo/brasil/src/domain/driver-location.js';
import { buildReceipt } from '@movo/brasil/src/domain/receipt.js';
import type { PaymentMethod, PaymentStatus } from '@movo/brasil/src/domain/payment.js';
import type { RideStatus } from '@movo/brasil/src/domain/ride.js';

/**
 * Lógica de apresentação do tracking — 21 (áreas 7/8/9/10/11).
 * Estados e recibo usam os motores do backend; posição do motorista
 * exibe aviso de stale pela regra contratada (16: >20 s).
 */

/** Espelha a tabela fechada 12: sem estados próprios no cliente. */
export type TrackingStatus = RideStatus;

const STEP_LABELS: Record<TrackingStatus, string> = {
  REQUESTED: 'Corrida solicitada',
  MATCHING: 'Buscando motorista…',
  ACCEPTED: 'Motorista a caminho',
  DRIVER_ARRIVING: 'Motorista a caminho',
  DRIVER_ARRIVED: 'Motorista chegou',
  IN_PROGRESS: 'Em viagem',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
  PAYMENT_PENDING: 'Processando pagamento…',
  PAID: 'Paga',
  PAYMENT_FAILED: 'Pagamento falhou',
};

export function stepLabel(status: TrackingStatus): string {
  return STEP_LABELS[status];
}

/** 16: posição do motorista além de 20 s não é exibida como atual. */
export function isDriverPositionStale(driverUpdatedAt: Date, now: Date): boolean {
  return classifyFreshness(driverUpdatedAt, now) !== 'fresh';
}

export interface TrackingReceiptInput {
  rideId: string;
  tenantId: string;
  quotedMinor: number;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus | null;
  paidMinor: number | null;
  completedAt: Date | null;
}

export function trackingReceipt(input: TrackingReceiptInput) {
  return buildReceipt({
    ...input,
    rideStatus: 'COMPLETED',
    tenantDiscountsMinor: 0,
    movoDiscountsMinor: 0,
  });
}

export type PaymentChoice = 'pix' | 'card';

/** Métodos contratados (15): Pix e cartão. Nada mais é oferecido. */
export const PAYMENT_CHOICES: ReadonlyArray<PaymentChoice> = ['pix', 'card'];

export function isPaymentChoice(value: string): value is PaymentChoice {
  return value === 'pix' || value === 'card';
}

export interface HistoryEntry {
  readonly rideId: string;
  readonly status: TrackingStatus;
  readonly quotedMinor: number;
  /** Valor pago (autoridade: ledger). Null = ainda não pago/desconhecido. */
  readonly paidMinor: number | null;
}

/** Total pago (apresentação; autoridade no ledger; cotação não é gasto). */
export function completedTotalMinor(entries: ReadonlyArray<HistoryEntry>): number {
  return entries
    .filter((entry) => entry.status === 'COMPLETED' || entry.status === 'PAID')
    .reduce((sum, entry) => sum + (entry.paidMinor ?? 0), 0);
}
