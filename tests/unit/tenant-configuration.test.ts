import { describe, expect, it } from 'vitest';
import { DomainError } from '../../src/domain/errors.js';
import {
  createDefaultRegistry,
  TenantConfiguration,
} from '../../src/domain/tenant-configuration.js';
import { resolveTheme, validateBranding } from '../../src/domain/branding.js';

describe('tenant configuration (07)', () => {
  it('rejects unknown groups and unknown keys', () => {
    const config = new TenantConfiguration(createDefaultRegistry());
    expect(() => config.set('nope', 'x', 1)).toThrowError(DomainError);
    expect(() => config.set('pricing', 'invented_key', 1)).toThrowError(DomainError);
  });

  it('applies precedence session > tenant > platform default', () => {
    const config = new TenantConfiguration(createDefaultRegistry());
    config.setPlatformDefault('pricing', 'policy', 'platform-policy');
    expect(config.get('pricing', 'policy')).toBe('platform-policy');
    config.set('pricing', 'policy', 'tenant-policy');
    expect(config.get('pricing', 'policy')).toBe('tenant-policy');
    expect(config.get('pricing', 'policy', 'session-policy')).toBe('session-policy');
  });
});

describe('branding fallback (06)', () => {
  it('falls back to the platform default when branding is absent', () => {
    expect(resolveTheme(null)).toEqual({ kind: 'platform-default' });
  });

  it('falls back when branding is structurally invalid', () => {
    expect(validateBranding({ primaryLogoUrl: 'http://inseguro/logo.png' }).length).toBeGreaterThan(0);
    expect(validateBranding({ colors: { primary: 'not-a-color' } }).length).toBeGreaterThan(0);
    expect(resolveTheme({ primaryLogoUrl: 'http://inseguro/logo.png' })).toEqual({
      kind: 'platform-default',
    });
  });

  it('resolves tenant tokens when branding is valid', () => {
    const resolved = resolveTheme({
      commercialName: 'Demo',
      primaryLogoUrl: 'https://cdn.demo/logo.png',
      colors: { primary: '#00A86B' },
    });
    expect(resolved).toEqual({ kind: 'tenant', tokens: { primary: '#00A86B' } });
  });
});
