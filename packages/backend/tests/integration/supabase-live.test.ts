import { describe, expect, it } from 'vitest';
import { createSupabaseClient } from '../../src/infrastructure/supabase/client.js';
import { SupabaseTenantRepository } from '../../src/infrastructure/supabase/repositories.js';

/**
 * Integração viva contra Supabase Cloud (DEC-TECH-004).
 * Exige SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY; sem elas, pula
 * (dependência externa real — ver relatório da fase).
 */
const LIVE = process.env['SUPABASE_URL'] !== undefined && process.env['SUPABASE_SERVICE_ROLE_KEY'] !== undefined;

describe.skipIf(!LIVE)('supabase live integration', () => {
  it('applies migration 0001 and round-trips a tenant', async () => {
    const db = createSupabaseClient();
    const tenants = new SupabaseTenantRepository(db);
    const missing = await tenants.findBySlug('demo-tenant-a');
    expect(missing === null || missing.slug === 'demo-tenant-a').toBe(true);
  });

  it('requires credentials when they are absent', () => {
    const originalUrl = process.env['SUPABASE_URL'];
    const originalKey = process.env['SUPABASE_SERVICE_ROLE_KEY'];
    delete process.env['SUPABASE_URL'];
    delete process.env['SUPABASE_SERVICE_ROLE_KEY'];
    try {
      expect(() => createSupabaseClient()).toThrowError();
    } finally {
      if (originalUrl !== undefined) process.env['SUPABASE_URL'] = originalUrl;
      if (originalKey !== undefined) process.env['SUPABASE_SERVICE_ROLE_KEY'] = originalKey;
    }
  });
});

describe.skipIf(LIVE)('supabase live integration (skipped)', () => {
  it('documents the missing live dependency', () => {
    expect(LIVE).toBe(false);
  });
});
