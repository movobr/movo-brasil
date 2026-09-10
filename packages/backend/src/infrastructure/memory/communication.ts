import type { ActorContext } from '../../domain/authorization.js';
import { Conversation, Message } from '../../domain/conversation.js';
import type { DeviceToken, Notification } from '../../domain/notification.js';
import { Rating } from '../../domain/rating.js';
import type { ConversationStore, MessageStore } from '../../application/conversation-service.js';
import type { DeviceTokenStore, NotificationStore } from '../../application/notification-service.js';
import type { RatingStore } from '../../application/rating-service.js';

/** Stores em memória para chat + notificações (19/18). */
export class InMemoryConversationStore implements ConversationStore {
  private readonly byRide = new Map<string, Conversation>();
  private readonly byId = new Map<string, Conversation>();

  async findByRideId(tenantId: string, rideId: string): Promise<Conversation | null> {
    const conversation = this.byRide.get(`${tenantId}:${rideId}`);
    return conversation ?? null;
  }

  async save(conversation: Conversation): Promise<void> {
    this.byRide.set(`${conversation.tenantId}:${conversation.rideId}`, conversation);
    this.byId.set(conversation.id, conversation);
  }

  get(conversationId: string): Conversation | null {
    return this.byId.get(conversationId) ?? null;
  }
}

export class InMemoryMessageStore implements MessageStore {
  private readonly messages: Message[] = [];

  async listByConversation(conversationId: string, limit: number): Promise<Message[]> {
    return this.messages
      .filter((message) => message.conversationId === conversationId)
      .sort((a, b) => a.sequence - b.sequence)
      .slice(0, limit);
  }

  async findByClientId(conversationId: string, clientMessageId: string): Promise<Message | null> {
    return (
      this.messages.find(
        (message) => message.conversationId === conversationId && message.clientMessageId === clientMessageId,
      ) ?? null
    );
  }

  async nextSequence(conversationId: string): Promise<number> {
    const existing = this.messages.filter((message) => message.conversationId === conversationId);
    return existing.length === 0 ? 1 : Math.max(...existing.map((message) => message.sequence)) + 1;
  }

  async save(message: Message): Promise<void> {
    const index = this.messages.findIndex((current) => current.id === message.id);
    if (index >= 0) this.messages[index] = message;
    else this.messages.push(message);
  }
}

export class InMemoryNotificationStore implements NotificationStore {
  private readonly notifications: Notification[] = [];

  async existsByDedupeKey(dedupeKey: string): Promise<boolean> {
    return this.notifications.some((notification) => notification.dedupeKey === dedupeKey);
  }

  async save(notification: Notification): Promise<void> {
    if (!(await this.existsByDedupeKey(notification.dedupeKey))) this.notifications.push(notification);
  }

  async listForUser(tenantId: string, userId: string, limit: number): Promise<Notification[]> {
    return this.notifications
      .filter((notification) => notification.tenantId === tenantId && notification.recipientUserId === userId)
      .slice(0, limit);
  }
}

export class InMemoryDeviceTokenStore implements DeviceTokenStore {
  private readonly tokens = new Map<string, DeviceToken>();

  async listForUser(tenantId: string, userId: string): Promise<DeviceToken[]> {
    return [...this.tokens.values()].filter(
      (token) => token.tenantId === tenantId && token.userId === userId,
    );
  }

  async upsert(token: DeviceToken): Promise<void> {
    this.tokens.set(`${token.userId}:${token.token}`, token);
  }
}

export function actorWith(permissions: string[], tenantId: string | null, userId: string): ActorContext {
  return { userId, tenantId, permissions, correlationId: 'test-correlation' };
}

/** Store em memória para avaliações (Fase 26, Owner DECIDED bilateral 1–5). */
export class InMemoryRatingStore implements RatingStore {
  private readonly ratings: Rating[] = [];

  async findByRideAndRater(rideId: string, raterUserId: string): Promise<Rating | null> {
    return this.ratings.find((rating) => rating.rideId === rideId && rating.raterUserId === raterUserId) ?? null;
  }

  async save(rating: Rating): Promise<void> {
    if ((await this.findByRideAndRater(rating.rideId, rating.raterUserId)) === null) {
      this.ratings.push(rating);
    }
  }

  async listByRide(tenantId: string, rideId: string): Promise<Rating[]> {
    return this.ratings.filter((rating) => rating.tenantId === tenantId && rating.rideId === rideId);
  }
}
