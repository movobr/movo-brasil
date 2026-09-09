/**
 * Portas do provedor de autenticação — DEC-TECH-005.
 * Web admin: e-mail/senha + MFA. Passageiro/motorista: telefone OTP.
 * Implementação viva em infrastructure/supabase/auth-provider.ts.
 */

export interface EmailCredentials {
  email: string;
  password: string;
}

export interface VerifiedSession {
  providerSessionId: string;
  providerUserId: string;
  email: string | null;
  phone: string | null;
  mfaVerified: boolean;
  expiresAt: Date;
}

export interface AuthProvider {
  signInWithEmail(credentials: EmailCredentials): Promise<VerifiedSession>;
  sendPhoneOtp(phone: string): Promise<void>;
  verifyPhoneOtp(phone: string, token: string): Promise<VerifiedSession>;
  signOut(providerSessionId: string): Promise<void>;
}
