import { DomainError } from './errors.js';

/**
 * Notificações — 18-NOTIFICATIONS + DEC-NOT-001/002 (FCM push, Twilio OTP).
 * Definições exigidas pelo contrato: trigger, destinatário, escopo, canal,
 * template, locale, dedupe, retry e fallback. Copy por chave de template
 * (nunca hard-coded por tenant nos serviços); padrões da plataforma com
 * override por tenant quando o store de config chegar (UNSPECIFIED-002).
 */
export type NotificationChannel = 'push' | 'in_app' | 'email' | 'sms';

export interface NotificationDefinition {
  readonly eventTrigger: string;
  readonly recipient: 'passenger' | 'driver' | 'tenant_admin';
  readonly channel: NotificationChannel;
  readonly fallbackChannel: NotificationChannel | null;
  readonly templateKey: string;
  readonly locale: string;
  readonly maxRetries: number;
}

/** Catálogo V1: derivado mecanicamente dos eventos de domínio (17). */
export const NOTIFICATION_CATALOG: ReadonlyArray<NotificationDefinition> = [
  { eventTrigger: 'ride.driver_assigned.v1', recipient: 'passenger', channel: 'push', fallbackChannel: 'in_app', templateKey: 'ride.driver_assigned', locale: 'pt-BR', maxRetries: 3 },
  { eventTrigger: 'ride.driver_arrived.v1', recipient: 'passenger', channel: 'push', fallbackChannel: 'in_app', templateKey: 'ride.driver_arrived', locale: 'pt-BR', maxRetries: 3 },
  { eventTrigger: 'ride.completed.v1', recipient: 'passenger', channel: 'in_app', fallbackChannel: null, templateKey: 'ride.receipt', locale: 'pt-BR', maxRetries: 3 },
  { eventTrigger: 'ride.cancelled.v1', recipient: 'passenger', channel: 'push', fallbackChannel: 'in_app', templateKey: 'ride.cancelled', locale: 'pt-BR', maxRetries: 3 },
  { eventTrigger: 'ride.cancelled.v1', recipient: 'driver', channel: 'push', fallbackChannel: 'in_app', templateKey: 'ride.cancelled', locale: 'pt-BR', maxRetries: 3 },
  { eventTrigger: 'payment.updated.v1', recipient: 'passenger', channel: 'in_app', fallbackChannel: null, templateKey: 'payment.updated', locale: 'pt-BR', maxRetries: 5 },
];

export type NotificationStatus = 'pending' | 'sent' | 'failed';

export interface Notification {
  readonly id: string;
  readonly tenantId: string;
  readonly recipientUserId: string;
  readonly channel: NotificationChannel;
  readonly templateKey: string;
  readonly locale: string;
  readonly variables: Record<string, unknown>;
  readonly dedupeKey: string;
  status: NotificationStatus;
  attempts: number;
  readonly createdAt: Date;
}

export interface DeviceToken {
  readonly id: string;
  readonly userId: string;
  readonly tenantId: string;
  readonly platform: 'ios' | 'android';
  readonly token: string;
}

/** Templates padrão da plataforma (neutros, sem marca de tenant). */
export const PLATFORM_TEMPLATES: Readonly<Record<string, string>> = {
  'ride.driver_assigned': 'Motorista a caminho da sua corrida.',
  'ride.driver_arrived': 'O motorista chegou ao embarque.',
  'ride.receipt': 'Recibo da corrida disponível.',
  'ride.cancelled': 'Sua corrida foi cancelada.',
  'payment.updated': 'Atualização no pagamento da corrida.',
};

export function renderTemplate(templateKey: string, overrides: Record<string, string> = {}): string {
  return overrides[templateKey] ?? PLATFORM_TEMPLATES[templateKey] ?? templateKey;
}

export function validateNotification(notification: Notification): void {
  if (notification.dedupeKey.trim() === '') {
    throw new DomainError('VALIDATION_FAILED', 'Notifications require a deduplication key.');
  }
}
