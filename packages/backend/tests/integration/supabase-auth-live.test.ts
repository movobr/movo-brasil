import { describe, expect, it } from 'vitest';
import { createPublicSupabaseClient } from '../../src/infrastructure/supabase/client.js';
import { SupabaseAuthProvider } from '../../src/infrastructure/supabase/auth-provider.js';

/**
 * Auth viva contra Supabase Cloud (DEC-TECH-005). Usa o client PÚBLICO
 * (Fase 31): Auth de usuário nunca roda no client service_role.
 * Exige SUPABASE_URL + SUPABASE_PUBLISHABLE_KEY; sem elas, pula.
 */
const LIVE =
  process.env['SUPABASE_URL'] !== undefined &&
  (process.env['SUPABASE_PUBLISHABLE_KEY'] !== undefined ||
    process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] !== undefined);

describe.skipIf(!LIVE)('supabase auth live', () => {
  it('rejects invalid email credentials deterministically', async () => {
    const provider = new SupabaseAuthProvider(createPublicSupabaseClient());
    await expect(
      provider.signInWithEmail({ email: 'nobody@movo.demo', password: 'wrong' }),
    ).rejects.toThrowError();
  });
});

describe.skipIf(LIVE)('supabase auth live (skipped)', () => {
  it('documents the missing live dependency', () => {
    expect(LIVE).toBe(false);
  });
});
