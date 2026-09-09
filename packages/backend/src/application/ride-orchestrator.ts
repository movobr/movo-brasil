import { randomUUID } from 'node:crypto';
import { DomainError } from '../domain/errors.js';
import { authorize, type ActorContext } from '../domain/authorization.js';
import { Ride, type RideStatus } from '../domain/ride.js';
import { DEFAULT_CATALOG, quoteFare, type FareQuote, type RideCategory } from '../domain/pricing.js';
import { AuditEvent } from '../domain/audit.js';
import { RIDE_EVENTS, type DomainEvent, type EventPublisher } from './event-ports.js';
import type { MapsProvider } from './maps-ports.js';
import type { AuditEventRepository, TenantRepository } from './repositories.js';
import type { RideRepository } from './ride-repositories.js';
import type { DriverProfileRepository } from './onboarding-service.js';
import { PaymentService } from './payment-service.js';

/**
 * Nomes de permissão verbo/recurso — padrão do contrato 09.
 * DERIVED-009: `ride.request` e `ride.accept` seguem mecanicamente o padrão
 * documentado (os fluxos de 25 exigem ambos os atos autorizados).
 */
export const RIDE_PERMISSIONS = {
  rideRequest: 'ride.request',
  rideAccept: 'ride.accept',
  rideRead: 'ride.read',
  rideDispatch: 'ride.dispatch',
  rideCancel: 'ride.cancel',
} as const;

export interface RequestRideInput {
  readonly origin: string;
  readonly destination: string;
  readonly category: RideCategory;
  readonly paymentMethod: 'pix' | 'card';
}

const STATUS_EVENTS: Readonly<Partial<Record<RideStatus, string>>> = {
  MATCHING: RIDE_EVENTS.matching,
  ACCEPTED: RIDE_EVENTS.driverAssigned,
  DRIVER_ARRIVING: RIDE_EVENTS.driverArriving,
  DRIVER_ARRIVED: RIDE_EVENTS.driverArrived,
  IN_PROGRESS: RIDE_EVENTS.started,
  COMPLETED: RIDE_EVENTS.completed,
  CANCELLED: RIDE_EVENTS.cancelled,
};

/**
 * Orquestração fim-a-fim (42): request -> pricing -> ride -> pagamento ->
 * dispatch -> conclusão. Pix só libera dispatch após pago (DEC-PAY-003);
 * tenant fora de ACTIVE não aceita novas corridas (05/DEC-SaaS-006).
 */
export class RideOrchestrator {
  constructor(
    private readonly tenants: TenantRepository,
    private readonly rides: RideRepository,
    private readonly audits: AuditEventRepository,
    private readonly events: EventPublisher,
    private readonly maps: MapsProvider,
    private readonly payments: PaymentService,
    private readonly clock: { now: () => Date } = { now: () => new Date() },
    private readonly newId: () => string = randomUUID,
    private readonly drivers?: DriverProfileRepository,
  ) {}

  async requestRide(
    actor: ActorContext,
    input: RequestRideInput,
  ): Promise<{ ride: Ride; quote: FareQuote; paymentId: string | null }> {
    authorize(actor, RIDE_PERMISSIONS.rideRequest, actor.tenantId);
    if (actor.tenantId === null) {
      throw new DomainError('UNAUTHORIZED', 'Ride requests require a tenant-scoped actor.');
    }
    const tenant = await this.tenants.findById(actor.tenantId);
    if (tenant === null) throw new DomainError('NOT_FOUND', `Tenant not found: ${actor.tenantId}.`);
    if (tenant.status !== 'ACTIVE') {
      throw new DomainError('UNAUTHORIZED', `Tenant ${tenant.slug} is not ACTIVE and cannot accept new rides.`, {
        status: tenant.status,
      });
    }
    const route = await this.maps.route({ origin: input.origin, destination: input.destination });
    const quote = quoteFare(
      {
        category: input.category,
        distanceMeters: route.distanceMeters,
        durationSeconds: route.durationSeconds,
        tollsMinor: 0,
        waitingSeconds: 0,
        coupon: null,
        automaticPromotion: null,
        surgeMilli: 1000,
        origin: input.origin,
        destination: input.destination,
        catalog: DEFAULT_CATALOG[input.category],
      },
      this.clock.now(),
    );
    const ride = Ride.request({
      id: this.newId(),
      tenantId: actor.tenantId,
      passengerId: actor.userId,
      serviceTypeId: input.category,
      pickupLat: route.pickup.lat,
      pickupLng: route.pickup.lng,
      dropoffLat: route.dropoff.lat,
      dropoffLng: route.dropoff.lng,
      quotedMinor: quote.total.amountMinor,
      currency: quote.total.currency,
      now: this.clock.now(),
    });
    await this.rides.save(ride);

    let paymentId: string | null = null;
    if (input.paymentMethod === 'pix') {
      const { intent } = await this.payments.createPixIntent({
        id: this.newId(),
        tenantId: actor.tenantId,
        rideId: ride.id,
        amountMinor: quote.total.amountMinor,
        idempotencyKey: `ride-${ride.id}-pix`,
      });
      paymentId = intent.id;
    }
    await this.emit(ride, RIDE_EVENTS.requested, actor, { quoteTotalMinor: quote.total.amountMinor, paymentId });
    await this.recordAudit(actor, ride, 'ride.request', 'SUCCESS', {});
    return { ride, quote, paymentId };
  }

