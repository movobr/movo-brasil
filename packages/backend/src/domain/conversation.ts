import { DomainError } from './errors.js';

/**
 * Chat contextual à corrida — 19-CHAT. Escopo: participantes + suporte
 * autorizado. Ordenação e IDs autoritativos no servidor; entrega duplicada
 * nunca duplica persistência (dedupe por clientMessageId).
 */
export interface ConversationInit {
  id: string;
  tenantId: string;
  rideId: string;
  participantUserIds: ReadonlyArray<string>;
  now: Date;
}

export class Conversation {
  readonly id: string;
  readonly tenantId: string;
  readonly rideId: string;
  private readonly participants: Set<string>;
  readonly createdAt: Date;

  private constructor(init: ConversationInit) {
    this.id = init.id;
    this.tenantId = init.tenantId;
    this.rideId = init.rideId;
    this.participants = new Set(init.participantUserIds);
    this.createdAt = init.now;
  }

  static open(init: ConversationInit): Conversation {
    if (init.participantUserIds.length < 2) {
      throw new DomainError('VALIDATION_FAILED', 'A ride conversation requires at least two participants.');
    }
    return new Conversation(init);
  }

  hasParticipant(userId: string): boolean {
    return this.participants.has(userId);
  }

  participantsList(): string[] {
    return [...this.participants];
  }
}

export interface MessageInit {
  id: string;
  conversationId: string;
  senderUserId: string;
  body: string;
  clientMessageId: string;
  sequence: number;
  now: Date;
}

export class Message {
  readonly id: string;
  readonly conversationId: string;
  readonly senderUserId: string;
  readonly body: string;
  readonly clientMessageId: string;
  readonly sequence: number;
  readonly sentAt: Date;
  reported = false;

  private constructor(init: MessageInit) {
    this.id = init.id;
    this.conversationId = init.conversationId;
    this.senderUserId = init.senderUserId;
    this.body = init.body;
    this.clientMessageId = init.clientMessageId;
    this.sequence = init.sequence;
    this.sentAt = init.now;
  }

  static create(init: MessageInit): Message {
    const body = init.body.trim();
    if (body === '' || body.length > 1000) {
      throw new DomainError('VALIDATION_FAILED', 'Message body must be 1-1000 characters.');
    }
    return new Message({ ...init, body });
  }

  /** Controle de abuso (19): denúncia registrada + auditada; sem auto-ação. */
  report(): void {
    this.reported = true;
  }
}
