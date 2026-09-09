import { randomUUID } from 'node:crypto';
import { DomainError } from '../domain/errors.js';
import { PLANS, Subscription } from '../domain/subscription.js';
import { AuditEvent } from '../domain/audit.js';
import { authorize, type ActorContext } from '../domain/authorization.js';
import type { AuditEventRepository } from './repositories.js';
import type { LedgerStore } from './payment-service.js';
import type { LedgerEntry } from '../domain/ledger.js';

export const BILLING_PERMISSIONS = {
  subscriptionManage: 'subscription.manage',
  subscriptionRead: 'subscription.read',
} as const;

export interface SubscriptionRepository {
  save(subscription: Subscription): Promise<void>;
  findById(id: string): Promise<Subscription | null>;
  findByTenantId(tenantId: string): Promise<Subscription | null>;
}

/**
 * Billing SaaS (08/22/23): trial, planos, grace e cobrança — sempre no
 * ledger `saas`, separado do ledger de corridas (DEC-SaaS-007, 57).
 * Operações de plataforma exigem permissão explícita + auditoria (23).
 */
export class SubscriptionService {
  constructor(
    private readonly subscriptions: SubscriptionRepository,
    private readonly ledger: LedgerStore,
    private readonly audits: AuditEventRepository,
    private readonly clock: { now: () => Date } = { now: () => new Date() },
    private readonly newId: () => string = randomUUID,
  ) {}

  async startTrial(actor: ActorContext, tenantId: string): Promise<Subscription> {
    authorize(actor, BILLING_PERMISSIONS.subscriptionManage, tenantId);
    const existing = await this.subscriptions.findByTenantId(tenantId);
    if (existing !== null) {
      throw new DomainError('CONFLICT', 'Tenant already has a subscription.', { tenantId });
    }
    const subscription = Subscription.startTrial({ id: this.newId(), tenantId, now: this.clock.now() });
    await this.subscriptions.save(subscription);
    await this.recordAudit(actor, tenantId, 'subscription.trial_started', subscription.id, 'SUCCESS', {});
    return subscription;
  }

  async subscribe(actor: ActorContext, tenantId: string, planId: string): Promise<Subscription> {
    const subscription = await this.requireSubscription(actor, tenantId);
    subscription.recordPayment(planId, this.clock.now());
    await this.subscriptions.save(subscription);
    await this.postCharge(subscription, PLANS[planId]?.monthlyPriceMinor ?? 0);
    await this.recordAudit(actor, tenantId, 'subscription.subscribed', subscription.id, 'SUCCESS', { planId });
    return subscription;
  }

  async recordChargeFailure(actor: ActorContext, tenantId: string): Promise<Subscription> {
    const subscription = await this.requireSubscription(actor, tenantId);
    subscription.recordChargeFailure(this.clock.now());
    await this.subscriptions.save(subscription);
    await this.recordAudit(actor, tenantId, 'subscription.charge_failed', subscription.id, 'SUCCESS', {});
    return subscription;
  }

  /** Retorna o efeito do lapso (para o chamador suspender o tenant). */
  async lapse(actor: ActorContext, tenantId: string): Promise<'EXPIRED' | 'SUSPENDED' | null> {
    const subscription = await this.requireSubscription(actor, tenantId);
    const effect = subscription.lapse(this.clock.now());
    if (effect !== null) {
      await this.subscriptions.save(subscription);
      await this.recordAudit(actor, tenantId, 'subscription.lapsed', subscription.id, 'SUCCESS', { effect });
    }
    return effect;
  }

  async cancel(actor: ActorContext, tenantId: string): Promise<Subscription> {
    const subscription = await this.requireSubscription(actor, tenantId);
    subscription.transitionTo('CANCELLED', this.clock.now());
    await this.subscriptions.save(subscription);
    await this.recordAudit(actor, tenantId, 'subscription.cancelled', subscription.id, 'SUCCESS', {});
    return subscription;
  }

  async getSubscription(actor: ActorContext, tenantId: string): Promise<Subscription> {
    authorize(actor, BILLING_PERMISSIONS.subscriptionRead, tenantId);
    const subscription = await this.subscriptions.findByTenantId(tenantId);
    if (subscription === null) {
      throw new DomainError('NOT_FOUND', `Subscription not found for tenant: ${tenantId}.`);
    }
    return subscription;
  }

  private async requireSubscription(actor: ActorContext, tenantId: string): Promise<Subscription> {
    authorize(actor, BILLING_PERMISSIONS.subscriptionManage, tenantId);
    const subscription = await this.subscriptions.findByTenantId(tenantId);
    if (subscription === null) {
      throw new DomainError('NOT_FOUND', `Subscription not found for tenant: ${tenantId}.`);
    }
    return subscription;
  }

  private async postCharge(subscription: Subscription, amountMinor: number): Promise<void> {
    if (amountMinor <= 0) return;
    const now = this.clock.now();
    const chargeId = `saas-${subscription.id}-${now.getTime()}`;
    const debit: LedgerEntry = {
      id: `${chargeId}:tenant`,
      ledger: 'saas',
      tenantId: subscription.tenantId,
      currency: 'BRL',
      amountMinor,
      direction: 'debit',
      source: 'saas.subscription.charge',
      reference: subscription.id,
      idempotencyKey: `${chargeId}:tenant`,
      reversesEntryId: null,
      createdAt: now,
    };
    const credit: LedgerEntry = { ...debit, id: `${chargeId}:movo`, direction: 'credit', idempotencyKey: `${chargeId}:movo` };
    await this.ledger.append(debit);
    await this.ledger.append(credit);
  }

  private async recordAudit(
    actor: ActorContext,
    tenantScope: string,
    action: string,
    resourceId: string,
    result: 'SUCCESS' | 'DENIED' | 'FAILED',
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.audits.append(
      AuditEvent.record(
        { actorUserId: actor.userId, tenantScope, action, resourceType: 'subscription', resourceId, result, correlationId: actor.correlationId, metadata },
        { eventId: () => this.newId(), now: () => this.clock.now() },
      ),
    );
  }
}
