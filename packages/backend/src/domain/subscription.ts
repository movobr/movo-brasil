import { DomainError } from './errors.js';

/**
 * Assinatura SaaS — 08-PLANS-BILLING + DEC-SaaS-001..007.
 * Planos, trial e grace vêm do registro de decisão; a tabela de transições
 * (exigida pelo 08 antes do código de billing) compõe mecanicamente esses
 * fatos — DERIVED-014, sem comportamento novo além do decidido.
 */
export const SUBSCRIPTION_STATUSES = ['TRIAL', 'ACTIVE', 'PAST_DUE', 'SUSPENDED', 'CANCELLED', 'EXPIRED'] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];

const SUBSCRIPTION_TRANSITIONS: Readonly<Record<SubscriptionStatus, ReadonlyArray<SubscriptionStatus>>> = {
  TRIAL: ['ACTIVE', 'EXPIRED', 'CANCELLED'],
  ACTIVE: ['PAST_DUE', 'SUSPENDED', 'CANCELLED'],
  PAST_DUE: ['ACTIVE', 'SUSPENDED', 'CANCELLED'],
  SUSPENDED: ['ACTIVE', 'CANCELLED'],
  CANCELLED: [],
  EXPIRED: [],
};

export interface PlanLimits {
  readonly planId: string;
  readonly monthlyPriceMinor: number;
  readonly maxDrivers: number;
  readonly maxRidesPerMonth: number;
  readonly maxAreas: number;
}

/** Catálogo V1 — DEC-SaaS-001..004 (centavos). */
export const PLANS: Readonly<Record<string, PlanLimits>> = {
  launch: { planId: 'launch', monthlyPriceMinor: 59900, maxDrivers: 100, maxRidesPerMonth: 10000, maxAreas: 1 },
  growth: { planId: 'growth', monthlyPriceMinor: 149900, maxDrivers: 500, maxRidesPerMonth: 50000, maxAreas: 5 },
  enterprise: { planId: 'enterprise', monthlyPriceMinor: 399900, maxDrivers: 2000, maxRidesPerMonth: 200000, maxAreas: 20 },
};

export const TRIAL_DAYS = 14;
export const TRIAL_MAX_DRIVERS = 50;
export const TRIAL_MAX_RIDES = 2000;
export const GRACE_DAYS = 7;

export interface SubscriptionInit {
  id: string;
  tenantId: string;
  now: Date;
}

export class Subscription {
  readonly id: string;
  readonly tenantId: string;
  planId: string;
  status: SubscriptionStatus = 'TRIAL';
  readonly trialEndsAt: Date;
  graceEndsAt: Date | null = null;
  readonly createdAt: Date;
  updatedAt: Date;

  private constructor(init: SubscriptionInit) {
    this.id = init.id;
    this.tenantId = init.tenantId;
    this.planId = 'launch';
    this.trialEndsAt = new Date(init.now.getTime() + TRIAL_DAYS * 24 * 3600 * 1000);
    this.createdAt = init.now;
    this.updatedAt = init.now;
  }

  static startTrial(init: SubscriptionInit): Subscription {
    if (init.id.trim() === '' || init.tenantId.trim() === '') {
      throw new DomainError('VALIDATION_FAILED', 'Subscription requires id and tenantId.');
    }
    return new Subscription(init);
  }

  transitionTo(to: SubscriptionStatus, now: Date): void {
    const allowed = SUBSCRIPTION_TRANSITIONS[this.status] ?? [];
    if (!allowed.includes(to)) {
      throw new DomainError(
        'INVALID_TRANSITION',
        `Subscription transition ${this.status} -> ${to} is not allowed.`,
        { from: this.status, to },
      );
    }
    this.status = to;
    this.updatedAt = now;
  }

  /** DEC-SaaS-005: sem cobrança durante o trial. */
  get isTrial(): boolean {
    return this.status === 'TRIAL';
  }

  /** DEC-SaaS-006: durante o grace, a operação permanece ativa. */
  isOperational(now: Date): boolean {
    if (this.status === 'TRIAL') return now.getTime() <= this.trialEndsAt.getTime();
    if (this.status === 'ACTIVE') return true;
    if (this.status === 'PAST_DUE') {
      return this.graceEndsAt !== null && now.getTime() <= this.graceEndsAt.getTime();
    }
    return false;
  }

  recordChargeFailure(now: Date): void {
    this.transitionTo('PAST_DUE', now);
    this.graceEndsAt = new Date(now.getTime() + GRACE_DAYS * 24 * 3600 * 1000);
  }

  recordPayment(planId: string, now: Date): void {
    if (!(Object.keys(PLANS) as string[]).includes(planId)) {
      throw new DomainError('VALIDATION_FAILED', `Unknown plan: ${planId}.`);
    }
    this.planId = planId;
    this.graceEndsAt = null;
    this.transitionTo('ACTIVE', now);
  }

  /** Expiração do trial (14 dias) ou do grace (7 dias após a falha). */
  lapse(now: Date): 'EXPIRED' | 'SUSPENDED' | null {
    if (this.status === 'TRIAL' && now.getTime() > this.trialEndsAt.getTime()) {
      this.transitionTo('EXPIRED', now);
      return 'EXPIRED';
    }
    if (
      this.status === 'PAST_DUE' &&
      this.graceEndsAt !== null &&
      now.getTime() > this.graceEndsAt.getTime()
    ) {
      this.transitionTo('SUSPENDED', now);
      return 'SUSPENDED';
    }
    return null;
  }

  limits(): PlanLimits {
    if (this.status === 'TRIAL') {
      return { planId: 'trial', monthlyPriceMinor: 0, maxDrivers: TRIAL_MAX_DRIVERS, maxRidesPerMonth: TRIAL_MAX_RIDES, maxAreas: 1 };
    }
    const plan = PLANS[this.planId];
    if (plan === undefined) throw new DomainError('VALIDATION_FAILED', `Unknown plan: ${this.planId}.`);
    return plan;
  }

  assertDriverLimit(activeDrivers: number): void {
    if (activeDrivers >= this.limits().maxDrivers) {
      throw new DomainError('UNAUTHORIZED', 'Driver limit reached for the current plan.', {
        maxDrivers: this.limits().maxDrivers,
      });
    }
  }

  assertRideLimit(monthlyRides: number): void {
    if (monthlyRides >= this.limits().maxRidesPerMonth) {
      throw new DomainError('UNAUTHORIZED', 'Monthly ride limit reached for the current plan.', {
        maxRidesPerMonth: this.limits().maxRidesPerMonth,
      });
    }
  }
}
