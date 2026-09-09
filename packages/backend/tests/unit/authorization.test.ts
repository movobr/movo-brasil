import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import { authorize, type ActorContext } from '../../src/domain/authorization.js';

function actor(overrides: Partial<ActorContext> = {}): ActorContext {
  return {
    userId: 'u-1',
    tenantId: 'tenant-a',
    permissions: ['tenant.read'],
    correlationId: 'corr-1',
    ...overrides,
  };
}

describe('authorization (02/09)', () => {
  it('denies cross-tenant access even when the permission is held', () => {
    const other = actor({ tenantId: 'tenant-b', permissions: ['tenant.read', 'ride.read'] });
    expect(() => authorize(other, 'ride.read', 'tenant-a')).toThrowError(DomainError);
    try {
      authorize(other, 'ride.read', 'tenant-a');
      expect.unreachable();
    } catch (error) {
      expect((error as DomainError).code).toBe('CROSS_TENANT_DENIED');
    }
  });

  it('allows same-tenant access when the permission is held', () => {
    expect(() => authorize(actor(), 'tenant.read', 'tenant-a')).not.toThrow();
  });

  it('denies same-tenant access without the permission', () => {
    try {
      authorize(actor({ permissions: [] }), 'tenant.read', 'tenant-a');
      expect.unreachable();
    } catch (error) {
      expect((error as DomainError).code).toBe('UNAUTHORIZED');
    }
  });

  it('requires explicit permission from platform principals', () => {
    const platform = actor({ tenantId: null, permissions: [] });
    expect(() => authorize(platform, 'tenant.read', 'tenant-a')).toThrowError(DomainError);
    const allowed = actor({ tenantId: null, permissions: ['tenant.read'] });
    expect(() => authorize(allowed, 'tenant.read', 'tenant-a')).not.toThrow();
  });
});
