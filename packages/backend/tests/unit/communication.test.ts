import { describe, expect, it } from 'vitest';
import { ConversationService } from '../../src/application/conversation-service.js';
import { FakeChannelSender, NotificationService } from '../../src/application/notification-service.js';
import { renderTemplate } from '../../src/domain/notification.js';
import {
  InMemoryConversationStore,
  InMemoryDeviceTokenStore,
  InMemoryMessageStore,
  InMemoryNotificationStore,
  actorWith,
} from '../../src/infrastructure/memory/communication.js';

function buildChat() {
  const conversations = new InMemoryConversationStore();
  const messages = new InMemoryMessageStore();
  let counter = 0;
  const service = new ConversationService(
    conversations,
    messages,
    {
      findParticipants: async () =>
        participantsDriver === null
          ? { passengerUserId: 'pax-1', driverUserId: null }
          : { passengerUserId: 'pax-1', driverUserId: 'drv-1' },
    },
    () => `id-${(counter += 1)}`,
    () => new Date('2026-09-09T12:00:00Z'),
  );
  return { conversations, service };
}

let participantsDriver: string | null = 'drv-1';

describe('ride chat (19)', () => {
  it('opens a conversation only after a driver accepts', async () => {
    const { service } = buildChat();
    const actor = actorWith(['ride.chat'], 'tenant-a', 'pax-1');
    const conversation = await service.openForRide(actor, 'tenant-a', 'ride-1');
    expect(conversation.participantsList()).toEqual(['pax-1', 'drv-1']);

    participantsDriver = null;
    await expect(service.openForRide(actor, 'tenant-a', 'ride-2')).rejects.toThrow(/after a driver accepts/);
    participantsDriver = 'drv-1';
  });

  it('rejects non-participants and deduplicates redelivered messages', async () => {
    const { service, conversations } = buildChat();
    const passenger = actorWith(['ride.chat'], 'tenant-a', 'pax-1');
    const conversation = await service.openForRide(passenger, 'tenant-a', 'ride-1');
    const outsider = actorWith(['ride.chat'], 'tenant-a', 'stranger-1');
    await expect(
      service.sendMessage(outsider, conversation.id, 'tenant-a', 'ride-1', 'oi', 'client-1', false),
    ).rejects.toThrow(/not a participant/);

    const first = await service.sendMessage(passenger, conversation.id, 'tenant-a', 'ride-1', 'oi', 'client-1', false);
    const redelivered = await service.sendMessage(passenger, conversation.id, 'tenant-a', 'ride-1', 'oi', 'client-1', false);
    expect(redelivered.id).toBe(first.id);
    expect(first.sequence).toBe(1);
    const stored = conversations.get(conversation.id);
    expect(stored).not.toBeNull();
    const listed = await service.listMessages(passenger, 'tenant-a', stored!, 50);
    expect(listed).toHaveLength(1);
  });

  it('lets authorized support read and participants report abuse', async () => {
    const { service, conversations } = buildChat();
    const passenger = actorWith(['ride.chat'], 'tenant-a', 'pax-1');
    const conversation = await service.openForRide(passenger, 'tenant-a', 'ride-1');
    await service.sendMessage(passenger, conversation.id, 'tenant-a', 'ride-1', 'spam', 'client-9', false);
    const support = actorWith(['ride.chat', 'ride.dispatch'], 'tenant-a', 'support-1');
    const stored = conversations.get(conversation.id)!;
    const visible = await service.listMessages(support, 'tenant-a', stored, 50);
    expect(visible).toHaveLength(1);
    const reported = await service.reportMessage(passenger, 'tenant-a', stored, visible[0]);
    expect(reported.reported).toBe(true);
  });
});

describe('notifications (18)', () => {
  function buildNotifications() {
    const notifications = new InMemoryNotificationStore();
    const push = new FakeChannelSender('push');
    const inApp = new FakeChannelSender('in_app');
    let counter = 0;
    const service = new NotificationService(
      notifications,
      new InMemoryDeviceTokenStore(),
      { findById: async () => ({ passengerUserId: 'pax-1', driverUserId: 'drv-1' }) },
      { forTenant: async () => ({}) },
      new Map([
        ['push', push],
        ['in_app', inApp],
      ]),
      () => `notif-${(counter += 1)}`,
      () => new Date('2026-09-09T12:00:00Z'),
      renderTemplate,
    );
    return { service, notifications, push, inApp };
  }

  it('dedupes the same event, retries, then falls back to in-app', async () => {
    const { service, push, inApp } = buildNotifications();
    const [definition] = service.definitionsFor('ride.driver_assigned.v1');
    push.failNext = 3;
    const created = await service.dispatch('tenant-a', 'pax-1', definition, { rideId: 'ride-1' });
    expect(created?.status).toBe('sent');
    expect(created?.channel).toBe('in_app');
    expect(created?.attempts).toBe(4);
    expect(inApp.sent).toHaveLength(1);
    const duplicate = await service.dispatch('tenant-a', 'pax-1', definition, { rideId: 'ride-1' });
    expect(duplicate).toBeNull();
  });

  it('maps ride domain events to catalog definitions', async () => {
    const { service, notifications } = buildNotifications();
    await service.handleRideEvent({
      eventId: 'evt-1',
      eventType: 'ride.completed.v1',
      version: 1,
      tenantId: 'tenant-a',
      aggregateType: 'ride',
      aggregateId: 'ride-7',
      payload: { rideId: 'ride-7' },
      occurredAt: new Date('2026-09-09T12:00:00Z'),
      correlationId: 'corr-1',
    });
    const listed = await notifications.listForUser('tenant-a', 'pax-1', 10);
    expect(listed.map((notification) => notification.templateKey)).toContain('ride.receipt');
  });
});
