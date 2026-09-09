import { cookies } from 'next/headers';
import { SESSION_COOKIE, verifySession, type SealedSession } from './session.js';
import type { ActorContext } from '@movo/brasil/src/domain/authorization.js';

/** Lê o ator da sessão selada; sem sessão válida, nega (deny-by-default). */
export async function requireSession(): Promise<ActorContext> {
  const jar = await cookies();
  const sealed = jar.get(SESSION_COOKIE)?.value;
  if (sealed === undefined) throw new Error('Sessão necessária: entre em /login.');
  return verifySession(sealed);
}

export async function readSession(): Promise<ActorContext | null> {
  try {
    return await requireSession();
  } catch {
    return null;
  }
}

export type { SealedSession };
