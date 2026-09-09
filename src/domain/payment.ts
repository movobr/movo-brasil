import { DomainError } from './errors.js';

/**
 * Pagamento V1 — 15-PAYMENTS-CONTRACT + DEC-PAY-001..006.
 * Pix é pré-pagamento com expiração local de 10 min; cartão segue o fluxo
 * do provedor com status autoritativo no backend. Toda mutação exige
 * `X-Idempotency-Key`; estado do provedor nunca é substituído por
 * afirmação do cliente.
 */
export const PIX_INTENT_TTL_SECONDS = 600;
export const PAYMENTS_CURRENCY = 'BRL';

export type PaymentMethod = 'pix' | 'card';

export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'failed' | 'refund_pending' | 'refunded';

export interface PaymentIntentInit {
  id: string;
  tenantId: string;
  rideId: string;
  method: PaymentMethod;
  amountMinor: number;
  idempotencyKey: string;
  providerReference: string | null;
  now: Date;
}

export type WebhookOutcome = 'applied' | 'duplicate' | 'ignored-out-of-order';

export interface ProviderPaymentEvent {
  /** ID do evento no provedor (deduplicação). */
  readonly eventId: string;
  /** Status autoritativo informado pelo provedor. */
  readonly providerStatus: 'paid' | 'failed' | 'refunded';
  readonly signatureValid: boolean;
}

export class PaymentIntent {
  readonly id: string;
  readonly tenantId: string;
  readonly rideId: string;
  readonly method: PaymentMethod;
  readonly amountMinor: number;
  readonly currency = PAYMENTS_CURRENCY;
  readonly idempotencyKey: string;
  providerReference: string | null;
  status: PaymentStatus = 'pending';
  readonly createdAt: Date;
  readonly expiresAt: Date;
  private readonly seenEvents = new Set<string>();

  private constructor(init: PaymentIntentInit) {
    this.id = init.id;
    this.tenantId = init.tenantId;
    this.rideId = init.rideId;
    this.method = init.method;
    this.amountMinor = init.amountMinor;
    this.idempotencyKey = init.idempotencyKey;
    this.providerReference = init.providerReference;
    this.createdAt = init.now;
    this.expiresAt = new Date(init.now.getTime() + PIX_INTENT_TTL_SECONDS * 1000);
  }

  static create(init: PaymentIntentInit): PaymentIntent {
    if (!Number.isInteger(init.amountMinor) || init.amountMinor <= 0) {
      throw new DomainError('VALIDATION_FAILED', 'Payment amount must be a positive integer of minor units.');
    }
    if (init.idempotencyKey.trim() === '') {
      throw new DomainError('VALIDATION_FAILED', 'Payment mutations require an X-Idempotency-Key.');
    }
    return new PaymentIntent(init);
  }

  /** Expira o intent local após 10 min sem pagamento (15 §Pix flow). */
  expireIfLapsed(now: Date): boolean {
    if (this.status === 'pending' && now.getTime() > this.expiresAt.getTime()) {
      this.status = 'expired';
      return true;
    }
    return false;
  }

  /**
   * Consome evento de webhook: verifica assinatura, deduplica e reconcilia.
   * Tolera duplicatas e fora-de-ordem sem lançar (15 invariantes).
   */
  applyProviderEvent(event: ProviderPaymentEvent): WebhookOutcome {
    if (!event.signatureValid) {
      throw new DomainError('UNAUTHORIZED', 'Webhook signature verification failed.', {
        eventId: event.eventId,
      });
    }
    if (this.seenEvents.has(event.eventId)) return 'duplicate';
    this.seenEvents.add(event.eventId);

    if (event.providerStatus === 'paid' && this.status === 'pending') {
      this.status = 'paid';
      return 'applied';
    }
    if (event.providerStatus === 'failed' && this.status === 'pending') {
      this.status = 'failed';
      return 'applied';
    }
    if (event.providerStatus === 'refunded' && (this.status === 'paid' || this.status === 'refund_pending')) {
      this.status = 'refunded';
      return 'applied';
    }
    return 'ignored-out-of-order';
  }

  /** CXL-007: somente operação de backend autorizada cria o pedido de refund. */
  markRefundPending(): void {
    if (this.status !== 'paid') {
      throw new DomainError(
        'INVALID_TRANSITION',
        `Refund can only be requested from paid status (current: ${this.status}).`,
      );
    }
    this.status = 'refund_pending';
  }
}
