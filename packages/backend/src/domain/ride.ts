import { DomainError } from './errors.js';

/**
 * Máquina de estado da corrida — 12-RIDE-STATE-MACHINE (tabela fechada).
 * Toda transição exige trigger atribuível (ator ou evento de sistema
 * confiável). Arestas de pagamento só aceitam trigger de provedor
 * verificado/reconciliação (12, CXL-006, DEC-PAY-006).
 */
export const RIDE_STATUSES = [
  'REQUESTED',
  'MATCHING',
  'ACCEPTED',
  'DRIVER_ARRIVING',
  'DRIVER_ARRIVED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'PAYMENT_PENDING',
  'PAID',
  'PAYMENT_FAILED',
] as const;

export type RideStatus = (typeof RIDE_STATUSES)[number];

const TRANSITIONS: Readonly<Record<RideStatus, ReadonlyArray<RideStatus>>> = {
  REQUESTED: ['MATCHING', 'CANCELLED'],
  MATCHING: ['ACCEPTED', 'CANCELLED'],
  ACCEPTED: ['DRIVER_ARRIVING', 'CANCELLED'],
  DRIVER_ARRIVING: ['DRIVER_ARRIVED', 'CANCELLED'],
  DRIVER_ARRIVED: ['IN_PROGRESS', 'CANCELLED'],
  IN_PROGRESS: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['PAYMENT_PENDING'],
  CANCELLED: [],
  PAYMENT_PENDING: ['PAID', 'PAYMENT_FAILED'],
  PAID: [],
  PAYMENT_FAILED: [],
};

/** Triggers backend-side que podem concluir pagamento (12/CXL-006). */
const PAYMENT_TRIGGERS: ReadonlyArray<string> = ['verified-provider-event', 'system-reconciliation'];

export interface StatusChange {
  readonly from: RideStatus;
  readonly to: RideStatus;
  readonly trigger: string;
  readonly at: Date;
}

export interface RideInit {
  id: string;
  tenantId: string;
  passengerId: string;
  serviceTypeId: string;
  pickupLat: number;
  pickupLng: number;
  dropoffLat: number;
  dropoffLng: number;
  quotedMinor: number;
  currency: string;
  now: Date;
  /** Rota calculada no request (38): nula em corridas legadas. */
  routeDistanceMeters?: number | null;
  routeDurationSeconds?: number | null;
}

export class Ride {
  readonly id: string;
  readonly tenantId: string;
  readonly passengerId: string;
  readonly serviceTypeId: string;
  readonly pickupLat: number;
  readonly pickupLng: number;
  readonly dropoffLat: number;
  readonly dropoffLng: number;
  readonly quotedMinor: number;
  readonly currency: string;
  driverId: string | null = null;
  status: RideStatus = 'REQUESTED';
  readonly history: StatusChange[] = [];
  readonly routeDistanceMeters: number | null;
  readonly routeDurationSeconds: number | null;
  requestedAt: Date;
  acceptedAt: Date | null = null;
  startedAt: Date | null = null;
  completedAt: Date | null = null;
  cancelledAt: Date | null = null;

  private constructor(init: RideInit) {
    this.id = init.id;
    this.tenantId = init.tenantId;
    this.passengerId = init.passengerId;
    this.serviceTypeId = init.serviceTypeId;
    this.pickupLat = init.pickupLat;
    this.pickupLng = init.pickupLng;
    this.dropoffLat = init.dropoffLat;
    this.dropoffLng = init.dropoffLng;
    this.quotedMinor = init.quotedMinor;
    this.currency = init.currency;
    this.routeDistanceMeters = init.routeDistanceMeters ?? null;
    this.routeDurationSeconds = init.routeDurationSeconds ?? null;
    this.requestedAt = init.now;
    this.history.push({ from: 'REQUESTED', to: 'REQUESTED', trigger: 'passenger-request', at: init.now });
  }

  static request(init: RideInit): Ride {
    if (init.id.trim() === '' || init.tenantId.trim() === '' || init.passengerId.trim() === '') {
      throw new DomainError('VALIDATION_FAILED', 'Ride requires id, tenantId and passengerId.');
    }
    if (!Number.isInteger(init.quotedMinor) || init.quotedMinor < 0) {
      throw new DomainError('VALIDATION_FAILED', 'Ride quote must be non-negative integer minor units.');
    }
    for (const [name, value] of [['routeDistanceMeters', init.routeDistanceMeters], ['routeDurationSeconds', init.routeDurationSeconds]] as const) {
      if (value !== undefined && value !== null && (!Number.isInteger(value) || value < 0)) {
        throw new DomainError('VALIDATION_FAILED', `Ride ${name} must be a non-negative integer or null.`);
      }
    }
    return new Ride(init);
  }

  /** Invariante 12: no máximo um motorista vencedor por corrida. */
  assignDriver(driverId: string): void {
    if (this.driverId !== null) {
      throw new DomainError('CONFLICT', 'Ride already has a winning driver.', {
        rideId: this.id,
        winnerDriverId: this.driverId,
      });
    }
    this.driverId = driverId;
  }

  transitionTo(to: RideStatus, trigger: string, now: Date): void {
    const allowed = TRANSITIONS[this.status] ?? [];
    if (!allowed.includes(to)) {
      throw new DomainError('INVALID_TRANSITION', `Transition ${this.status} -> ${to} is not allowed.`, {
        from: this.status,
        to,
      });
    }
    if ((to === 'PAID' || to === 'PAYMENT_FAILED') && !PAYMENT_TRIGGERS.includes(trigger)) {
      throw new DomainError(
        'UNAUTHORIZED',
        'Payment status cannot be set by client trigger; verified provider event required.',
        { to, trigger },
      );
    }
    const from = this.status;
    this.status = to;
    if (to === 'ACCEPTED') this.acceptedAt = now;
    if (to === 'IN_PROGRESS') this.startedAt = now;
    if (to === 'COMPLETED') this.completedAt = now;
    if (to === 'CANCELLED') this.cancelledAt = now;
    this.history.push({ from, to, trigger, at: now });
  }
}
