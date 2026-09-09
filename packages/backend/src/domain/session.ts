import { DomainError } from './errors.js';

/**
 * Sessão autenticada — contratos 02 (contexto de tenant) e 33 (MFA).
 * A sessão carrega identidade do ator, escopo de tenant, papel/permissões
 * resolvidos no backend e evidência de MFA. O cliente nunca afirma nada disso.
 */

export interface SessionInit {
  sessionId: string;
  userId: string;
  tenantId: string | null;
  role: string;
  permissions: ReadonlyArray<string>;
  mfaVerified: boolean;
  expiresAt: Date;
  correlationId: string;
}

/** Papéis privilegiados exigem MFA (33-SECURITY-BASELINE). */
const MFA_REQUIRED_ROLES: ReadonlyArray<string> = ['MOVO_PLATFORM_ADMIN', 'TENANT_ADMIN'];

export class Session {
  readonly sessionId: string;
  readonly userId: string;
  readonly tenantId: string | null;
  readonly role: string;
  readonly permissions: ReadonlyArray<string>;
  readonly mfaVerified: boolean;
  readonly expiresAt: Date;
  readonly correlationId: string;

  private constructor(init: SessionInit) {
    this.sessionId = init.sessionId;
    this.userId = init.userId;
    this.tenantId = init.tenantId;
    this.role = init.role;
    this.permissions = init.permissions;
    this.mfaVerified = init.mfaVerified;
    this.expiresAt = init.expiresAt;
    this.correlationId = init.correlationId;
  }

  static establish(init: SessionInit, now: Date): Session {
    if (init.expiresAt.getTime() <= now.getTime()) {
      throw new DomainError('UNAUTHORIZED', 'Session is expired.');
    }
    return new Session(init);
  }

  /** Impõe MFA para papéis privilegiados antes de emitir contexto de ator. */
  assertMfaPolicy(): void {
    if (MFA_REQUIRED_ROLES.includes(this.role) && !this.mfaVerified) {
      throw new DomainError('UNAUTHORIZED', `MFA is required for role ${this.role}.`, {
        role: this.role,
      });
    }
  }

  isExpired(now: Date): boolean {
    return this.expiresAt.getTime() <= now.getTime();
  }
}
