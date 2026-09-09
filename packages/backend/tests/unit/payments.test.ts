import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { DomainError } from '../../src/domain/errors.js';
import { PaymentService } from '../../src/application/payment-service.js';
import { InMemoryLedgerStore, InMemoryPaymentStore } from '../../src/infrastructure/memory/payments.js';
import { FakePaymentProvider } from '../helpers/fake-payment-provider.js';

const NOW = new Date('2026-09-09T12:00:00.000Z');
const LATER = new Date(NOW.getTime() + 11 * 60 * 1000);

function setup() {
  const provider = new FakePaymentProvider();
  const payments = new InMemoryPaymentStore();
  const ledger = new InMemoryLedgerStore();
  const service = new PaymentService(provider, payments, ledger, { now: () => NOW }, randomUUID);
  return { provider, payments, ledger, service };
}

async function pixIntent(service: PaymentService) {
  return service.createPixIntent({
    id: 'pay-1',
    tenantId: 'tenant-a',
    rideId: 'ride-1',
    amountMinor: 2800,
    idempotencyKey: 'key-1',
  });
}

describe('payments V1 (15/DEC-PAY)', () => {
  it('creates Pix intents with idempotency key and 10 min expiry', async () => {
    const { service, provider } = setup();
    const { intent, qrData } = await pixIntent(service);
    expect(intent.status).toBe('pending');
    expect(intent.expiresAt.getTime() - NOW.getTime()).toBe(600000);
    expect(qrData).toBe('qr:ride-1');
    expect(provider.orders).toHaveLength(1);
    expect(intent.providerReference).toBe('mp-ride-1');
  });

  it('rejects idempotency-key reuse on creation', async () => {
    const { service } = setup();
    await pixIntent(service);
    await expect(
      service.createPixIntent({ id: 'pay-2', tenantId: 'tenant-a', rideId: 'ride-2', amountMinor: 100, idempotencyKey: 'key-1' }),
    ).rejects.toMatchObject({ code: 'CONFLICT' });
  });

  it('expires lapsed intents and refuses late paid events', async () => {
    const { payments, service } = setup();
    const { intent } = await pixIntent(service);
    expect(intent.expireIfLapsed(LATER)).toBe(true);
    expect(intent.status).toBe('expired');
    await payments.save(intent);
    const outcome = await service.handleWebhook('pay-1', '{}', {}, { eventId: 'evt-late', providerStatus: 'paid' });
    expect(outcome).toBe('ignored-out-of-order');
    expect((await payments.findById('pay-1'))?.status).toBe('expired');
  });

  it('applies paid webhooks once, then settles the ride ledger', async () => {
    const { service, ledger } = setup();
    await pixIntent(service);
    const first = await service.handleWebhook('pay-1', '{}', {}, { eventId: 'evt-1', providerStatus: 'paid' });
    expect(first).toBe('applied');
    const second = await service.handleWebhook('pay-1', '{}', {}, { eventId: 'evt-1', providerStatus: 'paid' });
    expect(second).toBe('duplicate');
    const entries = await ledger.listByReference('ride-1');
    // 3 créditos do split + débito da taxa do gateway.
    expect(entries).toHaveLength(4);
    const total = entries.reduce((sum, e) => sum + (e.direction === 'credit' ? e.amountMinor : -e.amountMinor), 0);
    expect(total).toBe(2800);
  });

  it('rejects unsigned webhooks without mutating state', async () => {
    const { provider, service, payments } = setup();
    await pixIntent(service);
    provider.signatureValid = false;
    await expect(service.handleWebhook('pay-1', '{}', {}, { eventId: 'evt-x', providerStatus: 'paid' })).rejects.toMatchObject({
      code: 'UNAUTHORIZED',
    });
    expect((await payments.findById('pay-1'))?.status).toBe('pending');
  });

  it('moves paid intents to refund_pending only from backend flow', async () => {
    const { payments, service } = setup();
    const { intent } = await pixIntent(service);
    expect(() => intent.markRefundPending()).toThrowError(DomainError);
    await service.handleWebhook('pay-1', '{}', {}, { eventId: 'evt-1', providerStatus: 'paid' });
    const paid = await payments.findById('pay-1');
    paid?.markRefundPending();
    expect(paid?.status).toBe('refund_pending');
    await payments.save(paid!);
    const confirmed = await service.handleWebhook('pay-1', '{}', {}, { eventId: 'evt-2', providerStatus: 'refunded' });
    expect(confirmed).toBe('applied');
    expect((await payments.findById('pay-1'))?.status).toBe('refunded');
  });
});
