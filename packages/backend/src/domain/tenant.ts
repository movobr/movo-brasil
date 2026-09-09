import { DomainError } from './errors.js';

/**
 * Lifecycle de tenant — contrato 05-TENANT-LIFECYCLE.
 * Tabela de transições fechada: somente os pares abaixo são válidos.
 * Qualquer outro par falha deterministicamente com INVALID_TRANSITION.
 */
export const TENANT_STATUSES = [
  'PROVISIONING',
  'CONFIGURING',
  'PENDING_ACTIVATION',
  'ACTIVE',
  'SUSPENDED',
  'CANCELLED',
] as const;

export type TenantStatus = (typeof TENANT_STATUSES)[number];

const TRANSITIONS: Readonly<Record<TenantStatus, ReadonlyArray<TenantStatus>>> = {
  PROVISIONING: ['CONFIGURING', 'CANCELLED'],
  CONFIGURING: ['PENDING_ACTIVATION', 'CANCELLED'],
  PENDING_ACTIVATION: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['SUSPENDED', 'CANCELLED'],
  SUSPENDED: ['CANCELLED'],
  CANCELLED: [],
};

/**
 * Conjunto bloqueante de configuração para ativação — contrato 05.
 * Modelado como checklist de evidências (os valores vivem nos domínios
 * donos de cada grupo; aqui apenas a verificação).
 */
export interface ActivationChecklist {
  identityComplete: boolean;
  legalContentAccepted: boolean;
  serviceTypes: ReadonlyArray<string>;
  operatingAreas: ReadonlyArray<string>;
  pricingPolicySet: boolean;
  paymentRequired: boolean;
  paymentCapabilityReady: boolean;
  driverOnboardingPolicySet: boolean;
}

export function missingActivationItems(checklist: ActivationChecklist): string[] {
  const missing: string[] = [];
  if (!checklist.identityComplete) missing.push('tenant_identity');
  if (!checklist.legalContentAccepted) missing.push('legal_content');
  if (checklist.serviceTypes.length === 0) missing.push('service_type');
  if (checklist.operatingAreas.length === 0) missing.push('operating_area');
  if (!checklist.pricingPolicySet) missing.push('pricing_policy');
  if (checklist.paymentRequired && !checklist.paymentCapabilityReady) {
    missing.push('payment_capability');
  }
  if (!checklist.driverOnboardingPolicySet) missing.push('driver_onboarding_policy');
  return missing;
}

export interface TenantInit {
  id: string;
  slug: string;
  name: string;
  now: Date;
}

export class Tenant {
  readonly id: string;
  readonly slug: string;
  name: string;
  status: TenantStatus;
  readonly createdAt: Date;
  updatedAt: Date;

  private constructor(id: string, slug: string, name: string, status: TenantStatus, createdAt: Date, updatedAt: Date) {
    this.id = id;
    this.slug = slug;
    this.name = name;
    this.status = status;
    this.createdAt = createdAt;
    this.updatedAt = updatedAt;
  }

  static provision(init: TenantInit): Tenant {
    if (init.id.trim() === '' || init.slug.trim() === '' || init.name.trim() === '') {
      throw new DomainError('VALIDATION_FAILED', 'Tenant requires id, slug and name.');
    }
    return new Tenant(init.id, init.slug, init.name, 'PROVISIONING', init.now, init.now);
  }

  transitionTo(next: TenantStatus, now: Date): void {
    const allowed = TRANSITIONS[this.status] ?? [];
    if (!allowed.includes(next)) {
      throw new DomainError(
        'INVALID_TRANSITION',
        `Transition ${this.status} -> ${next} is not allowed.`,
        { from: this.status, to: next },
      );
    }
    this.status = next;
    this.updatedAt = now;
  }

  assertCanActivate(checklist: ActivationChecklist): void {
    const missing = missingActivationItems(checklist);
    if (missing.length > 0) {
      throw new DomainError('VALIDATION_FAILED', 'Tenant activation blocked by incomplete configuration.', {
        missing,
      });
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      id: this.id,
      slug: this.slug,
      name: this.name,
      status: this.status,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString(),
    };
  }

  static rehydrate(data: {
    id: string;
    slug: string;
    name: string;
    status: TenantStatus;
    createdAt: Date;
    updatedAt: Date;
  }): Tenant {
    if (!(TENANT_STATUSES as ReadonlyArray<string>).includes(data.status)) {
      throw new DomainError('VALIDATION_FAILED', `Unknown tenant status: ${String(data.status)}.`);
    }
    return new Tenant(data.id, data.slug, data.name, data.status, data.createdAt, data.updatedAt);
  }
}
