import type { CSSProperties } from 'react';
import { resolveTheme, type BrandingConfig } from '@movo/brasil/src/domain/branding.js';

/**
 * Resolução de tema do tenant (06/27): branding válido vira variáveis CSS
 * semânticas em runtime; ausente/inválido cai no padrão da plataforma.
 * Nunca mistura identidade entre tenants: cada página resolve somente o
 * branding do tenant da sessão.
 */
const PLATFORM_DEFAULTS: Record<string, string> = {
  '--color-primary': '#00a86b',
  '--color-on-primary': '#ffffff',
  '--color-surface': '#ffffff',
  '--color-on-surface': '#101613',
};

export function themeStyleFor(branding: BrandingConfig | null): CSSProperties {
  const resolved = resolveTheme(branding);
  if (resolved.kind === 'platform-default') {
    return { ...PLATFORM_DEFAULTS } as CSSProperties;
  }
  return {
    ...PLATFORM_DEFAULTS,
    ...(resolved.tokens['primary'] !== undefined ? { '--color-primary': resolved.tokens['primary'] } : {}),
    ...(resolved.tokens['surface'] !== undefined ? { '--color-surface': resolved.tokens['surface'] } : {}),
    ...(resolved.tokens['onSurface'] !== undefined ? { '--color-on-surface': resolved.tokens['onSurface'] } : {}),
  } as CSSProperties;
}

export function themeKindFor(branding: BrandingConfig | null): 'platform-default' | 'tenant' {
  return resolveTheme(branding).kind;
}

/** Tema padrão da plataforma (fallback do 06) para o layout raiz. */
export const PLATFORM_THEME_STYLE: CSSProperties = {
  '--color-primary': '#00a86b',
  '--color-on-primary': '#ffffff',
  '--color-surface': '#ffffff',
  '--color-on-surface': '#101613',
} as CSSProperties;
