import { PaymentIntent } from '../../domain/payment.js';
import type { LedgerEntry } from '../../domain/ledger.js';
import type { LedgerStore, PaymentStore } from '../../application/payment-service.js';

/** Armazenamento em memória — testes offline (38). */
export class InMemoryPaymentStore implements PaymentStore {
  private readonly byId = new Map<string, PaymentIntent>();

  async save(intent: PaymentIntent): Promise<void> {
    this.byId.set(intent.id, intent);
  }

  async findById(id: string): Promise<PaymentIntent | null> {
    return this.byId.get(id) ?? null;
  }

  async findByIdempotencyKey(key: string): Promise<PaymentIntent | null> {
    for (const intent of this.byId.values()) {
      if (intent.idempotencyKey === key) return intent;
    }
    return null;
  }

  async findByRideId(rideId: string): Promise<PaymentIntent[]> {
    return [...this.byId.values()].filter((intent) => intent.rideId === rideId);
  }
}

export class InMemoryLedgerStore implements LedgerStore {
  private readonly entries: LedgerEntry[] = [];

  async append(entry: LedgerEntry): Promise<void> {
    if (this.entries.some((existing) => existing.id === entry.id)) return;
    this.entries.push(entry);
  }

  async listByReference(reference: string): Promise<LedgerEntry[]> {
    return this.entries.filter((entry) => entry.reference === reference);
  }
}
