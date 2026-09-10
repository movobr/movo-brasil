import { SessionService } from '@movo/brasil/src/application/session-service.js';
import type { AuthProvider, VerifiedSession } from '@movo/brasil/src/application/auth-ports.js';
import type { UserRepository } from '@movo/brasil/src/application/repositories.js';
import type { ActorContext } from '@movo/brasil/src/domain/authorization.js';
import { PRODUCTION_ROLE_PERMISSIONS } from '@movo/brasil/src/application/role-permissions.js';

/**
 * Mapeamento papel→permissões de PRODUÇÃO (Owner DECIDED 2026-09-10,
 * era UNSPECIFIED-007). Fonte única no backend; aqui, reexportado para
 * o DemoAuthProvider. `ride.rate` (Fase 26) integra a tabela aprovada.
 */
export const DEMO_ROLE_PERMISSIONS: Readonly<Record<string, ReadonlyArray<string>>> =
  PRODUCTION_ROLE_PERMISSIONS;

export const DEMO_AUTH_CODE = '123456';

/**
 * Provedor de demonstração (dev only): e-mail de usuário demo + código
 * fixo exibido na tela como segundo fator (mfaVerified=true). Recusado
 * em produção e sem ALLOW_DEMO_AUTH explícito.
 */
export class DemoAuthProvider implements AuthProvider {
  constructor(private readonly users: UserRepository) {}

  assertEnabled(): void {
    if (process.env['NODE_ENV'] === 'production' || process.env['ALLOW_DEMO_AUTH'] !== 'true') {
      throw new Error('BLOCKED: autenticação demo desativada. Configure o Supabase Auth.');
    }
  }

  async signInWithEmail(): Promise<VerifiedSession> {
    throw new Error('Use o código demo: chame verifyDemoCode.');
  }

  async sendPhoneOtp(): Promise<void> {}

  async verifyPhoneOtp(): Promise<VerifiedSession> {
    throw new Error('Use o código demo: chame verifyDemoCode.');
  }

  async signOut(): Promise<void> {}

  async verifyDemoCode(email: string, code: string): Promise<{ verified: VerifiedSession; role: string; tenantId: string | null }> {
    this.assertEnabled();
    const user = await this.users.findByEmail(email.toLowerCase());
    if (user === null || code !== DEMO_AUTH_CODE) {
      throw new Error('Credenciais demo inválidas.');
    }
    return {
      verified: {
        providerSessionId: `demo-${user.id}`,
        providerUserId: user.id,
        email: user.email,
        phone: user.phone,
        mfaVerified: true,
        expiresAt: new Date(Date.now() + 8 * 3600 * 1000),
      },
      role: user.role,
      tenantId: user.tenantId,
    };
  }
}

/** Estabelece ActorContext via SessionService (política MFA real, 33). */
export async function establishDemoActor(
  users: UserRepository,
  provider: DemoAuthProvider,
  email: string,
  code: string,
): Promise<ActorContext> {
  const { verified } = await provider.verifyDemoCode(email, code);
  const service = new SessionService(users);
  const local = await users.findByEmail(email.toLowerCase());
  const permissions = [...(DEMO_ROLE_PERMISSIONS[local?.role ?? ''] ?? [])];
  const { actor } = await service.establishFromEmail(
    {
      signInWithEmail: async () => verified,
      sendPhoneOtp: async () => {},
      verifyPhoneOtp: async () => verified,
      signOut: async () => {},
    },
    { email, password: '' },
    permissions,
  );
  return actor;
}
