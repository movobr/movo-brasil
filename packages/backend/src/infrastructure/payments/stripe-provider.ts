import Stripe from 'stripe';
import { DomainError } from '../../domain/errors.js';
import type {
  PaymentProvider,
  PixOrder,
  PixOrderInput,
} from '../../application/payment-service.js';

/**
 * Provedor Stripe (15, Owner DECIDED — substitui Mercado Pago).
 * Pix via PaymentIntent (`payment_method_types: ['pix']`); o client
 * confirma com o client_secret e extrai o BR Code do next_action.
 * Webhook: assinatura `stripe-signature` com o endpoint secret (whsec_).
 * Cliente Stripe injetável para testes sem rede.
 */
export class StripeProvider implements PaymentProvider {
  private readonly stripe: Pick<Stripe, 'paymentIntents' | 'webhooks'>;

  constructor(
    secretKey: string,
    private readonly webhookSecret: string,
    client?: Pick<Stripe, 'paymentIntents' | 'webhooks'>,
  ) {
    if (secretKey.trim() === '' || webhookSecret.trim() === '') {
      throw new DomainError('VALIDATION_FAILED', 'Stripe requires secretKey and webhookSecret.');
    }
    this.stripe = client ?? (new Stripe(secretKey) as Pick<Stripe, 'paymentIntents' | 'webhooks'>);
  }

  async createPixOrder(input: PixOrderInput): Promise<PixOrder> {
    if (!Number.isInteger(input.amountMinor) || input.amountMinor <= 0) {
      throw new DomainError('VALIDATION_FAILED', 'Pix orders require a positive integer amount.');
    }
    const intent = await this.stripe.paymentIntents.create(
      {
        amount: input.amountMinor,
        currency: 'brl',
        payment_method_types: ['pix'],
        metadata: { tenantId: input.tenantId, rideId: input.rideId },
      },
      { idempotencyKey: input.idempotencyKey },
    );
    if (typeof intent.client_secret !== 'string' || intent.client_secret === '') {
      throw new DomainError('PERSISTENCE_FAILED', 'Stripe did not return a client_secret.');
    }
    return { providerReference: intent.id, qrData: '', clientSecret: intent.client_secret };
  }

  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string | undefined>,
  ): boolean {
    const signature = headers['stripe-signature'];
    if (signature === undefined || signature === '') return false;
    try {
      this.stripe.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
      return true;
    } catch {
      return false;
    }
  }
}
