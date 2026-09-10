import { describe, expect, it } from 'vitest';
import { StripeProvider } from '../../src/infrastructure/payments/stripe-provider.js';

function fakeClient() {
  const calls: Array<{ params: unknown; opts: unknown }> = [];
  return {
    calls,
    paymentIntents: {
      create: async (params: unknown, opts: unknown) => {
        calls.push({ params, opts });
        return { id: 'pi_test_123', client_secret: 'pi_test_123_secret_abc' };
      },
    },
    webhooks: {
      constructEvent: (raw: string, sig: string, secret: string) => {
        if (sig !== 'valid-sig' || secret !== 'whsec_test') throw new Error('bad signature');
        return { id: 'evt_test', type: 'payment_intent.succeeded', data: raw };
      },
    },
  };
}

describe('StripeProvider', () => {
  it('cria PaymentIntent Pix em BRL com metadata e idempotency key', async () => {
    const client = fakeClient();
    const provider = new StripeProvider('sk_test_x', 'whsec_test', client as never);
    const order = await provider.createPixOrder({
      tenantId: 'tenant-a',
      rideId: 'ride-1',
      amountMinor: 2500,
      idempotencyKey: 'idem-1',
    });
    expect(order.providerReference).toBe('pi_test_123');
    expect(order.clientSecret).toBe('pi_test_123_secret_abc');
    const { params, opts } = client.calls[0] as {
      params: Record<string, unknown>;
      opts: Record<string, unknown>;
    };
    expect(params.amount).toBe(2500);
    expect(params.currency).toBe('brl');
    expect(params.payment_method_types).toEqual(['pix']);
    expect(params.metadata).toEqual({ tenantId: 'tenant-a', rideId: 'ride-1' });
    expect(opts.idempotencyKey).toBe('idem-1');
  });

  it('rejeita valor não positivo antes de qualquer chamada', async () => {
    const client = fakeClient();
    const provider = new StripeProvider('sk_test_x', 'whsec_test', client as never);
    await expect(
      provider.createPixOrder({ tenantId: 't', rideId: 'r', amountMinor: 0, idempotencyKey: 'k' }),
    ).rejects.toMatchObject({ code: 'VALIDATION_FAILED' });
    expect(client.calls).toHaveLength(0);
  });

  it('exige credenciais no construtor', () => {
    expect(() => new StripeProvider('', 'whsec_test')).toThrow('requires secretKey');
    expect(() => new StripeProvider('sk_test_x', '')).toThrow('requires secretKey');
  });

  it('verifica assinatura stripe-signature; recusa ausente ou inválida', () => {
    const provider = new StripeProvider('sk_test_x', 'whsec_test', fakeClient() as never);
    expect(provider.verifyWebhookSignature('{}', { 'stripe-signature': 'valid-sig' })).toBe(true);
    expect(provider.verifyWebhookSignature('{}', { 'stripe-signature': 'forged' })).toBe(false);
    expect(provider.verifyWebhookSignature('{}', {})).toBe(false);
  });
});
