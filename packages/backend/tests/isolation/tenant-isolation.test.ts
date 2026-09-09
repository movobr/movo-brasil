import { describe, expect, it } from 'vitest';
import { TenantService, PERMISSIONS } from '../../src/application/tenant-service.js';
import type { ActorContext } from '../../src/domain/authorization.js';
import type { ActivationChecklist } from '../../src/domain/tenant.js';
import {
  InMemoryTenantRepository,
  InMemoryUserRepository,
  InMemoryAuditEventRepository,
} from '../../src/infrastructure/memory/repositories.js';
import { DomainError } from '../../src/domain/errors.js';

const NOW = new Date('2026-09-09T12:00:00.000Z');

const FULL_CHECKLIST: ActivationChecklist = {
  identityComplete: true,
  legalContentAccepted: true,
  serviceTypes: ['car'],
  operatingAreas: ['zone-1'],
  pricingPolicySet: true,
  paymentRequired: false,
  paymentCapabilityReady: false,
  driverOnboardingPolicySet: true,
};

function platformActor(): ActorContext {
  return {
    userId: 'platform-admin',
    tenantId: null,
    permissions: [
      PERMISSIONS.tenantCreate,
      PERMISSIONS.tenantRead,
      PERMISSIONS.tenantUpdate,
      PERMISSIONS.tenantActivate,
      PERMISSIONS.tenantSuspend,
    ],
    correlationId: 'corr-platform',
  };
}

function tenantActor(tenantId: string): ActorContext {
  return {
    userId: `admin-${tenantId}`,
    tenantId,
    permissions: [PERMISSIONS.tenantRead, PERMISSIONS.tenantUpdate, PERMISSIONS.tenantActivate],
    correlationId: `corr-${tenantId}`,
  };
}

function setup() {
  const tenants = new InMemoryTenantRepository();
  const users = new InMemoryUserRepository();
  const audits = new InMemoryAuditEventRepository();
  const service = new TenantService(tenants, audits, { now: () => NOW });
  return { tenants, users, audits, service };
}

describe('cross-tenant isolation (REQ-PLATFORM-001, seed A/B)', () => {
  it('Tenant A cannot read, configure or activate Tenant B', async () => {
    const { service } = setup();
    const tenantA = await service.provisionTenant(platformActor(), { slug: 'demo-a', name: 'Demo A' });
    const tenantB = await service.provisionTenant(platformActor(), { slug: 'demo-b', name: 'Demo B' });
    const actorA = tenantActor(tenantA.id);

    await expect(service.getTenant(actorA, tenantB.id)).rejects.toMatchObject({
      code: 'CROSS_TENANT_DENIED',
    });
    await expect(service.beginConfiguration(actorA, tenantB.id)).rejects.toMatchObject({
      code: 'CROSS_TENANT_DENIED',
    });
    await expect(service.requestActivation(actorA, tenantB.id, FULL_CHECKLIST)).rejects.toMatchObject({
      code: 'CROSS_TENANT_DENIED',
    });
  });

  it('audit events never leak across tenants', async () => {
    const { service, audits } = setup();
    const tenantA = await service.provisionTenant(platformActor(), { slug: 'demo-a', name: 'Demo A' });
    const tenantB = await service.provisionTenant(platformActor(), { slug: 'demo-b', name: 'Demo B' });
    // Provisionamento é ação de plataforma (tenantScope nulo, auditada).
    // Ciclo completo em B gera eventos com escopo de B.
    const actorB = tenantActor(tenantB.id);
    await service.beginConfiguration(actorB, tenantB.id);
    await service.requestActivation(actorB, tenantB.id, FULL_CHECKLIST);
    await service.activateTenant(actorB, tenantB.id, FULL_CHECKLIST);
    const eventsA = await audits.listByTenant(tenantA.id);
    const eventsB = await audits.listByTenant(tenantB.id);
    expect(eventsB.length).toBeGreaterThan(0);
    for (const event of eventsB) {
      expect(event.tenantScope).toBe(tenantB.id);
    }
    for (const event of eventsA) {
      expect(event.tenantScope).not.toBe(tenantB.id);
    }
  });

  it('a tenant-scoped actor cannot provision tenants', async () => {
    const { service } = setup();
    const tenantA = await service.provisionTenant(platformActor(), { slug: 'demo-a', name: 'Demo A' });
    await expect(
      service.provisionTenant(tenantActor(tenantA.id), { slug: 'demo-x', name: 'Demo X' }),
    ).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
  });

  it('duplicate slugs conflict deterministically', async () => {
    const { service } = setup();
    await service.provisionTenant(platformActor(), { slug: 'demo-a', name: 'Demo A' });
    await expect(service.provisionTenant(platformActor(), { slug: 'demo-a', name: 'Demo A2' })).rejects.toMatchObject(
      { code: 'CONFLICT' },
    );
  });

  it('full lifecycle emits audit trail', async () => {
    const { service, audits } = setup();
    const tenant = await service.provisionTenant(platformActor(), { slug: 'demo-a', name: 'Demo A' });
    const actor = tenantActor(tenant.id);
    await service.beginConfiguration(actor, tenant.id);
    await service.requestActivation(actor, tenant.id, FULL_CHECKLIST);
    await service.activateTenant(actor, tenant.id, FULL_CHECKLIST);
    const events = await audits.listByTenant(tenant.id);
    const actions = events.map((event) => event.action);
    expect(actions).toContain('tenant.begin_configuration');
    expect(actions).toContain('tenant.request_activation');
    expect(actions).toContain('tenant.activate');
    for (const event of events) {
      expect(event.correlationId).toBe(`corr-${tenant.id}`);
    }
  });

  it('suspended tenants reject activation-path transitions', async () => {
    const { service } = setup();
    const tenant = await service.provisionTenant(platformActor(), { slug: 'demo-a', name: 'Demo A' });
    const actor = tenantActor(tenant.id);
    await service.beginConfiguration(actor, tenant.id);
    await service.requestActivation(actor, tenant.id, FULL_CHECKLIST);
    await service.activateTenant(actor, tenant.id, FULL_CHECKLIST);
    const platform = platformActor();
    await service.suspendTenant(platform, tenant.id, 'billing');
    const suspended = await service.getTenant(platform, tenant.id);
    expect(suspended.status).toBe('SUSPENDED');
    await expect(
      (async () => {
        suspended.transitionTo('ACTIVE', NOW);
      })(),
    ).rejects.toMatchObject({ code: 'INVALID_TRANSITION' });
  });
});
