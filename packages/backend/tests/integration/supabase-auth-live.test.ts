import { describe, expect, it } from 'vitest';
import { createSupabaseClient } from '../../src/infrastructure/supabase/client.js';
import { SupabaseAuthProvider } from '../../src/infrastructure/supabase/auth-provider.js';

/**
 * Auth viva contra Supabase Cloud (DEC-TECH-005). Exige SUPABASE_URL +
 * SUPABASE_SERVICE_ROLE_KEY; sem elas, pula como o teste de banco.
 */
const LIVE = process.env['SUPABASE_URL'] !== undefined && process.env['SUPABASE_SERVICE_ROLE_KEY'] !== undefined;

describe.skipIf(!LIVE)('supabase auth live', () => {
  it('rejects invalid email credentials deterministically', async () => {
    const provider = new SupabaseAuthProvider(createSupabaseClient());
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
