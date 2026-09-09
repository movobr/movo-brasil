import { ActorContext, authorize } from '../domain/authorization.js';
import { Conversation, Message } from '../domain/conversation.js';
import { DomainError } from '../domain/errors.js';

/** 19-CHAT application ports. Supabase Realtime chega com as credenciais. */
export interface ConversationStore {
  findByRideId(tenantId: string, rideId: string): Promise<Conversation | null>;
  save(conversation: Conversation): Promise<void>;
}

export interface MessageStore {
  listByConversation(conversationId: string, limit: number): Promise<Message[]>;
  findByClientId(conversationId: string, clientMessageId: string): Promise<Message | null>;
  nextSequence(conversationId: string): Promise<number>;
  save(message: Message): Promise<void>;
}

export interface ChatRideLookup {
  findParticipants(tenantId: string, rideId: string): Promise<{ passengerUserId: string; driverUserId: string | null } | null>;
}

export const CHAT_PERMISSIONS = {
  chatParticipate: 'ride.chat',
} as const;

/**
 * Chat da corrida (19): só participantes + suporte autorizado; suporte =
 * ator com permissão de leitura operacional no tenant (ride.dispatch).
 */
export class ConversationService {
  constructor(
    private readonly conversations: ConversationStore,
    private readonly messages: MessageStore,
    private readonly rides: ChatRideLookup,
    private readonly ids: () => string,
    private readonly clock: () => Date,
  ) {}

  private isSupport(actor: ActorContext): boolean {
    return actor.tenantId === null || actor.permissions.includes('ride.dispatch');
  }

  async openForRide(actor: ActorContext, tenantId: string, rideId: string): Promise<Conversation> {
    authorize(actor, CHAT_PERMISSIONS.chatParticipate, tenantId);
    const existing = await this.conversations.findByRideId(tenantId, rideId);
    if (existing !== null) return existing;
    const participants = await this.rides.findParticipants(tenantId, rideId);
    if (participants === null) throw new DomainError('NOT_FOUND', 'Ride not found for this tenant.');
    if (participants.driverUserId === null) {
      throw new DomainError('VALIDATION_FAILED', 'Chat opens after a driver accepts the ride.');
    }
    const conversation = Conversation.open({
      id: this.ids(),
      tenantId,
      rideId,
      participantUserIds: [participants.passengerUserId, participants.driverUserId],
      now: this.clock(),
    });
    if (!conversation.hasParticipant(actor.userId) && !this.isSupport(actor)) {
      throw new DomainError('UNAUTHORIZED', 'Only ride participants and authorized support can open this chat.');
    }
    await this.conversations.save(conversation);
    return conversation;
  }

  async sendMessage(
    actor: ActorContext,
    conversationId: string,
    tenantId: string,
    rideId: string,
    body: string,
    clientMessageId: string,
    senderIsSupport: boolean,
  ): Promise<Message> {
    authorize(actor, CHAT_PERMISSIONS.chatParticipate, tenantId);
    const conversation = await this.conversations.findByRideId(tenantId, rideId);
    if (conversation === null || conversation.id !== conversationId) {
      throw new DomainError('NOT_FOUND', 'Conversation not found.');
    }
    const allowed =
      conversation.hasParticipant(actor.userId) || (senderIsSupport && this.isSupport(actor));
    if (!allowed) throw new DomainError('UNAUTHORIZED', 'Sender is not a participant of this conversation.');
    const duplicate = await this.messages.findByClientId(conversationId, clientMessageId);
    if (duplicate !== null) return duplicate;
    const message = Message.create({
      id: this.ids(),
      conversationId,
      senderUserId: actor.userId,
      body,
      clientMessageId,
      sequence: await this.messages.nextSequence(conversationId),
      now: this.clock(),
    });
    await this.messages.save(message);
    return message;
  }

  /** Leitura pura (GET): null quando ainda não há conversa; com membership. */
  async peek(actor: ActorContext, tenantId: string, rideId: string, limit: number): Promise<{ conversation: Conversation; messages: Message[] } | null> {
    authorize(actor, CHAT_PERMISSIONS.chatParticipate, tenantId);
    const conversation = await this.conversations.findByRideId(tenantId, rideId);
    if (conversation === null) return null;
    if (!conversation.hasParticipant(actor.userId) && !this.isSupport(actor)) {
      throw new DomainError('UNAUTHORIZED', 'Only ride participants and authorized support can read this chat.');
    }
    const messages = await this.messages.listByConversation(conversation.id, Math.min(limit, 100));
    return { conversation, messages };
  }

  async listMessages(actor: ActorContext, tenantId: string, conversation: Conversation, limit: number): Promise<Message[]> {
    authorize(actor, CHAT_PERMISSIONS.chatParticipate, tenantId);
    if (!conversation.hasParticipant(actor.userId) && !this.isSupport(actor)) {
      throw new DomainError('UNAUTHORIZED', 'Only ride participants and authorized support can read this chat.');
    }
    return this.messages.listByConversation(conversation.id, Math.min(limit, 100));
  }

  async reportMessage(actor: ActorContext, tenantId: string, conversation: Conversation, message: Message): Promise<Message> {
    authorize(actor, CHAT_PERMISSIONS.chatParticipate, tenantId);
    if (message.conversationId !== conversation.id) {
      throw new DomainError('VALIDATION_FAILED', 'Message does not belong to this conversation.');
    }
    if (!conversation.hasParticipant(actor.userId) && !this.isSupport(actor)) {
      throw new DomainError('UNAUTHORIZED', 'Only ride participants and authorized support can report.');
    }
    message.report();
    await this.messages.save(message);
    return message;
  }
}
