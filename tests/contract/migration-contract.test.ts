import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Teste de contrato da migration 0001 contra o 11-DATABASE-CONTRACT.
 * Valida o texto SQL versionado (sem exigir banco vivo).
 */
const SQL = readFileSync(new URL('../../db/migrations/0001_foundation.sql', import.meta.url), 'utf8');

describe('migration 0001 contract (11)', () => {
  it('creates the baseline tables with required columns', () => {
    for (const table of ['tenants', 'users', 'audit_events']) {
      expect(SQL).toMatch(new RegExp(`create table if not exists ${table} \\(`, 'i'));
    }
    expect(SQL).toMatch(/slug text unique not null/i);
    expect(SQL).toMatch(/tenant_id uuid (null|not null) references tenants \(id\)/i);
    expect(SQL).toMatch(/amount_minor|created_at timestamptz not null/i);
    expect(SQL).toMatch(/metadata jsonb not null/i);
  });

  it('uses timezone-aware timestamps everywhere', () => {
    // tenants (created/updated) + users (created/updated) + audit (created only:
    // append-only por contrato 32, sem updated_at).
    const timestampColumns = SQL.match(/timestamptz not null/gi) ?? [];
    expect(timestampColumns.length).toBe(5);
    expect(SQL).toMatch(/created_at timestamptz not null/gi);
    expect(SQL).not.toMatch(/[^a-z_]timestamp[^t]/i);
  });

  it('enables deny-by-default RLS on every table', () => {
    for (const table of ['tenants', 'users', 'audit_events']) {
      expect(SQL).toMatch(new RegExp(`alter table ${table} enable row level security`, 'i'));
    }
  });

  it('indexes tenant-scoped query patterns', () => {
    expect(SQL).toMatch(/users_tenant_id_idx/i);
    expect(SQL).toMatch(/audit_events_tenant_id_idx/i);
  });
});

const SQL2 = readFileSync(new URL('../../db/migrations/0002_rides_payments.sql', import.meta.url), 'utf8');

describe('migration 0002 contract (11)', () => {
  it('creates rides and payments with ownership and money fields', () => {
    expect(SQL2).toMatch(/create table if not exists rides \(/i);
    expect(SQL2).toMatch(/create table if not exists payments \(/i);
    expect(SQL2).toMatch(/tenant_id uuid not null references tenants \(id\)/i);
    expect(SQL2).toMatch(/passenger_id uuid not null references users \(id\)/i);
    expect(SQL2).toMatch(/driver_id uuid null references users \(id\)/i);
    expect(SQL2).toMatch(/quoted_minor bigint not null/i);
    expect(SQL2).toMatch(/amount_minor bigint not null/i);
    expect(SQL2).toMatch(/idempotency_key text not null unique/i);
    expect(SQL2).toMatch(/requested_at timestamptz not null/i);
  });

  it('enables deny-by-default RLS on both tables', () => {
    expect(SQL2).toMatch(/alter table rides enable row level security/i);
    expect(SQL2).toMatch(/alter table payments enable row level security/i);
  });
});
