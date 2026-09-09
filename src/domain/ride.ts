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
  now: Date;
}

export class Ride {
  readonly id: string;
  readonly tenantId: string;
  readonly passengerId: string;
  readonly serviceTypeId: string;
  driverId: string | null = null;
  status: RideStatus = 'REQUESTED';
  readonly history: StatusChange[] = [];
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
    this.requestedAt = init.now;
    this.history.push({ from: 'REQUESTED', to: 'REQUESTED', trigger: 'passenger-request', at: init.now });
  }

  static request(init: RideInit): Ride {
    if (init.id.trim() === '' || init.tenantId.trim() === '' || init.passengerId.trim() === '') {
      throw new DomainError('VALIDATION_FAILED', 'Ride requires id, tenantId and passengerId.');
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
