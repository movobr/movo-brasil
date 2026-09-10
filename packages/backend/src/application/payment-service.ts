import { DomainError } from '../domain/errors.js';
import { IdempotencyRegistry } from '../domain/idempotency.js';
import { compensate, postSettlement, splitFare, type LedgerEntry, type SettlementInput } from '../domain/ledger.js';
import { PaymentIntent, type ProviderPaymentEvent, type WebhookOutcome } from '../domain/payment.js';

/** Porta do provedor de pagamento (15). Implementação viva: Stripe (Owner DECIDED). */
export interface PixOrderInput {
  readonly tenantId: string;
  readonly rideId: string;
  readonly amountMinor: number;
  readonly idempotencyKey: string;
}

export interface PixOrder {
  readonly providerReference: string;
  readonly qrData: string;
  /**
   * Stripe: client_secret do PaymentIntent para o client confirmar e
   * extrair o BR Code do next_action. Provedores com QR direto usam ''.
   */
  readonly clientSecret: string | null;
}

export interface PaymentProvider {
  createPixOrder(input: PixOrderInput): Promise<PixOrder>;
  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string | undefined>,
    query?: Record<string, string | undefined>,
  ): boolean;
}

export interface PaymentStore {
  save(intent: PaymentIntent): Promise<void>;
  findById(id: string): Promise<PaymentIntent | null>;
  findByIdempotencyKey(key: string): Promise<PaymentIntent | null>;
  findByRideId(rideId: string): Promise<PaymentIntent[]>;
}

export interface LedgerStore {
  append(entry: LedgerEntry): Promise<void>;
  listByReference(reference: string): Promise<LedgerEntry[]>;
}

/**
 * Orquestração de pagamentos: intents idempotentes, webhooks verificados e
 * liquidação no ledger. Nenhum status do cliente é aceito como verdade.
 */
export class PaymentService {
  private readonly idempotency = new IdempotencyRegistry();

  constructor(
    private readonly provider: PaymentProvider,
    private readonly payments: PaymentStore,
    private readonly ledger: LedgerStore,
    private readonly clock: { now: () => Date } = { now: () => new Date() },
    private readonly newId: () => string,
  ) {}

  async createPixIntent(input: {
    id: string;
    tenantId: string;
    rideId: string;
    amountMinor: number;
    idempotencyKey: string;
  }): Promise<{ intent: PaymentIntent; qrData: string }> {
    const replay = await this.payments.findByIdempotencyKey(input.idempotencyKey);
    if (replay !== null) {
      throw new DomainError('CONFLICT', 'Idempotency key already used for another payment intent.', {
        idempotencyKey: input.idempotencyKey,
      });
    }
    const intent = PaymentIntent.create({ ...input, method: 'pix', providerReference: null, now: this.clock.now() });
    const order = await this.provider.createPixOrder({
      tenantId: input.tenantId,
      rideId: input.rideId,
      amountMinor: input.amountMinor,
      idempotencyKey: input.idempotencyKey,
    });
    intent.providerReference = order.providerReference;
    await this.payments.save(intent);
    return { intent, qrData: order.qrData };
  }

  async handleWebhook(
    paymentId: string,
    rawBody: string,
    headers: Record<string, string | undefined>,
    event: Omit<ProviderPaymentEvent, 'signatureValid'>,
    query: Record<string, string | undefined> = {},
  ): Promise<WebhookOutcome> {
    const signatureValid = this.provider.verifyWebhookSignature(rawBody, headers, query);
    const intent = await this.payments.findById(paymentId);
    if (intent === null) {
      throw new DomainError('NOT_FOUND', `Payment intent not found: ${paymentId}.`);
    }
    const outcome = intent.applyProviderEvent({ ...event, signatureValid });
    if (outcome === 'applied') {
      await this.payments.save(intent);
      if (intent.status === 'paid') {
        await this.settleRide(intent);
      }
    }
    return outcome;
  }

  private async settleRide(intent: PaymentIntent): Promise<void> {
    // Split sobre o bruto sem decomposição de descontos nesta fase: a base
    // elegível (descontos do tenant) chega com a cotação vinculada (Fase 7).
    const split = splitFare({ grossMinor: intent.amountMinor, tenantDiscountsMinor: 0, movoDiscountsMinor: 0 });
    const settlement: SettlementInput = {
      settlementId: `stl-${intent.id}`,
      tenantId: intent.tenantId,
      rideId: intent.rideId,
      currency: intent.currency,
      split,
      gatewayFeeMinor: 0,
      now: this.clock.now(),
    };
    for (const entry of postSettlement(settlement)) {
      await this.ledger.append(entry);
    }
  }

  async compensateEntry(entry: LedgerEntry): Promise<LedgerEntry> {
    const reversal = compensate(entry, `${entry.id}:reversal`, this.clock.now());
    await this.ledger.append(reversal);
    return reversal;
  }

  async findIntentsByRide(rideId: string): Promise<PaymentIntent[]> {
    return this.payments.findByRideId(rideId);
  }
}
