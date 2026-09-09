import { randomUUID } from 'node:crypto';
import { TenantService } from '@movo/brasil/src/application/tenant-service.js';
import { SubscriptionService } from '@movo/brasil/src/application/subscription-service.js';
import { RideOrchestrator } from '@movo/brasil/src/application/ride-orchestrator.js';
import { PaymentService } from '@movo/brasil/src/application/payment-service.js';
import { Tenant } from '@movo/brasil/src/domain/tenant.js';
import { User } from '@movo/brasil/src/domain/user.js';
import type { ActorContext } from '@movo/brasil/src/domain/authorization.js';
import type { BrandingConfig } from '@movo/brasil/src/domain/branding.js';
import type { DomainEvent, EventPublisher } from '@movo/brasil/src/application/event-ports.js';
import type { MapsProvider } from '@movo/brasil/src/application/maps-ports.js';
import { InMemoryAuditEventRepository, InMemoryRideRepository, InMemoryTenantRepository, InMemoryUserRepository } from '@movo/brasil/src/infrastructure/memory/repositories.js';
import { InMemoryDriverProfileRepository } from '@movo/brasil/src/infrastructure/memory/onboarding.js';
import { DriverProfile } from '@movo/brasil/src/domain/driver-profile.js';
import { InMemoryLedgerStore, InMemoryPaymentStore } from '@movo/brasil/src/infrastructure/memory/payments.js';
import { InMemorySubscriptionRepository } from '@movo/brasil/src/infrastructure/memory/subscriptions.js';
import { createSupabaseClient } from '@movo/brasil/src/infrastructure/supabase/client.js';
import { SupabaseTenantRepository } from '@movo/brasil/src/infrastructure/supabase/repositories.js';
import { SupabaseRideRepository } from '@movo/brasil/src/infrastructure/supabase/ride-repository.js';
import { SupabasePaymentStore } from '@movo/brasil/src/infrastructure/supabase/payment-store.js';
import { FakeMapsProvider, DemoPaymentProvider } from './demo-fakes.js';

