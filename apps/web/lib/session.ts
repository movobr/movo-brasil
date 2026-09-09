import { createHmac, timingSafeEqual } from 'node:crypto';
import type { ActorContext } from '@movo/brasil/src/domain/authorization.js';

/**
 * Sessão web selada (cookie). HMAC-SHA256 com SESSION_SECRET; expiração
 * verificada a cada leitura. Sem segredos no código (72).
 */
export const SESSION_COOKIE = 'movo_session';
const SESSION_TTL_MS = 8 * 3600 * 1000;

export interface SealedSession extends ActorContext {
  expiresAt: number;
}

function secret(): string {
  const value = process.env['SESSION_SECRET'];
  if (value === undefined || value === '') {
    throw new Error('BLOCKED: defina SESSION_SECRET para assinar sessões.');
  }
  return value;
}

export function sealSession(actor: ActorContext, nowMs: number = Date.now()): string {
  const sealed: SealedSession = { ...actor, permissions: [...actor.permissions], expiresAt: nowMs + SESSION_TTL_MS };
  const payload = Buffer.from(JSON.stringify(sealed), 'utf8').toString('base64url');
  const signature = createHmac('sha256', secret()).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export function verifySession(sealed: string, nowMs: number = Date.now()): ActorContext {
  const [payload, signature] = sealed.split('.');
  if (payload === undefined || signature === undefined) throw new Error('Sessão inválida.');
  const expected = createHmac('sha256', secret()).update(payload).digest();
  const received = Buffer.from(signature, 'base64url');
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) {
    throw new Error('Sessão inválida.');
  }
  const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as SealedSession;
  if (typeof parsed.expiresAt !== 'number' || nowMs > parsed.expiresAt) {
    throw new Error('Sessão expirada.');
  }
  return { userId: parsed.userId, tenantId: parsed.tenantId, permissions: parsed.permissions, correlationId: parsed.correlationId };
}
