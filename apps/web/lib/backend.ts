import { randomUUID } from 'node:crypto';
import { TenantService } from '@movo/brasil/src/application/tenant-service.js';
import { SubscriptionService } from '@movo/brasil/src/application/subscription-service.js';
import { OnboardingService } from '@movo/brasil/src/application/onboarding-service.js';
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
import { InMemoryPassengerProfileRepository } from '@movo/brasil/src/infrastructure/memory/onboarding.js';
import { InMemoryVehicleRepository } from '@movo/brasil/src/infrastructure/memory/onboarding.js';
import { DriverProfile } from '@movo/brasil/src/domain/driver-profile.js';
import { InMemoryLedgerStore, InMemoryPaymentStore } from '@movo/brasil/src/infrastructure/memory/payments.js';
import { InMemorySubscriptionRepository } from '@movo/brasil/src/infrastructure/memory/subscriptions.js';
import { createSupabaseClient } from '@movo/brasil/src/infrastructure/supabase/client.js';
import { createPublicSupabaseClient } from '@movo/brasil/src/infrastructure/supabase/client.js';
import { GoogleMapsProvider } from '@movo/brasil/src/infrastructure/maps/google-maps-provider.js';
import { SupabaseRealtimePublisher } from '@movo/brasil/src/infrastructure/realtime/supabase-realtime-publisher.js';
import { SupabaseTenantRepository } from '@movo/brasil/src/infrastructure/supabase/repositories.js';
import { SupabaseRideRepository } from '@movo/brasil/src/infrastructure/supabase/ride-repository.js';
import { SupabasePaymentStore } from '@movo/brasil/src/infrastructure/supabase/payment-store.js';
import { SupabaseDriverProfileRepository, SupabasePassengerProfileRepository, SupabaseVehicleRepository } from '@movo/brasil/src/infrastructure/supabase/onboarding.js';
import { SupabaseUserRepository } from '@movo/brasil/src/infrastructure/supabase/repositories.js';
import { ConversationService } from '@movo/brasil/src/application/conversation-service.js';
import { RatingService } from '@movo/brasil/src/application/rating-service.js';
import type { PaymentIntent } from '@movo/brasil/src/domain/payment.js';
import { FakeChannelSender, NotificationService } from '@movo/brasil/src/application/notification-service.js';
import type { NotificationStore } from '@movo/brasil/src/application/notification-service.js';
import { renderTemplate } from '@movo/brasil/src/domain/notification.js';
import { InMemoryConversationStore, InMemoryDeviceTokenStore, InMemoryMessageStore, InMemoryNotificationStore, InMemoryRatingStore } from '@movo/brasil/src/infrastructure/memory/communication.js';
import { FakeMapsProvider, DemoPaymentProvider } from './demo-fakes.js';

/**
 * Raiz de composição do web (23: platform admin via permissão explícita).
 * Com credenciais Supabase, usa repositórios vivos; sem elas, memória com
 * os tenants demo A/B do contrato 39 — em singleton de desenvolvimento
 * para continuidade entre requests (documentado; produção usa o banco).
 * Branding demo é fixture neutra de apresentação (store de config chega
 * com UNSPECIFIED-002); cada página resolve só o branding do tenant.
 */
/**
 * Trava de modo demo (39, E2E): com MOVO_E2E_DEMO=1 fora de produção,
 * força o caminho demo mesmo havendo credenciais no .env local.
 * Em produção a trava é ignorada.
 */
export function isLiveMode(env: NodeJS.ProcessEnv = process.env): boolean {
  if (env['MOVO_E2E_DEMO'] === '1' && env['NODE_ENV'] !== 'production') return false;
  return env['SUPABASE_URL'] !== undefined && env['SUPABASE_SERVICE_ROLE_KEY'] !== undefined;
}

/**
 * Seleção do provedor de mapas (37): com GOOGLE_MAPS_API_KEY, o adapter
 * vivo (Geocoding + Routes v2); sem ela, o fake determinístico do demo.
 * Exportada para teste sem rede.
 */
