import { resolveTheme, type BrandingConfig } from '@movo/brasil/src/domain/branding.js';

/** Paleta do app resolvida do branding do tenant (06/27). */
export interface AppPalette {
  readonly primary: string;
  readonly onPrimary: string;
  readonly surface: string;
  readonly onSurface: string;
}

const PLATFORM_PALETTE: AppPalette = {
  primary: '#00a86b',
  onPrimary: '#ffffff',
  surface: '#ffffff',
  onSurface: '#101613',
};

export function paletteFor(branding: BrandingConfig | null): AppPalette {
  const resolved = resolveTheme(branding);
  if (resolved.kind === 'platform-default') return PLATFORM_PALETTE;
  return {
    primary: resolved.tokens['primary'] ?? PLATFORM_PALETTE.primary,
    onPrimary: PLATFORM_PALETTE.onPrimary,
    surface: resolved.tokens['surface'] ?? PLATFORM_PALETTE.surface,
    onSurface: resolved.tokens['onSurface'] ?? PLATFORM_PALETTE.onSurface,
  };
}
