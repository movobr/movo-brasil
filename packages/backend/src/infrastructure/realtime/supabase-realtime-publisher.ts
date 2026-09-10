import { DomainError } from '../../domain/errors.js';
import type { DomainEvent, EventPublisher } from '../../application/event-ports.js';

/**
 * Transporte vivo Supabase Realtime (17-REALTIME-EVENTS, DEC-RT-001).
 * Publica cada evento de domínio como broadcast no canal do agregado
 * (`movo:{tenant}:{aggregateType}:{aggregateId}`), com o eventType
 * como nome do evento. Cliente Realtime injetável para testes.
 */
export interface RealtimeChannel {
  send(message: { type: 'broadcast'; event: string; payload: Record<string, unknown> }): Promise<string>;
}

export interface RealtimeClient {
  channel(name: string): RealtimeChannel;
}

function channelFor(event: DomainEvent): string {
  const tenant = event.tenantId ?? 'platform';
  return `movo:${tenant}:${event.aggregateType}:${event.aggregateId}`;
}

function toPayload(event: DomainEvent): Record<string, unknown> {
  return {
    eventId: event.eventId,
    eventType: event.eventType,
    version: event.version,
    occurredAt: event.occurredAt.toISOString(),
    tenantId: event.tenantId,
    aggregateType: event.aggregateType,
    aggregateId: event.aggregateId,
    correlationId: event.correlationId,
    payload: event.payload,
  };
}

export class SupabaseRealtimePublisher implements EventPublisher {
  constructor(private readonly client: RealtimeClient) {
    if (client === undefined || client === null) {
      throw new DomainError('VALIDATION_FAILED', 'Realtime publisher requires a client.');
    }
  }

  async publish(event: DomainEvent): Promise<void> {
    const status = await this.client
      .channel(channelFor(event))
      .send({ type: 'broadcast', event: event.eventType, payload: toPayload(event) });
    if (status !== 'ok') {
      throw new DomainError('PERSISTENCE_FAILED', `Realtime broadcast returned ${status}.`);
    }
  }
}
