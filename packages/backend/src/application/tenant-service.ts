import { randomUUID } from 'node:crypto';
import { DomainError } from '../domain/errors.js';
import { Tenant, type ActivationChecklist } from '../domain/tenant.js';
import { AuditEvent } from '../domain/audit.js';
import { authorize, type ActorContext } from '../domain/authorization.js';
import { validateBranding, type BrandingConfig } from '../domain/branding.js';
import type {
  TenantRepository,
  AuditEventRepository,
} from './repositories.js';

/**
 * Nomes de permissão verbo/recurso — padrão do contrato 09.
 * DERIVED-004: 09 lista exemplos ("such as"); provisionamento, ativação e
 * suspensão exigidos pelo contrato 05 seguem mecanicamente o mesmo padrão.
 */
export const PERMISSIONS = {
  tenantCreate: 'tenant.create',
  tenantRead: 'tenant.read',
  tenantUpdate: 'tenant.update',
  tenantActivate: 'tenant.activate',
  tenantSuspend: 'tenant.suspend',
  brandingManage: 'branding.manage',
  auditRead: 'audit.read',
} as const;

export interface ProvisionTenantInput {
  slug: string;
  name: string;
}

export interface Clock {
  now: () => Date;
}

/**
 * Gestão do lifecycle de tenant (05). Somente a administração da plataforma
 * cria tenants; configuração pode ocorrer antes da ativação; suspensão
 * bloqueia novas ações operacionais (imposta pelo status).
 */