export function selectMapsProvider(env: NodeJS.ProcessEnv = process.env): MapsProvider {
  const apiKey = env['GOOGLE_MAPS_API_KEY'];
  if (apiKey !== undefined && apiKey.trim() !== '') return new GoogleMapsProvider(apiKey);
  return new FakeMapsProvider();
}

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
  private forwarder: ((event: DomainEvent) => Promise<void>) | null = null;
  onPublish(forward: (event: DomainEvent) => Promise<void>): void {
    this.forwarder = forward;
  }
  async publish(event: DomainEvent): Promise<void> {
    this.events.push(event);
    if (this.forwarder !== null) await this.forwarder(event);
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
  passengers: InMemoryPassengerProfileRepository;
  vehicles: InMemoryVehicleRepository;
  events: CollectingPublisher;
  conversations: InMemoryConversationStore;
  messages: InMemoryMessageStore;
  ratings: InMemoryRatingStore;
  notifications: InMemoryNotificationStore;
  deviceTokens: InMemoryDeviceTokenStore;
}

const globals = globalThis as unknown as { __movoDemoStores?: DemoStores };

async function seedDemo(stores: DemoStores): Promise<void> {
  if ((await stores.users.findByEmail('platform-admin@movo.demo')) === null) {
    await stores.users.save(
      User.create({
        id: randomUUID(), tenantId: null, roleScope: 'PLATFORM', role: 'MOVO_PLATFORM_ADMIN',
        email: 'platform-admin@movo.demo', phone: null, name: 'Platform Admin', status: 'ACTIVE', now: NOW,
      }),
    );
  }
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
        email: `driver@${slug}.example`, phone: '+5511999990001', name: 'Motorista Demo', status: 'ACTIVE', now: NOW,
      }),
    );
    await stores.users.save(
      User.create({
        id: randomUUID(), tenantId: tenant.id, roleScope: 'TENANT', role: 'OPERATOR',
        email: `operator@${slug}.example`, phone: null, name: `Operador ${slug}`, status: 'ACTIVE', now: NOW,
      }),
    );
    await stores.users.save(
      User.create({
        id: randomUUID(), tenantId: tenant.id, roleScope: 'TENANT', role: 'PASSENGER',
        email: `passenger@${slug}.example`, phone: null, name: `Passageiro ${slug}`, status: 'ACTIVE', now: NOW,
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
  onboarding: OnboardingService;
  orchestrator: RideOrchestrator;
  chat: ConversationService | null;
  ratings: RatingService | null;
  notifications: NotificationService | null;
  inbox: NotificationStore | null;
  paymentIntentsForRide(rideId: string): Promise<PaymentIntent[]>;
  audits: InMemoryAuditEventRepository | null;
  users: InMemoryUserRepository | SupabaseUserRepository | null;
  platformActor: ActorContext;
  /**
   * Branding efetivo (06 Fallback): persistido > fixture demo > null.
   * Demo continua fixture neutra de apresentação; produção usa o
   * branding persistido (store de config chega com UNSPECIFIED-002).
   */
  brandingForTenant(tenantId: string, slug: string): Promise<BrandingConfig | null>;
  demoBrandingForSlug(slug: string): BrandingConfig | null;
}

const PLATFORM_PERMISSIONS = ['tenant.read', 'tenant.update', 'subscription.read', 'subscription.manage', 'audit.read', 'ride.read', 'ride.dispatch', 'ride.accept', 'ride.cancel', 'ride.chat', 'driver.read', 'driver.manage'];

export async function getBackend(): Promise<Backend> {
  const platformActor: ActorContext = {
    userId: 'platform-admin', tenantId: null, permissions: PLATFORM_PERMISSIONS, correlationId: randomUUID(),
  };
  const useLive = isLiveMode();
  // Demo sem Supabase: fake determinístico (custo zero). Caminho vivo:
  // adapter Google com a key do servidor (nunca exposta ao client).
  const maps: MapsProvider = useLive ? selectMapsProvider() : new FakeMapsProvider();
  if (useLive) {
    const db = createSupabaseClient();
    const audits = new InMemoryAuditEventRepository();
    const payments = new PaymentService(new DemoPaymentProvider(), new SupabasePaymentStore(db), new InMemoryLedgerStore(), undefined, randomUUID);
    // Realtime no caminho vivo (35/36): coleta local + broadcast; falha
    // de broadcast nunca quebra a corrida (menor privilégio: publishable).
    const events = new CollectingPublisher();
    try {
      const realtime = new SupabaseRealtimePublisher(createPublicSupabaseClient());
      events.onPublish((event) => realtime.publish(event).catch(() => undefined));
    } catch {
      // Sem publishable configurado: segue só coletando (comportamento anterior).
    }
    return {
      tenants: new TenantService(new SupabaseTenantRepository(db), audits),
      subscriptions: new SubscriptionService(new InMemorySubscriptionRepository(), new InMemoryLedgerStore(), audits),
      onboarding: new OnboardingService(new SupabaseDriverProfileRepository(db), new SupabasePassengerProfileRepository(db), new SupabaseVehicleRepository(db), audits),
      orchestrator: new RideOrchestrator(new SupabaseTenantRepository(db), new SupabaseRideRepository(db), audits, events, maps, payments),
      chat: null,
      ratings: null,
      notifications: null,
      inbox: null,
      paymentIntentsForRide: (rideId: string) => payments.findIntentsByRide(rideId),
      audits,
      users: new SupabaseUserRepository(db),
      platformActor,
      brandingForTenant: async (tenantId: string) =>
        new SupabaseTenantRepository(db).findBranding(tenantId).catch(() => null),
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
    passengers: new InMemoryPassengerProfileRepository(),
    vehicles: new InMemoryVehicleRepository(),
    events: new CollectingPublisher(),
    conversations: new InMemoryConversationStore(),
    messages: new InMemoryMessageStore(),
    ratings: new InMemoryRatingStore(),
    notifications: new InMemoryNotificationStore(),
    deviceTokens: new InMemoryDeviceTokenStore(),
  };
  const stores = globals.__movoDemoStores;
  await seedDemo(stores);
  const payments = new PaymentService(new DemoPaymentProvider(), stores.payments, stores.ledger, undefined, randomUUID);
  const rideParticipants = {
    findParticipants: async (tenantId: string, rideId: string) => {
      const ride = await stores.rides.findById(rideId);
      if (ride === null || ride.tenantId !== tenantId) return null;
      return { passengerUserId: ride.passengerId, driverUserId: ride.driverId };
    },
    findById: async (tenantId: string, rideId: string) => {
      const ride = await stores.rides.findById(rideId);
      if (ride === null || ride.tenantId !== tenantId) return null;
      return { passengerUserId: ride.passengerId, driverUserId: ride.driverId };
    },
  };
  const chat = new ConversationService(stores.conversations, stores.messages, rideParticipants, randomUUID, () => new Date());
  const ratings = new RatingService(
    stores.ratings,
    {
      findById: async (tenantId: string, rideId: string) => {
        const ride = await stores.rides.findById(rideId);
        if (ride === null || ride.tenantId !== tenantId) return null;
        return { status: ride.status, passengerUserId: ride.passengerId, driverUserId: ride.driverId };
      },
    },
    randomUUID,
    () => new Date(),
  );
  const notificationService = new NotificationService(
    stores.notifications,
    stores.deviceTokens,
    rideParticipants,
    { forTenant: async () => ({}) },
    new Map([
      ['push', new FakeChannelSender('push')],
      ['in_app', new FakeChannelSender('in_app')],
    ]),
    randomUUID,
    () => new Date(),
    renderTemplate,
  );
  stores.events.onPublish((event) => notificationService.handleRideEvent(event));
  return {
    tenants: new TenantService(stores.tenants, stores.audits),
    subscriptions: new SubscriptionService(new InMemorySubscriptionRepository(), stores.ledger, stores.audits),
    onboarding: new OnboardingService(stores.drivers, stores.passengers, stores.vehicles, stores.audits),
    orchestrator: new RideOrchestrator(stores.tenants, stores.rides, stores.audits, stores.events, maps, payments, undefined, undefined, stores.drivers),
    chat,
    ratings,
    notifications: notificationService,
    inbox: stores.notifications,
    paymentIntentsForRide: (rideId: string) => payments.findIntentsByRide(rideId),
    audits: stores.audits,
    users: stores.users,
    platformActor,
    brandingForTenant: async (tenantId: string, slug: string) =>
      (await stores.tenants.findBranding(tenantId).catch(() => null)) ?? DEMO_BRANDING[slug] ?? null,
    demoBrandingForSlug: (slug: string) => DEMO_BRANDING[slug] ?? null,
  };
}
