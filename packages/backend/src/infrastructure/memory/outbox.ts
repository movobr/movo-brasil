import type { OutboxEvent, OutboxStatus, OutboxStore } from '../../domain/outbox.js';

/** Adaptador em memória — testes offline (38). */
export class InMemoryOutboxStore implements OutboxStore {
  private readonly events = new Map<string, OutboxEvent & { status: OutboxStatus; attempts: number }>();

  async append(event: OutboxEvent): Promise<void> {
    if (!this.events.has(event.id)) {
      this.events.set(event.id, { ...event, status: 'pending', attempts: 0 });
    }
  }

  async listPending(limit: number): Promise<OutboxEvent[]> {
    return [...this.events.values()].filter((e) => e.status === 'pending').slice(0, limit);
  }

  async markDispatched(id: string): Promise<void> {
    const event = this.events.get(id);
    if (event !== undefined) event.status = 'dispatched';
  }

  async markFailed(id: string): Promise<void> {
    const event = this.events.get(id);
    if (event !== undefined) {
      event.status = 'failed';
      event.attempts += 1;
    }
  }
}
