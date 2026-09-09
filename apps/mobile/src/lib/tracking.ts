import { classifyFreshness } from '@movo/brasil/src/domain/driver-location.js';
import { buildReceipt } from '@movo/brasil/src/domain/receipt.js';

/**
 * Lógica de apresentação do tracking — 21 (áreas 7/8/9/10/11).
 * Estados e recibo usam os motores do backend; posição do motorista
 * exibe aviso de stale pela regra contratada (16: >20 s).
 */
export type TrackingStatus =
  | 'REQUESTED'
  | 'MATCHING'
  | 'ACCEPTED'
  | 'DRIVER_ARRIVING'
  | 'DRIVER_ARRIVED'
  | 'IN_PROGRESS'
  | 'COMPLETED'
  | 'CANCELLED';

const STEP_LABELS: Record<TrackingStatus, string> = {
  REQUESTED: 'Corrida solicitada',
  MATCHING: 'Buscando motorista…',
  ACCEPTED: 'Motorista a caminho',
  DRIVER_ARRIVING: 'Motorista a caminho',
  DRIVER_ARRIVED: 'Motorista chegou',
  IN_PROGRESS: 'Em viagem',
  COMPLETED: 'Concluída',
  CANCELLED: 'Cancelada',
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
  paymentMethod: 'pix' | 'card' | null;
  paymentStatus: 'pending' | 'paid' | 'failed' | 'expired' | 'refunded' | 'refund_pending' | null;
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
}

/** Total gasto em corridas concluídas (apresentação; autoridade no ledger). */
export function completedTotalMinor(entries: ReadonlyArray<HistoryEntry>): number {
  return entries
    .filter((entry) => entry.status === 'COMPLETED')
    .reduce((sum, entry) => sum + entry.quotedMinor, 0);
}
