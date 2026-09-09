import {
  InvalidWebhookSignatureError,
  MercadoPagoConfig,
  Payment,
  WebhookSignatureValidator,
} from 'mercadopago';
import { DomainError } from '../../domain/errors.js';
import type {
  PaymentProvider,
  PixOrder,
  PixOrderInput,
} from '../../application/payment-service.js';

export interface MercadoPagoOptions {
  readonly notificationUrl?: string;
  readonly statementDescriptor?: string;
  readonly toleranceSeconds?: number;
}

/**
 * Provedor vivo Mercado Pago (DEC-PAY-001). Assinatura de webhook validada
 * pelo validador oficial do SDK (x-signature/HMAC, anti-replay por
 * tolerância). Fonte de verdade monetária continua em centavos no domínio;
 * a conversão para decimal ocorre somente na borda do provedor.
 */
export class MercadoPagoProvider implements PaymentProvider {
  private readonly payments: Payment;
  private readonly toleranceSeconds: number;

  constructor(
    accessToken: string,
    private readonly webhookSecret: string,
    private readonly options: MercadoPagoOptions = {},
  ) {
    if (accessToken.trim() === '' || webhookSecret.trim() === '') {
      throw new DomainError('VALIDATION_FAILED', 'Mercado Pago requires accessToken and webhookSecret.');
    }
    this.payments = new Payment(new MercadoPagoConfig({ accessToken }));
    this.toleranceSeconds = options.toleranceSeconds ?? 300;
  }

  async createPixOrder(input: PixOrderInput): Promise<PixOrder> {
    const result = await this.payments.create({
      body: {
        transaction_amount: Number((input.amountMinor / 100).toFixed(2)),
        description: `MOVO ride ${input.rideId}`,
        payment_method_id: 'pix',
        metadata: { ride_id: input.rideId, tenant_id: input.tenantId },
        ...(this.options.notificationUrl !== undefined
          ? { notification_url: this.options.notificationUrl }
          : {}),
        ...(this.options.statementDescriptor !== undefined
          ? { statement_descriptor: this.options.statementDescriptor }
          : {}),
      },
      requestOptions: { idempotencyKey: input.idempotencyKey },
    });
    const qrCode = result.point_of_interaction?.transaction_data?.qr_code;
    if (result.id === undefined || qrCode === undefined) {
      throw new DomainError('PERSISTENCE_FAILED', 'Mercado Pago did not return a Pix order reference.');
    }
    return { providerReference: String(result.id), qrData: qrCode };
  }

  verifyWebhookSignature(
    rawBody: string,
    headers: Record<string, string | undefined>,
    query: Record<string, string | undefined> = {},
  ): boolean {
    void rawBody;
    const lowered: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(headers)) lowered[key.toLowerCase()] = value;
    try {
      WebhookSignatureValidator.validate({
        xSignature: lowered['x-signature'],
        xRequestId: lowered['x-request-id'],
        dataId: query['data.id'],
        secret: this.webhookSecret,
        toleranceSeconds: this.toleranceSeconds,
      });
      return true;
    } catch (error) {
      if (error instanceof InvalidWebhookSignatureError) return false;
      throw error;
    }
  }
}
