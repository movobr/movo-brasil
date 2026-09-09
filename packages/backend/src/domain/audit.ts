/**
 * Evento de auditoria — contrato 32-AUDIT-LOGGING.
 * Registros são append-only a partir dos fluxos da aplicação.
 */
export type AuditResult = 'SUCCESS' | 'DENIED' | 'FAILED';

export interface AuditEventInput {
  actorUserId: string | null;
  tenantScope: string | null;
  action: string;
  resourceType: string;
  resourceId: string | null;
  result: AuditResult;
  correlationId: string;
  metadata?: Record<string, unknown>;
}

export interface AuditEventProps extends AuditEventInput {
  eventId: string;
  occurredAt: Date;
  metadata: Record<string, unknown>;
}

export class AuditEvent {
  readonly eventId: string;
  readonly occurredAt: Date;
  readonly actorUserId: string | null;
  readonly tenantScope: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId: string | null;
  readonly result: AuditResult;
  readonly correlationId: string;
  readonly metadata: Readonly<Record<string, unknown>>;

  private constructor(props: AuditEventProps) {
    this.eventId = props.eventId;
    this.occurredAt = props.occurredAt;
    this.actorUserId = props.actorUserId;
    this.tenantScope = props.tenantScope;
    this.action = props.action;
    this.resourceType = props.resourceType;
    this.resourceId = props.resourceId;
    this.result = props.result;
    this.correlationId = props.correlationId;
    this.metadata = props.metadata;
  }

  static record(
    input: AuditEventInput,
    generate: { eventId: () => string; now: () => Date },
  ): AuditEvent {
    return new AuditEvent({
      ...input,
      metadata: input.metadata ?? {},
      eventId: generate.eventId(),
      occurredAt: generate.now(),
    });
  }
}