export class TenantService {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly audits: AuditEventRepository,
    private readonly clock: Clock = { now: () => new Date() },
    private readonly newId: () => string = randomUUID,
  ) {}

  async provisionTenant(actor: ActorContext, input: ProvisionTenantInput): Promise<Tenant> {
    if (actor.tenantId !== null) {
      throw new DomainError('UNAUTHORIZED', 'Only MOVO platform administration may create a tenant.');
    }
    authorize(actor, PERMISSIONS.tenantCreate);
    const existing = await this.tenants.findBySlug(input.slug);
    if (existing !== null) {
      throw new DomainError('CONFLICT', `Tenant slug already exists: ${input.slug}.`, { slug: input.slug });
    }
    const tenant = Tenant.provision({ id: this.newId(), slug: input.slug, name: input.name, now: this.clock.now() });
    await this.tenants.save(tenant);
    await this.recordAudit(actor, null, 'tenant.provision', 'tenant', tenant.id, 'SUCCESS', { slug: tenant.slug });
    return tenant;
  }

  async beginConfiguration(actor: ActorContext, tenantId: string): Promise<Tenant> {
    const tenant = await this.requireTenant(actor, tenantId, PERMISSIONS.tenantUpdate);
    if (tenant.status === 'PROVISIONING') {
      tenant.transitionTo('CONFIGURING', this.clock.now());
      await this.tenants.save(tenant);
      await this.recordAudit(actor, tenantId, 'tenant.begin_configuration', 'tenant', tenantId, 'SUCCESS', {});
    }
    return tenant;
  }

  async requestActivation(
    actor: ActorContext,
    tenantId: string,
    checklist: ActivationChecklist,
  ): Promise<Tenant> {
    const tenant = await this.requireTenant(actor, tenantId, PERMISSIONS.tenantUpdate);
    tenant.assertCanActivate(checklist);
    if (tenant.status === 'CONFIGURING') {
      tenant.transitionTo('PENDING_ACTIVATION', this.clock.now());
      await this.tenants.save(tenant);
      await this.recordAudit(actor, tenantId, 'tenant.request_activation', 'tenant', tenantId, 'SUCCESS', {});
    }
    return tenant;
  }

  async activateTenant(
    actor: ActorContext,
    tenantId: string,
    checklist: ActivationChecklist,
  ): Promise<Tenant> {
    const tenant = await this.requireTenant(actor, tenantId, PERMISSIONS.tenantActivate);
    tenant.assertCanActivate(checklist);
    tenant.transitionTo('ACTIVE', this.clock.now());
    await this.tenants.save(tenant);
    await this.recordAudit(actor, tenantId, 'tenant.activate', 'tenant', tenantId, 'SUCCESS', {});
    return tenant;
  }

  async suspendTenant(actor: ActorContext, tenantId: string, reason: string): Promise<Tenant> {
    const tenant = await this.requireTenant(actor, tenantId, PERMISSIONS.tenantSuspend);
    tenant.transitionTo('SUSPENDED', this.clock.now());
    await this.tenants.save(tenant);
    await this.recordAudit(actor, tenantId, 'tenant.suspend', 'tenant', tenantId, 'SUCCESS', { reason });
    return tenant;
  }

  async cancelTenant(actor: ActorContext, tenantId: string, reason: string): Promise<Tenant> {
    const tenant = await this.requireTenant(actor, tenantId, PERMISSIONS.tenantSuspend);
    tenant.transitionTo('CANCELLED', this.clock.now());
    await this.tenants.save(tenant);
    await this.recordAudit(actor, tenantId, 'tenant.cancel', 'tenant', tenantId, 'SUCCESS', { reason });
    return tenant;
  }

  async getTenant(actor: ActorContext, tenantId: string): Promise<Tenant> {
    return this.requireTenant(actor, tenantId, PERMISSIONS.tenantRead);
  }

  /**
   * Branding do tenant (06/07): edição por `branding.manage` com escopo do
   * tenant (deny cross-tenant via authorize); validação estrutural antes
   * de persistir; inválido nunca quebra UI (resolveTheme faz fallback).
   * Auditoria em toda mutação (32). Asset binário (tipo/dimensão/conteúdo)
   * continua na ativação de assets, fora deste escopo.
   */
  async getBranding(actor: ActorContext, tenantId: string): Promise<BrandingConfig | null> {
    authorize(actor, PERMISSIONS.brandingManage, tenantId);
    return this.tenants.findBranding(tenantId);
  }

  async updateBranding(actor: ActorContext, tenantId: string, branding: BrandingConfig): Promise<BrandingConfig> {
    await this.requireTenant(actor, tenantId, PERMISSIONS.brandingManage);
    const issues = validateBranding(branding);
    if (issues.length > 0) {
      throw new DomainError('VALIDATION_FAILED', `Invalid branding: ${issues.join('; ')}`, { issues });
    }
    await this.tenants.saveBranding(tenantId, branding);
    await this.recordAudit(actor, tenantId, 'tenant.update_branding', 'tenant', tenantId, 'SUCCESS', {
      commercialName: branding.commercialName ?? null,
    });
    return branding;
  }

  /** Módulo tenants do platform admin (23): somente principais de plataforma. */
  async listTenants(actor: ActorContext): Promise<Tenant[]> {
    if (actor.tenantId !== null) {
      throw new DomainError('UNAUTHORIZED', 'Only platform administration may list tenants.');
    }
    authorize(actor, PERMISSIONS.tenantRead);
    return this.tenants.listAll();
  }

  private async requireTenant(actor: ActorContext, tenantId: string, permission: string): Promise<Tenant> {
    authorize(actor, permission, tenantId);
    const tenant = await this.tenants.findById(tenantId);
    if (tenant === null) {
      throw new DomainError('NOT_FOUND', `Tenant not found: ${tenantId}.`, { tenantId });
    }
    return tenant;
  }

  private async recordAudit(
    actor: ActorContext,
    tenantScope: string | null,
    action: string,
    resourceType: string,
    resourceId: string | null,
    result: 'SUCCESS' | 'DENIED' | 'FAILED',
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.audits.append(
      AuditEvent.record(
        {
          actorUserId: actor.userId,
          tenantScope,
          action,
          resourceType,
          resourceId,
          result,
          correlationId: actor.correlationId,
          metadata,
        },
        { eventId: () => this.newId(), now: () => this.clock.now() },
      ),
    );
  }
}