  /**
   * Pix: dispatch definitivo só após pago (DEC-PAY-003). A existência de um
   * intent Pix para a corrida exige confirmação autoritativa; sem intents
   * (cartão), segue o fluxo do provedor.
   */
  async startMatching(actor: ActorContext, rideId: string): Promise<Ride> {
    const ride = await this.requireRide(actor, rideId, RIDE_PERMISSIONS.rideDispatch);
    const intents = await this.payments.findIntentsByRide(ride.id);
    const pixIntents = intents.filter((intent) => intent.method === 'pix');
    if (pixIntents.length > 0 && !pixIntents.some((intent) => intent.status === 'paid')) {
      throw new DomainError('UNAUTHORIZED', 'Pix rides start dispatch only after authoritative payment confirmation.');
    }
    ride.transitionTo('MATCHING', 'system', this.clock.now());
    await this.rides.save(ride);
    await this.emit(ride, RIDE_EVENTS.matching, actor, {});
    return ride;
  }

  async acceptOffer(actor: ActorContext, rideId: string, driverId: string): Promise<Ride> {
    const ride = await this.requireRide(actor, rideId, RIDE_PERMISSIONS.rideAccept);
    // 58: sem ofertas em produção antes da verificação aprovada.
    if (this.drivers !== undefined) {
      const profile = await this.drivers.findByUserId(driverId);
      if (profile === null || !profile.canReceiveOffers()) {
        throw new DomainError('UNAUTHORIZED', 'Driver is not verified and available for offers.', { driverId });
      }
    }
    ride.assignDriver(driverId);
    ride.transitionTo('ACCEPTED', 'driver-acceptance', this.clock.now());
    await this.rides.save(ride);
    await this.emit(ride, RIDE_EVENTS.driverAssigned, actor, { driverId });
    await this.recordAudit(actor, ride, 'ride.accept', 'SUCCESS', { driverId });
    return ride;
  }

  async advanceRide(actor: ActorContext, rideId: string, to: RideStatus, trigger: string): Promise<Ride> {
    const ride = await this.requireRide(actor, rideId, RIDE_PERMISSIONS.rideDispatch);
    ride.transitionTo(to, trigger, this.clock.now());
    await this.rides.save(ride);
    const eventType = STATUS_EVENTS[to];
    if (eventType !== undefined) {
      await this.emit(ride, eventType, actor, { to });
    }
    return ride;
  }

  private async requireRide(actor: ActorContext, rideId: string, permission: string): Promise<Ride> {
    const ride = await this.rides.findById(rideId);
    if (ride === null) throw new DomainError('NOT_FOUND', `Ride not found: ${rideId}.`);
    authorize(actor, permission, ride.tenantId);
    return ride;
  }

  private async emit(ride: Ride, eventType: string, actor: ActorContext, payload: Record<string, unknown>): Promise<void> {
    const event: DomainEvent = {
      eventId: this.newId(),
      eventType,
      version: 1,
      occurredAt: this.clock.now(),
      tenantId: ride.tenantId,
      aggregateType: 'ride',
      aggregateId: ride.id,
      correlationId: actor.correlationId,
      payload,
    };
    await this.events.publish(event);
  }

  private async recordAudit(
    actor: ActorContext,
    ride: Ride,
    action: string,
    result: 'SUCCESS' | 'DENIED' | 'FAILED',
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.audits.append(
      AuditEvent.record(
        {
          actorUserId: actor.userId,
          tenantScope: ride.tenantId,
          action,
          resourceType: 'ride',
          resourceId: ride.id,
          result,
          correlationId: actor.correlationId,
          metadata,
        },
        { eventId: () => this.newId(), now: () => this.clock.now() },
      ),
    );
  }
}
