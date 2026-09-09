import { Subscription } from '../../domain/subscription.js';
import type { SubscriptionRepository } from '../../application/subscription-service.js';

/** Adaptador em memória — testes offline (38). */
export class InMemorySubscriptionRepository implements SubscriptionRepository {
  private readonly byId = new Map<string, Subscription>();

  async save(subscription: Subscription): Promise<void> {
    this.byId.set(subscription.id, subscription);
  }

  async findById(id: string): Promise<Subscription | null> {
    return this.byId.get(id) ?? null;
  }

  async findByTenantId(tenantId: string): Promise<Subscription | null> {
    for (const subscription of this.byId.values()) {
      if (subscription.tenantId === tenantId) return subscription;
    }
    return null;
  }
}
