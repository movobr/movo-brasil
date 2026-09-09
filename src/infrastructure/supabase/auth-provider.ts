import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '../../domain/errors.js';
import type { AuthProvider, EmailCredentials, VerifiedSession } from '../../application/auth-ports.js';

/**
 * Provedor vivo via Supabase Auth (DEC-TECH-005).
 * E-mail/senha (+MFA do provedor) para admins web; OTP de telefone para
 * passageiro/motorista. OTP telefônico operacional via Twilio Verify
 * (DEC-NOT-002) será ligado na fase de notificações.
 */
export class SupabaseAuthProvider implements AuthProvider {
  constructor(private readonly db: SupabaseClient) {}

  async signInWithEmail(credentials: EmailCredentials): Promise<VerifiedSession> {
    const { data, error } = await this.db.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });
    if (error !== null || data.session === null || data.user === null) {
      throw new DomainError('UNAUTHORIZED', `Email sign-in failed: ${error?.message ?? 'no session'}.`);
    }
    const { data: aal } = await this.db.auth.mfa.getAuthenticatorAssuranceLevel();
    return {
      providerSessionId: data.session.access_token,
      providerUserId: data.user.id,
      email: data.user.email ?? null,
      phone: data.user.phone ?? null,
      mfaVerified: aal?.currentLevel === 'aal2',
      expiresAt: new Date((data.session.expires_at ?? 0) * 1000),
    };
  }

  async sendPhoneOtp(phone: string): Promise<void> {
    const { error } = await this.db.auth.signInWithOtp({ phone });
    if (error !== null) {
      throw new DomainError('PERSISTENCE_FAILED', `Phone OTP send failed: ${error.message}`);
    }
  }

  async verifyPhoneOtp(phone: string, token: string): Promise<VerifiedSession> {
    const { data, error } = await this.db.auth.verifyOtp({ phone, token, type: 'sms' });
    if (error !== null || data.session === null || data.user === null) {
      throw new DomainError('UNAUTHORIZED', `Phone OTP verification failed: ${error?.message ?? 'no session'}.`);
    }
    return {
      providerSessionId: data.session.access_token,
      providerUserId: data.user.id,
      email: data.user.email ?? null,
      phone: data.user.phone ?? null,
      mfaVerified: true,
      expiresAt: new Date((data.session.expires_at ?? 0) * 1000),
    };
  }

  async signOut(providerSessionId: string): Promise<void> {
    void providerSessionId;
    const { error } = await this.db.auth.signOut();
    if (error !== null) {
      throw new DomainError('PERSISTENCE_FAILED', `Sign-out failed: ${error.message}`);
    }
  }
}
