'use server';

import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';
import { SupabaseAuthProvider } from '@movo/brasil/src/infrastructure/supabase/auth-provider.js';
import { SessionService } from '@movo/brasil/src/application/session-service.js';
import { createPublicSupabaseClient } from '@movo/brasil/src/infrastructure/supabase/client.js';
import type { UserRepository } from '@movo/brasil/src/application/repositories.js';
import { getBackend, isLiveMode } from '../../lib/backend.js';
import { SESSION_COOKIE, sealSession } from '../../lib/session.js';
import { DemoAuthProvider, establishDemoActor } from '../../lib/demo-auth.js';

function useLive(): boolean {
  if (!isLiveMode()) return false;
  return (
    process.env['SUPABASE_URL'] !== undefined &&
    process.env['SUPABASE_SERVICE_ROLE_KEY'] !== undefined &&
    (process.env['SUPABASE_PUBLISHABLE_KEY'] !== undefined ||
      process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] !== undefined)
  );
}

export async function loginAction(formData: FormData): Promise<never> {
  const email = String(formData.get('email') ?? '').toLowerCase();
  const code = String(formData.get('code') ?? '');
  const backend = await getBackend();
  if (useLive()) {
    if (backend.users === null) throw new Error('Repositório de usuários indisponível.');
    const provider = new SupabaseAuthProvider(createPublicSupabaseClient());
    // AuthN real; permissões vêm da tabela de produção pelo papel (Fase 27).
    // O campo "código" do formulário é a senha no fluxo vivo.
    const service = new SessionService(backend.users as UserRepository);
    const { actor } = await service.establishFromEmail(provider, { email, password: code }, []);
    (await cookies()).set(SESSION_COOKIE, sealSession(actor), { httpOnly: true, sameSite: 'lax', path: '/' });
    redirect('/');
  }
  if (backend.users === null || !('findByEmail' in backend.users)) {
    throw new Error('Login demo indisponível.');
  }
  const users = backend.users as UserRepository | null;
  if (users === null) {
    throw new Error('Login demo indisponível.');
  }
  const actor = await establishDemoActor(users, new DemoAuthProvider(users), email, code);
  (await cookies()).set(SESSION_COOKIE, sealSession(actor), { httpOnly: true, sameSite: 'lax', path: '/' });
  redirect(actor.tenantId === null ? '/admin/tenants' : '/');
}

export async function logoutAction(): Promise<never> {
  (await cookies()).delete(SESSION_COOKIE);
  redirect('/login');
}
