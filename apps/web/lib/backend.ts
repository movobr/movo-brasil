import { randomUUID } from 'node:crypto';
import { TenantService } from '@movo/brasil/src/application/tenant-service.js';
import { SubscriptionService } from '@movo/brasil/src/application/subscription-service.js';
import { Tenant } from '@movo/brasil/src/domain/tenant.js';
import { User } from '@movo/brasil/src/domain/user.js';
import type { ActorContext } from '@movo/brasil/src/domain/authorization.js';
import type { BrandingConfig } from '@movo/brasil/src/domain/branding.js';
import { InMemoryAuditEventRepository, InMemoryTenantRepository, InMemoryUserRepository } from '@movo/brasil/src/infrastructure/memory/repositories.js';
import { InMemoryLedgerStore } from '@movo/brasil/src/infrastructure/memory/payments.js';
import { InMemorySubscriptionRepository } from '@movo/brasil/src/infrastructure/memory/subscriptions.js';
import { createSupabaseClient } from '@movo/brasil/src/infrastructure/supabase/client.js';
import { SupabaseTenantRepository } from '@movo/brasil/src/infrastructure/supabase/repositories.js';

/**
 * Raiz de composição do web (23: platform admin via permissão explícita).
 * Com credenciais Supabase, usa repositórios vivos; sem elas, memória com
 * os tenants demo A/B do contrato 39. Branding demo abaixo é fixture de
 * apresentação neutra (o store de config do domínio chega com
 * UNSPECIFIED-002); cada página resolve só o branding do próprio tenant.
 */
const NOW = new Date('2026-09-09T12:00:00.000Z');

export const DEMO_BRANDING: Readonly<Record<string, BrandingConfig>> = {
  'demo-tenant-a': {
    commercialName: 'Demo A Mobilidade',
    primaryLogoUrl: 'https://cdn.demo-a.example/logo.png',
    colors: { primary: '#0b5fff', surface: '#f7f9ff', onSurface: '#0a1633' },
  },
  'demo-tenant-b': {
    commercialName: 'Demo B Rodas',
    primaryLogoUrl: 'https://cdn.demo-b.example/logo.png',
    colors: { primary: '#b35400', surface: '#fff9f4', onSurface: '#331a05' },
  },
};

async function seedDemo(tenants: InMemoryTenantRepository, users: InMemoryUserRepository): Promise<void> {
  for (const slug of ['demo-tenant-a', 'demo-tenant-b']) {
    if ((await tenants.findBySlug(slug)) !== null) continue;
    const tenant = Tenant.provision({ id: randomUUID(), slug, name: slug, now: NOW });
    tenant.transitionTo('CONFIGURING', NOW);
    tenant.transitionTo('PENDING_ACTIVATION', NOW);
    tenant.transitionTo('ACTIVE', NOW);
    await tenants.save(tenant);
    await users.save(
      User.create({
        id: randomUUID(),
        tenantId: tenant.id,
        roleScope: 'TENANT',
        role: 'TENANT_ADMIN',
        email: `admin@${slug}.example`,
        phone: null,
        name: `Admin ${slug}`,
        status: 'ACTIVE',
        now: NOW,
      }),
    );
  }
}

export interface Backend {
  tenants: TenantService;
  subscriptions: SubscriptionService;
  audits: InMemoryAuditEventRepository | null;
  platformActor: ActorContext;
  demoBrandingForSlug(slug: string): BrandingConfig | null;
}

export async function getBackend(): Promise<Backend> {
  const platformActor: ActorContext = {
    userId: 'platform-admin',
    tenantId: null,
    permissions: ['tenant.read', 'tenant.update', 'subscription.read', 'subscription.manage', 'audit.read'],
    correlationId: randomUUID(),
  };
  const useLive =
    process.env['SUPABASE_URL'] !== undefined && process.env['SUPABASE_SERVICE_ROLE_KEY'] !== undefined;
  if (useLive) {
    const db = createSupabaseClient();
    const audits = new InMemoryAuditEventRepository();
    return {
      tenants: new TenantService(new SupabaseTenantRepository(db), audits),
      subscriptions: new SubscriptionService(new InMemorySubscriptionRepository(), new InMemoryLedgerStore(), audits),
      audits,
      platformActor,
      demoBrandingForSlug: () => null,
    };
  }
  const tenantRepo = new InMemoryTenantRepository();
  const userRepo = new InMemoryUserRepository();
  const audits = new InMemoryAuditEventRepository();
  await seedDemo(tenantRepo, userRepo);
  return {
    tenants: new TenantService(tenantRepo, audits),
    subscriptions: new SubscriptionService(new InMemorySubscriptionRepository(), new InMemoryLedgerStore(), audits),
    audits,
    platformActor,
    demoBrandingForSlug: (slug: string) => DEMO_BRANDING[slug] ?? null,
  };
}
