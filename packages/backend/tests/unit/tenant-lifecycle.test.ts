import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import { Tenant } from '../../src/domain/tenant.js';

const NOW = new Date('2026-09-09T12:00:00.000Z');

function provisioned() {
  return Tenant.provision({ id: 't-1', slug: 'tenant-a', name: 'Tenant A', now: NOW });
}

describe('tenant lifecycle (05)', () => {
  it('provisions in PROVISIONING', () => {
    expect(provisioned().status).toBe('PROVISIONING');
  });

  it('walks the documented chain to ACTIVE', () => {
    const tenant = provisioned();
    tenant.transitionTo('CONFIGURING', NOW);
    tenant.transitionTo('PENDING_ACTIVATION', NOW);
    tenant.transitionTo('ACTIVE', NOW);
    expect(tenant.status).toBe('ACTIVE');
  });

  it('suspends from ACTIVE and cancels from SUSPENDED', () => {
    const tenant = provisioned();
    tenant.transitionTo('CONFIGURING', NOW);
    tenant.transitionTo('PENDING_ACTIVATION', NOW);
    tenant.transitionTo('ACTIVE', NOW);
    tenant.transitionTo('SUSPENDED', NOW);
    tenant.transitionTo('CANCELLED', NOW);
    expect(tenant.status).toBe('CANCELLED');
  });

  it('rejects undocumented transitions deterministically', () => {
    const tenant = provisioned();
    expect(() => tenant.transitionTo('ACTIVE', NOW)).toThrowError(DomainError);
    try {
      tenant.transitionTo('ACTIVE', NOW);
      expect.unreachable();
    } catch (error) {
      expect((error as DomainError).code).toBe('INVALID_TRANSITION');
    }
  });

  it('does not resume from SUSPENDED (closed table; see UNSPECIFIED-001)', () => {
    const tenant = provisioned();
    tenant.transitionTo('CONFIGURING', NOW);
    tenant.transitionTo('PENDING_ACTIVATION', NOW);
    tenant.transitionTo('ACTIVE', NOW);
    tenant.transitionTo('SUSPENDED', NOW);
    expect(() => tenant.transitionTo('ACTIVE', NOW)).toThrowError(DomainError);
  });

  it('blocks activation while the blocking set is incomplete', () => {
    const tenant = provisioned();
    try {
      tenant.assertCanActivate({
        identityComplete: true,
        legalContentAccepted: false,
        serviceTypes: [],
        operatingAreas: [],
        pricingPolicySet: false,
        paymentRequired: false,
        paymentCapabilityReady: false,
        driverOnboardingPolicySet: false,
      });
      expect.unreachable();
    } catch (error) {
      const domainError = error as DomainError;
      expect(domainError.code).toBe('VALIDATION_FAILED');
      const missing = (domainError.details?.['missing'] ?? []) as string[];
      expect(missing).toContain('legal_content');
      expect(missing).toContain('service_type');
      expect(missing).toContain('operating_area');
    }
  });

  it('requires payment capability only when payment is required', () => {
    const tenant = provisioned();
    expect(() =>
      tenant.assertCanActivate({
        identityComplete: true,
        legalContentAccepted: true,
        serviceTypes: ['car'],
        operatingAreas: ['zone-1'],
        pricingPolicySet: true,
        paymentRequired: false,
        paymentCapabilityReady: false,
        driverOnboardingPolicySet: true,
      }),
    ).not.toThrow();
  });
});
