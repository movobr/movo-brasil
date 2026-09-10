import { describe, expect, it } from 'vitest';
import type { DomainEvent } from '../../src/application/event-ports.js';
import { SupabaseRealtimePublisher } from '../../src/infrastructure/realtime/supabase-realtime-publisher.js';

const EVENT: DomainEvent = {
  eventId: 'evt-1',
  eventType: 'ride.requested.v1',
  version: 1,
  occurredAt: new Date('2026-09-10T12:00:00.000Z'),
  tenantId: 'tenant-a',
  aggregateType: 'ride',
  aggregateId: 'ride-1',
  correlationId: 'corr-1',
  payload: { origin: 'Paulista' },
};

describe('SupabaseRealtimePublisher', () => {
  it('publica no canal do agregado com o eventType como evento', async () => {
    const sent: Array<{ channel: string; event: string; payload: Record<string, unknown> }> = [];
    const publisher = new SupabaseRealtimePublisher({
      channel: (name: string) => ({
        send: async (message: { type: string; event: string; payload: Record<string, unknown> }) => {
          sent.push({ channel: name, event: message.event, payload: message.payload });
          return 'ok';
        },
      }),
    });
    await publisher.publish(EVENT);
    expect(sent).toHaveLength(1);
    expect(sent[0]?.channel).toBe('movo:tenant-a:ride:ride-1');
    expect(sent[0]?.event).toBe('ride.requested.v1');
    expect(sent[0]?.payload).toMatchObject({ eventId: 'evt-1', correlationId: 'corr-1' });
  });

  it('usa escopo platform sem tenant e falha em status != ok', async () => {
    const names: string[] = [];
    const publisher = new SupabaseRealtimePublisher({
      channel: (name: string) => {
        names.push(name);
        return { send: async () => 'timed out' };
      },
    });
    await expect(publisher.publish({ ...EVENT, tenantId: null })).rejects.toMatchObject({
      code: 'PERSISTENCE_FAILED',
    });
    expect(names[0]).toBe('movo:platform:ride:ride-1');
  });
});
