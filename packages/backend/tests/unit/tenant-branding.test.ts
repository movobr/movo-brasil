import { describe, expect, it } from 'vitest';
import { TenantService } from '../../src/application/tenant-service.js';
import { InMemoryAuditEventRepository, InMemoryTenantRepository } from '../../src/infrastructure/memory/repositories.js';
import type { ActorContext } from '../../src/domain/authorization.js';
import { Tenant } from '../../src/domain/tenant.js';

const NOW = new Date('2026-09-09T12:00:00Z');

function actor(userId: string, tenantId: string | null, permissions: string[]): ActorContext {
  return { userId, tenantId, permissions, correlationId: 'corr-1' };
}

async function activeTenant(stores: InMemoryTenantRepository, id: string, slug: string): Promise<Tenant> {
  const tenant = Tenant.provision({ id, slug, name: slug, now: NOW });
  tenant.transitionTo('CONFIGURING', NOW);
  tenant.transitionTo('PENDING_ACTIVATION', NOW);
  tenant.transitionTo('ACTIVE', NOW);
  await stores.save(tenant);
  return tenant;
}

/** Branding gerenciável por tenant (06/07): permissão, escopo, validação, auditoria. */
describe('tenant branding (06/07)', () => {
  const valid = {
    commercialName: 'Demo A Mobilidade',
    primaryLogoUrl: 'https://cdn.demo-a.example/logo.png',
    colors: { primary: '#0b5fff' },
  };

  it('lets a tenant admin with branding.manage update its own branding', async () => {
    const stores = new InMemoryTenantRepository();
    const audits = new InMemoryAuditEventRepository();
    const svc = new TenantService(stores, audits);
    const created = await activeTenant(stores, 't-a', 'a');
    const admin = actor('admin-a', created.id, ['branding.manage']);
    const saved = await svc.updateBranding(admin, created.id, valid);
    expect(saved.commercialName).toBe('Demo A Mobilidade');
    expect(await svc.getBranding(admin, created.id)).toEqual(valid);
    const events = await audits.listByTenant(created.id);
    expect(events.some((event) => event.action === 'tenant.update_branding')).toBe(true);
  });

  it('denies cross-tenant edits and invalid payloads', async () => {
    const stores = new InMemoryTenantRepository();
    const audits = new InMemoryAuditEventRepository();
    const svc = new TenantService(stores, audits);
    const created = await activeTenant(stores, 't-a', 'a');
    const otherAdmin = actor('admin-b', 'other-tenant', ['branding.manage']);
    await expect(svc.updateBranding(otherAdmin, created.id, valid)).rejects.toThrow();
    const admin = actor('admin-a', created.id, ['branding.manage']);
    await expect(
      svc.updateBranding(admin, created.id, { primaryLogoUrl: 'http://inseguro.example/logo.png' }),
    ).rejects.toThrow(/Invalid branding/);
    const noPerm = actor('admin-a', created.id, ['tenant.read']);
    await expect(svc.updateBranding(noPerm, created.id, valid)).rejects.toThrow();
  });
});
