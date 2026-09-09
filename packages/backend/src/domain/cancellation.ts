import { DomainError } from './errors.js';
import type { RideStatus } from './ride.js';

/**
 * Cancelamento e reembolso — DEC-CXL-001..007.
 * Taxas em centavos (00 §9). Reembolso nunca concluído pelo cliente (CXL-006):
 * a solicitação nasce `refund_pending` e só a reconciliação do provedor
 * (fase de pagamentos) a conclui.
 */
export const STANDARD_CANCELLATION_FEE_MINOR = 600;
export const POST_ARRIVAL_CANCELLATION_FEE_MINOR = 1000;
export const FREE_CANCELLATION_WINDOW_SECONDS = 120;

export type CancelledBy = 'passenger' | 'driver';

export interface CancellationAssessment {
  /** Status em que a corrida estava ao cancelar. */
  readonly status: RideStatus;
  readonly cancelledBy: CancelledBy;
  /** Instante da atribuição do motorista (null = sem atribuição). */
  readonly assignedAt: Date | null;
  readonly now: Date;
  /** Política excepcional aprovada p/ IN_PROGRESS (12). */
  readonly exceptionalApproval: boolean;
  readonly reason: string;
}

export interface CancellationOutcome {
  readonly feeMinor: number;
  readonly feeApplies: boolean;
  readonly driverPerformanceFlag: boolean;
}

/**
 * DEC-CXL-001: grátis antes da atribuição.
 * DEC-CXL-002/003: após atribuição, grátis por 2 min; depois R$ 6,00
 * com o motorista a caminho.
 * DEC-CXL-004: após chegada ao pickup, R$ 10,00.
 * DEC-CXL-005: cancelamento do motorista não cobra o passageiro; registra
 * motivo e sinaliza política de performance (aplicada na fase do motorista).
 */
export function assessCancellation(assessment: CancellationAssessment): CancellationOutcome {
  const { status, cancelledBy } = assessment;
  if (cancelledBy === 'driver') {
    return { feeMinor: 0, feeApplies: false, driverPerformanceFlag: true };
  }
  if (status === 'REQUESTED' || status === 'MATCHING' || assessment.assignedAt === null) {
    return { feeMinor: 0, feeApplies: false, driverPerformanceFlag: false };
  }
  if (status === 'DRIVER_ARRIVED') {
    return { feeMinor: POST_ARRIVAL_CANCELLATION_FEE_MINOR, feeApplies: true, driverPerformanceFlag: false };
  }
  if (status === 'IN_PROGRESS') {
    if (!assessment.exceptionalApproval) {
      throw new DomainError(
        'UNAUTHORIZED',
        'Cancellation from IN_PROGRESS requires an explicitly approved exceptional policy.',
      );
    }
    throw new DomainError(
      'VALIDATION_FAILED',
      'Cancellation from IN_PROGRESS has no approved fee rule (BLOCKED pending Owner decision).',
    );
  }
  const elapsedSeconds = Math.floor((assessment.now.getTime() - assessment.assignedAt.getTime()) / 1000);
  if (elapsedSeconds <= FREE_CANCELLATION_WINDOW_SECONDS) {
    return { feeMinor: 0, feeApplies: false, driverPerformanceFlag: false };
  }
  return { feeMinor: STANDARD_CANCELLATION_FEE_MINOR, feeApplies: true, driverPerformanceFlag: false };
}

export type RefundStatus = 'refund_pending';

export interface RefundRequest {
  readonly id: string;
  readonly rideId: string;
  readonly paymentId: string;
  readonly amountMinor: number;
  readonly currency: string;
  readonly status: RefundStatus;
  readonly requestedAt: Date;
}

/**
 * DEC-CXL-007: corrida pré-paga cancelada gera solicitação imediata de
 * refund quando elegível; permanece `refund_pending` até confirmação do
 * provedor (fase de pagamentos — fora deste escopo).
 */
export function requestRefundForCancelledPrepaid(input: {
  id: string;
  rideId: string;
  paymentId: string;
  amountMinor: number;
  prepaid: boolean;
  now: Date;
}): RefundRequest | null {
  if (!input.prepaid) return null;
  if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
    throw new DomainError('VALIDATION_FAILED', 'Refund amount must be a positive integer of minor units.');
  }
  return {
    id: input.id,
    rideId: input.rideId,
    paymentId: input.paymentId,
    amountMinor: input.amountMinor,
    currency: 'BRL',
    status: 'refund_pending',
    requestedAt: input.now,
  };
}
