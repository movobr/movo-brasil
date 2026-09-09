/**
 * Branding white-label por tenant — contrato 06-WHITE-LABEL-CONTRACT.
 * Branding é dado/configuração de runtime; nada é hard-coded por cliente.
 */

export interface BrandingConfig {
  legalName?: string;
  commercialName?: string;
  primaryLogoUrl?: string;
  logoLightUrl?: string;
  logoDarkUrl?: string;
  appIconUrl?: string;
  faviconUrl?: string;
  /** Tokens semânticos de cor (ex.: primary, surface, onPrimary). */
  colors?: Record<string, string>;
  fontFamily?: string;
  splashArtworkUrl?: string;
  serviceImageryUrls?: ReadonlyArray<string>;
  supportContacts?: Record<string, string>;
  domain?: string;
  legalUrls?: Record<string, string>;
  copy?: Record<string, string>;
}

export type ResolvedTheme =
  | { readonly kind: 'platform-default' }
  | { readonly kind: 'tenant'; readonly tokens: Record<string, string> };

const HEX_COLOR = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function isHttpsUrl(value: string): boolean {
  return value.startsWith('https://') && value.length > 'https://'.length;
}

/**
 * Validação estrutural (tipo/dimensões de arquivo e conteúdo seguro de
 * imagem ocorrem na ativação de assets, fora do escopo da Fase 1).
 * Retorna a lista de problemas; vazio = estruturalmente válido.
 */
export function validateBranding(branding: BrandingConfig): string[] {
  const issues: string[] = [];
  const urls: ReadonlyArray<[string, string | undefined]> = [
    ['primaryLogoUrl', branding.primaryLogoUrl],
    ['logoLightUrl', branding.logoLightUrl],
    ['logoDarkUrl', branding.logoDarkUrl],
    ['appIconUrl', branding.appIconUrl],
    ['faviconUrl', branding.faviconUrl],
    ['splashArtworkUrl', branding.splashArtworkUrl],
  ];
  for (const [field, value] of urls) {
    if (value !== undefined && !isHttpsUrl(value)) {
      issues.push(`${field} must be an https URL.`);
    }
  }
  if (branding.serviceImageryUrls !== undefined) {
    for (const url of branding.serviceImageryUrls) {
      if (!isHttpsUrl(url)) issues.push('serviceImageryUrls must contain https URLs only.');
    }
  }
  if (branding.colors !== undefined) {
    for (const [token, color] of Object.entries(branding.colors)) {
      if (!HEX_COLOR.test(color)) issues.push(`colors.${token} must be a hex color.`);
    }
  }
  return issues;
}

/**
 * Fallback seguro (06): branding ausente ou estruturalmente inválido
 * resolve para o tema padrão da plataforma — nunca UI quebrada, nunca
 * vazamento de identidade entre tenants (cada resolução usa somente o
 * branding do tenant da sessão).
 */
export function resolveTheme(branding: BrandingConfig | null): ResolvedTheme {
  if (branding === null) return { kind: 'platform-default' };
  if (validateBranding(branding).length > 0) return { kind: 'platform-default' };
  return { kind: 'tenant', tokens: { ...(branding.colors ?? {}) } };
}
