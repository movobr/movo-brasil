import { describe, expect, it } from 'vitest';
import { PRODUCTION_ROLE_PERMISSIONS, permissionsForRole } from '../../src/application/role-permissions.js';

/** Tabela aprovada pelo Owner (era UNSPECIFIED-007): invariantes estruturais. */
describe('production role→permission mapping (Owner DECIDED)', () => {
  it('covers the six contract roles', () => {
    expect(Object.keys(PRODUCTION_ROLE_PERMISSIONS).sort()).toEqual([
      'DRIVER',
      'MOVO_PLATFORM_ADMIN',
      'OPERATOR',
      'PASSENGER',
      'SUPPORT_AGENT',
      'TENANT_ADMIN',
    ]);
  });

  it('keeps passenger least-privileged and support read-only', () => {
    const passenger = permissionsForRole('PASSENGER');
    expect(passenger).toContain('ride.request');
    expect(passenger).not.toContain('ride.dispatch');
    expect(passenger).not.toContain('tenant.read');
    const support = permissionsForRole('SUPPORT_AGENT');
    expect(support).toContain('audit.read');
    expect(support).not.toContain('ride.accept');
    expect(support).not.toContain('ride.cancel');
  });

  it('grants ride.rate only to the raters (bilateral)', () => {
    expect(permissionsForRole('PASSENGER')).toContain('ride.rate');
    expect(permissionsForRole('DRIVER')).toContain('ride.rate');
    expect(permissionsForRole('OPERATOR')).not.toContain('ride.rate');
    expect(permissionsForRole('SUPPORT_AGENT')).not.toContain('ride.rate');
  });

  it('returns empty for unknown roles', () => {
    expect(permissionsForRole('NOPE')).toEqual([]);
  });
});
