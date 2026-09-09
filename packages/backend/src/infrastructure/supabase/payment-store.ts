import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '../../domain/errors.js';
import { PaymentIntent, type PaymentMethod, type PaymentStatus } from '../../domain/payment.js';
import type { PaymentStore } from '../../application/payment-service.js';

/** Persistência de intents, fiel ao contrato 11 (migration 0002). */
interface PaymentRow {
  id: string;
  tenant_id: string;
  ride_id: string | null;
  method: string;
  provider: string;
  provider_reference: string | null;
  status: string;
  amount_minor: number;
  currency: string;
  idempotency_key: string;
  created_at: string;
  updated_at: string;
}

function toIntent(row: PaymentRow): PaymentIntent {
  const intent = PaymentIntent.create({
    id: row.id,
    tenantId: row.tenant_id,
    rideId: row.ride_id ?? '',
    method: row.method as PaymentMethod,
    amountMinor: row.amount_minor,
    idempotencyKey: row.idempotency_key,
    providerReference: row.provider_reference,
    now: new Date(row.created_at),
  });
  intent.status = row.status as PaymentStatus;
  return intent;
}

function fail(context: string, message: string): never {
  throw new DomainError('PERSISTENCE_FAILED', `${context}: ${message}`);
}

export class SupabasePaymentStore implements PaymentStore {
  constructor(private readonly db: SupabaseClient) {}

  async save(intent: PaymentIntent): Promise<void> {
    const { error } = await this.db.from('payments').upsert(
      {
        id: intent.id,
        tenant_id: intent.tenantId,
        ride_id: intent.rideId,
        method: intent.method,
        provider: 'mercado_pago',
        provider_reference: intent.providerReference,
        status: intent.status,
        amount_minor: intent.amountMinor,
        currency: intent.currency,
        idempotency_key: intent.idempotencyKey,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (error !== null) fail('Failed to save payment', error.message);
  }

  async findById(id: string): Promise<PaymentIntent | null> {
    const { data, error } = await this.db.from('payments').select('*').eq('id', id).maybeSingle();
    if (error !== null) fail('Failed to load payment', error.message);
    if (data === null) return null;
    return toIntent(data as PaymentRow);
  }

  async findByIdempotencyKey(key: string): Promise<PaymentIntent | null> {
    const { data, error } = await this.db.from('payments').select('*').eq('idempotency_key', key).maybeSingle();
    if (error !== null) fail('Failed to load payment', error.message);
    if (data === null) return null;
    return toIntent(data as PaymentRow);
  }

  async findByRideId(rideId: string): Promise<PaymentIntent[]> {
    const { data, error } = await this.db.from('payments').select('*').eq('ride_id', rideId);
    if (error !== null) fail('Failed to list payments', error.message);
    return ((data ?? []) as PaymentRow[]).map(toIntent);
  }
}
