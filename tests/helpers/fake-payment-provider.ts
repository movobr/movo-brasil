import type {
  PaymentProvider,
  PixOrder,
  PixOrderInput,
} from '../../src/application/payment-service.js';

/** Double de teste: sem rede, comportamento determinístico. */
export class FakePaymentProvider implements PaymentProvider {
  public signatureValid = true;
  public orders: PixOrderInput[] = [];

  async createPixOrder(input: PixOrderInput): Promise<PixOrder> {
    this.orders.push(input);
    return { providerReference: `mp-${input.rideId}`, qrData: `qr:${input.rideId}` };
  }

  verifyWebhookSignature(): boolean {
    return this.signatureValid;
  }
}
