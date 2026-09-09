import { randomUUID } from 'node:crypto';
import { DomainError } from '../domain/errors.js';
import { Session } from '../domain/session.js';
import type { ActorContext } from '../domain/authorization.js';
import type { User } from '../domain/user.js';
import type { UserRepository } from './repositories.js';
import type { AuthProvider, EmailCredentials, VerifiedSession } from './auth-ports.js';

/**
 * Emissão de contexto de ator a partir de sessão verificada (02).
 * O backend resolve usuário local <-> identidade do provedor, vincula o
 * tenant do cadastro (nunca do cliente) e impõe a política de MFA (33).
 */
export class SessionService {
  constructor(
    private readonly users: UserRepository,
    private readonly clock: { now: () => Date } = { now: () => new Date() },
    private readonly newId: () => string = randomUUID,
  ) {}

  async establishFromEmail(
    provider: AuthProvider,
    credentials: EmailCredentials,
    permissions: ReadonlyArray<string>,
  ): Promise<{ session: Session; actor: ActorContext }> {
    const verified = await provider.signInWithEmail(credentials);
    return this.buildActor(verified, permissions);
  }

  async establishFromPhoneOtp(
    provider: AuthProvider,
    phone: string,
    token: string,
    permissions: ReadonlyArray<string>,
  ): Promise<{ session: Session; actor: ActorContext }> {
    const verified = await provider.verifyPhoneOtp(phone, token);
    return this.buildActor(verified, permissions);
  }

  private async buildActor(
    verified: VerifiedSession,
    permissions: ReadonlyArray<string>,
  ): Promise<{ session: Session; actor: ActorContext }> {
    const user = await this.findLocalUser(verified);
    const now = this.clock.now();
    const session = Session.establish(
      {
        sessionId: this.newId(),
        userId: user.id,
        tenantId: user.tenantId,
        role: user.role,
        permissions,
        mfaVerified: verified.mfaVerified,
        expiresAt: verified.expiresAt,
        correlationId: this.newId(),
      },
      now,
    );
    session.assertMfaPolicy();
    const actor: ActorContext = {
      userId: user.id,
      tenantId: user.tenantId,
      permissions: [...permissions],
      correlationId: session.correlationId,
    };
    return { session, actor };
  }

  private async findLocalUser(verified: VerifiedSession): Promise<User> {
    // A identidade vem do provedor; o tenant vem do cadastro local.
    if (verified.email !== null) {
      const byEmail = await this.users.findByEmail(verified.email);
      if (byEmail !== null) return byEmail;
    }
    if (verified.phone !== null) {
      const byPhone = await this.users.findByPhone(verified.phone);
      if (byPhone !== null) return byPhone;
    }
    throw new DomainError('NOT_FOUND', 'No local user is linked to this verified identity.');
  }
}
