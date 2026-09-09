/**
 * Eventos de domínio — 17-REALTIME-EVENTS (envelope + append-only).
 * Transporte vivo (Supabase Realtime, DEC-RT-001) nas fases de infra;
 * aqui o contrato do envelope e a porta de publicação.
 */
export interface DomainEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly version: number;
  readonly occurredAt: Date;
  readonly tenantId: string | null;
  readonly aggregateType: string;
  readonly aggregateId: string;
  readonly correlationId: string;
  readonly payload: Record<string, unknown>;
}

export interface EventPublisher {
  publish(event: DomainEvent): Promise<void>;
}

export const RIDE_EVENTS = {
  requested: 'ride.requested.v1',
  matching: 'ride.matching.v1',
  driverAssigned: 'ride.driver_assigned.v1',
  driverArriving: 'ride.driver_arriving.v1',
  driverArrived: 'ride.driver_arrived.v1',
  started: 'ride.started.v1',
  completed: 'ride.completed.v1',
  cancelled: 'ride.cancelled.v1',
  paymentUpdated: 'payment.updated.v1',
} as const;
