/**
 * Outbox transacional — 17 + DEC-RT-002. Mudanças de domínio que precisam
 * publicar eventos registram OutboxEvent junto à transação; o dispatcher
 * entrega com deduplicação por eventId (consumidores idempotentes).
 * Tabela SQL adiada (fora do 11 — mesma classe de UNSPECIFIED-002).
 */
export type OutboxStatus = 'pending' | 'dispatched' | 'failed';

export interface OutboxEvent {
  readonly id: string;
  readonly eventType: string;
  readonly tenantId: string | null;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly correlationId: string;
  readonly payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  readonly createdAt: Date;
}

export interface OutboxStore {
  append(event: OutboxEvent): Promise<void>;
  listPending(limit: number): Promise<OutboxEvent[]>;
  markDispatched(id: string): Promise<void>;
  markFailed(id: string): Promise<void>;
}

export interface DomainConsumer {
  readonly eventType: string;
  handle(event: OutboxEvent): Promise<void>;
}

/** Dispatcher com dedupe: o mesmo eventId nunca é entregue duas vezes. */
export class OutboxDispatcher {
  private readonly delivered = new Set<string>();

  constructor(private readonly maxAttempts = 5) {}

  async dispatch(store: OutboxStore, consumers: ReadonlyArray<DomainConsumer>, batchSize = 50): Promise<number> {
    const pending = await store.listPending(batchSize);
    let delivered = 0;
    for (const event of pending) {
      if (this.delivered.has(event.id)) {
        await store.markDispatched(event.id);
        continue;
      }
      const consumer = consumers.find((c) => c.eventType === event.eventType);
      if (consumer === undefined) {
        await store.markFailed(event.id);
        continue;
      }
      try {
        await consumer.handle(event);
        this.delivered.add(event.id);
        await store.markDispatched(event.id);
        delivered += 1;
      } catch {
        if (event.attempts + 1 >= this.maxAttempts) {
          await store.markFailed(event.id);
        }
      }
    }
    return delivered;
  }
}
