import {
  DeviceToken,
  NOTIFICATION_CATALOG,
  Notification,
  NotificationChannel,
  NotificationDefinition,
  validateNotification,
} from '../domain/notification.js';
import { DomainError } from '../domain/errors.js';
import type { DomainEvent } from './event-ports.js';

/** 18-NOTIFICATIONS ports. Provedores vivos (FCM/Twilio) exigem credenciais. */
export interface NotificationStore {
  existsByDedupeKey(dedupeKey: string): Promise<boolean>;
  save(notification: Notification): Promise<void>;
  listForUser(tenantId: string, userId: string, limit: number): Promise<Notification[]>;
}

export interface DeviceTokenStore {
  listForUser(tenantId: string, userId: string): Promise<DeviceToken[]>;
  upsert(token: DeviceToken): Promise<void>;
}

export interface ChannelSender {
  readonly channel: NotificationChannel;
  send(notification: Notification, body: string, tokens: DeviceToken[]): Promise<void>;
}

/** Fake offline: registra envios para teste sem rede. */
export class FakeChannelSender implements ChannelSender {
  readonly sent: Array<{ notification: Notification; body: string; tokens: number }> = [];
  failNext = 0;
  constructor(readonly channel: NotificationChannel) {}
  async send(notification: Notification, body: string, tokens: DeviceToken[]): Promise<void> {
    if (this.failNext > 0) {
      this.failNext -= 1;
      throw new DomainError('PERSISTENCE_FAILED', `Fake ${this.channel} channel failed.`);
    }
    this.sent.push({ notification, body, tokens: tokens.length });
  }
}

export interface NotificationRideLookup {
  findById(tenantId: string, rideId: string): Promise<{ passengerUserId: string; driverUserId: string | null } | null>;
}

export interface NotificationTemplateOverrides {
  forTenant(tenantId: string): Promise<Record<string, string>>;
}

export class NotificationService {
  constructor(
    private readonly notifications: NotificationStore,
    private readonly tokens: DeviceTokenStore,
    private readonly rides: NotificationRideLookup,
    private readonly overrides: NotificationTemplateOverrides,
    private readonly senders: ReadonlyMap<NotificationChannel, ChannelSender>,
    private readonly ids: () => string,
    private readonly clock: () => Date,
    private readonly render: (templateKey: string, tenantOverrides: Record<string, string>) => string,
  ) {}

  definitionsFor(eventTrigger: string): NotificationDefinition[] {
    return NOTIFICATION_CATALOG.filter((definition) => definition.eventTrigger === eventTrigger);
  }

  /** Despacha com dedupe (18): mesma chave nunca gera segunda notificação. */
  async dispatch(
    tenantId: string,
    recipientUserId: string,
    definition: NotificationDefinition,
    variables: Record<string, unknown>,
  ): Promise<Notification | null> {
    const dedupeKey = `${definition.eventTrigger}:${definition.recipient}:${definition.templateKey}:${recipientUserId}:${String(variables['rideId'] ?? variables['entityId'] ?? 'global')}`;
    if (await this.notifications.existsByDedupeKey(dedupeKey)) return null;
    const notification: Notification = {
      id: this.ids(),
      tenantId,
      recipientUserId,
      channel: definition.channel,
      templateKey: definition.templateKey,
      locale: definition.locale,
      variables,
      dedupeKey,
      status: 'pending',
      attempts: 0,
      createdAt: this.clock(),
    };
    validateNotification(notification);
    await this.deliver(notification, definition, 0);
    await this.notifications.save(notification);
    return notification;
  }

  private async deliver(notification: Notification, definition: NotificationDefinition, channelIndex: number): Promise<void> {
    const order: NotificationChannel[] = [definition.channel];
    if (definition.fallbackChannel !== null) order.push(definition.fallbackChannel);
    const channel = order[Math.min(channelIndex, order.length - 1)];
    const sender = this.senders.get(channel);
    if (sender === undefined) throw new DomainError('VALIDATION_FAILED', `No sender for channel ${channel}.`);
    const recipientTokens = await this.tokens.listForUser(notification.tenantId, notification.recipientUserId);
    const body = this.render(notification.templateKey, {});
    for (let attempt = 1; attempt <= definition.maxRetries; attempt += 1) {
      notification.attempts += 1;
      try {
        const mutable = notification as { channel: NotificationChannel; status: Notification['status'] };
        mutable.channel = channel;
        await sender.send(notification, body, recipientTokens);
        mutable.status = 'sent';
        return;
      } catch {
        if (attempt === definition.maxRetries && channelIndex + 1 < order.length) {
          await this.deliver(notification, definition, channelIndex + 1);
          return;
        }
      }
    }
    (notification as { status: Notification['status'] }).status = 'failed';
  }

  /** Mapeia eventos da corrida → definições do catálogo (consumidor de eventos). */
  async handleRideEvent(event: DomainEvent): Promise<void> {
    const tenantId = event.tenantId;
    if (tenantId === null) return;
    const rideId =
      event.aggregateType === 'ride'
        ? event.aggregateId
        : String((event.payload as Record<string, unknown>)['rideId'] ?? '');
    if (rideId === '') return;
    for (const definition of this.definitionsFor(event.eventType)) {
      const ride = await this.rides.findById(tenantId, rideId);
      if (ride === null) continue;
      const recipient =
        definition.recipient === 'passenger'
          ? ride.passengerUserId
          : definition.recipient === 'driver'
            ? ride.driverUserId
            : null;
      if (recipient === null) continue;
      await this.dispatch(tenantId, recipient, definition, { rideId });
    }
  }
}
