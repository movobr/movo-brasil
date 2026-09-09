import { describe, expect, it } from 'vitest';
import { themeKindFor, themeStyleFor } from './theme.js';

describe('tenant theme resolution (06/27)', () => {
  it('falls back to platform defaults without branding', () => {
    expect(themeKindFor(null)).toBe('platform-default');
    expect(themeStyleFor(null)).toMatchObject({ '--color-primary': '#00a86b' });
  });

  it('falls back on invalid branding instead of leaking values', () => {
    expect(themeKindFor({ primaryLogoUrl: 'http://inseguro/logo.png' })).toBe('platform-default');
  });

  it('maps valid tenant tokens to CSS variables', () => {
    const style = themeStyleFor({
      commercialName: 'Demo',
      primaryLogoUrl: 'https://cdn.demo/logo.png',
      colors: { primary: '#0b5fff' },
    });
    expect(themeKindFor({
      commercialName: 'Demo',
      primaryLogoUrl: 'https://cdn.demo/logo.png',
      colors: { primary: '#0b5fff' },
    })).toBe('tenant');
    expect(style).toMatchObject({ '--color-primary': '#0b5fff' });
  });
});