/**
 * Raiz de composição do web (23: platform admin via permissão explícita).
 * Com credenciais Supabase, usa repositórios vivos; sem elas, memória com
 * os tenants demo A/B do contrato 39 — em singleton de desenvolvimento
 * para continuidade entre requests (documentado; produção usa o banco).
 * Branding demo é fixture neutra de apresentação (store de config chega
 * com UNSPECIFIED-002); cada página resolve só o branding do tenant.
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

class CollectingPublisher implements EventPublisher {
  public readonly events: DomainEvent[] = [];
  async publish(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }
}

interface DemoStores {
  tenants: InMemoryTenantRepository;
  users: InMemoryUserRepository;
  audits: InMemoryAuditEventRepository;
  rides: InMemoryRideRepository;
  payments: InMemoryPaymentStore;
  ledger: InMemoryLedgerStore;
  drivers: InMemoryDriverProfileRepository;
  events: CollectingPublisher;
}

const globals = globalThis as unknown as { __movoDemoStores?: DemoStores };

async function seedDemo(stores: DemoStores): Promise<void> {
  for (const slug of ['demo-tenant-a', 'demo-tenant-b']) {
    if ((await stores.tenants.findBySlug(slug)) !== null) continue;
    const tenant = Tenant.provision({ id: randomUUID(), slug, name: slug, now: NOW });
    tenant.transitionTo('CONFIGURING', NOW);
    tenant.transitionTo('PENDING_ACTIVATION', NOW);
    tenant.transitionTo('ACTIVE', NOW);
    await stores.tenants.save(tenant);
    await stores.users.save(
      User.create({
        id: randomUUID(), tenantId: tenant.id, roleScope: 'TENANT', role: 'TENANT_ADMIN',
        email: `admin@${slug}.example`, phone: null, name: `Admin ${slug}`, status: 'ACTIVE', now: NOW,
      }),
    );
    const driverUserId = randomUUID();
    await stores.users.save(
      User.create({
        id: driverUserId, tenantId: tenant.id, roleScope: 'TENANT', role: 'DRIVER',
        email: null, phone: '+5511999990001', name: 'Motorista Demo', status: 'ACTIVE', now: NOW,
      }),
    );
    const profile = DriverProfile.register({ id: randomUUID(), tenantId: tenant.id, userId: driverUserId, status: 'ACTIVE', now: NOW });
    profile.transitionVerification('DOCUMENT_REVIEW', NOW);
    profile.transitionVerification('VERIFICATION', NOW);
    profile.transitionVerification('APPROVED', NOW);
    profile.setAvailable(true);
    await stores.drivers.save(profile);
  }
}

export interface Backend {
  tenants: TenantService;
  subscriptions: SubscriptionService;
  orchestrator: RideOrchestrator;
  audits: InMemoryAuditEventRepository | null;
  users: InMemoryUserRepository | null;
  platformActor: ActorContext;
  demoPassengerActor(tenantId: string): ActorContext;
  demoDriverUserId(tenantId: string): Promise<string | null>;
  demoBrandingForSlug(slug: string): BrandingConfig | null;
}

const PLATFORM_PERMISSIONS = ['tenant.read', 'tenant.update', 'subscription.read', 'subscription.manage', 'audit.read', 'ride.read', 'ride.dispatch', 'ride.accept', 'ride.cancel'];

export async function getBackend(): Promise<Backend> {
  const platformActor: ActorContext = {
    userId: 'platform-admin', tenantId: null, permissions: PLATFORM_PERMISSIONS, correlationId: randomUUID(),
  };
  const maps: MapsProvider = new FakeMapsProvider();
  const useLive = process.env['SUPABASE_URL'] !== undefined && process.env['SUPABASE_SERVICE_ROLE_KEY'] !== undefined;
  if (useLive) {
    const db = createSupabaseClient();
    const audits = new InMemoryAuditEventRepository();
    const payments = new PaymentService(new DemoPaymentProvider(), new SupabasePaymentStore(db), new InMemoryLedgerStore(), undefined, randomUUID);
    return {
      tenants: new TenantService(new SupabaseTenantRepository(db), audits),
      subscriptions: new SubscriptionService(new InMemorySubscriptionRepository(), new InMemoryLedgerStore(), audits),
      orchestrator: new RideOrchestrator(new SupabaseTenantRepository(db), new SupabaseRideRepository(db), audits, new CollectingPublisher(), maps, payments),
      audits,
      users: null,
      platformActor,
      demoPassengerActor: () => { throw new Error('Demo actors are unavailable with live stores.'); },
      demoDriverUserId: async () => null,
      demoBrandingForSlug: () => null,
    };
  }
  globals.__movoDemoStores ??= {
    tenants: new InMemoryTenantRepository(),
    users: new InMemoryUserRepository(),
    audits: new InMemoryAuditEventRepository(),
    rides: new InMemoryRideRepository(),
    payments: new InMemoryPaymentStore(),
    ledger: new InMemoryLedgerStore(),
    drivers: new InMemoryDriverProfileRepository(),
    events: new CollectingPublisher(),
  };
  const stores = globals.__movoDemoStores;
  await seedDemo(stores);
  const payments = new PaymentService(new DemoPaymentProvider(), stores.payments, stores.ledger, undefined, randomUUID);
  return {
    tenants: new TenantService(stores.tenants, stores.audits),
    subscriptions: new SubscriptionService(new InMemorySubscriptionRepository(), stores.ledger, stores.audits),
    orchestrator: new RideOrchestrator(stores.tenants, stores.rides, stores.audits, stores.events, maps, payments, undefined, undefined, stores.drivers),
    audits: stores.audits,
    users: stores.users,
    platformActor,
    demoPassengerActor: (tenantId: string): ActorContext => ({
      userId: `demo-pax-${tenantId}`, tenantId, permissions: ['ride.request', 'ride.read', 'ride.cancel'], correlationId: randomUUID(),
    }),
    demoDriverUserId: async (tenantId: string): Promise<string | null> => {
      const profiles = await stores.drivers.listByTenant(tenantId);
      return profiles[0]?.userId ?? null;
    },
    demoBrandingForSlug: (slug: string) => DEMO_BRANDING[slug] ?? null,
  };
}
