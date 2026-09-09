import { describe, expect, it } from 'vitest';
import { PERMISSION_POLICIES, policyFor } from '../src/lib/permissions.js';
import { isValidOtpCode, normalizeBrPhone } from '../src/lib/phone.js';
import { estimateFare, formatBrl } from '../src/lib/quote.js';
import { paletteFor } from '../src/lib/theme.js';
import { InMemorySessionStore } from '../src/lib/session-store.js';

describe('mobile contracts (64/21/14)', () => {
  it('every device permission has purpose and denial fallback', () => {
    expect(PERMISSION_POLICIES.length).toBeGreaterThan(0);
    for (const policy of PERMISSION_POLICIES) {
      expect(policy.purpose.length).toBeGreaterThan(0);
      expect(policy.denialFallback.length).toBeGreaterThan(0);
    }
    expect(policyFor('location-foreground').purpose).toMatch(/tarifa/);
  });

  it('normalizes BR phones to E.164 and validates OTP codes', () => {
    expect(normalizeBrPhone('(11) 99999-0001')).toBe('+5511999990001');
    expect(normalizeBrPhone('+55 11 99999-0001')).toBe('+5511999990001');
    expect(normalizeBrPhone('123')).toBeNull();
    expect(isValidOtpCode('123456')).toBe(true);
    expect(isValidOtpCode('12345')).toBe(false);
  });

  it('estimates with the real pricing engine', () => {
    const quote = estimateFare('car', 10000, 1200, new Date('2026-09-09T12:00:00.000Z'));
    expect(quote.total.amountMinor).toBe(2800);
    expect(formatBrl(2800)).toBe('R$ 28,00');
  });

  it('resolves tenant palette with platform fallback', () => {
    expect(paletteFor(null).primary).toBe('#00a86b');
    expect(
      paletteFor({ commercialName: 'D', primaryLogoUrl: 'https://cdn.example/l.png', colors: { primary: '#0b5fff' } }).primary,
    ).toBe('#0b5fff');
  });

  it('stores sessions through the port', async () => {
    const store = new InMemorySessionStore();
    expect(await store.readSession()).toBeNull();
    await store.saveSession('tok-1');
    expect(await store.readSession()).toBe('tok-1');
    await store.clearSession();
    expect(await store.readSession()).toBeNull();
  });
});
