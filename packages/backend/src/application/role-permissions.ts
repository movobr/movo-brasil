/**
 * Mapeamento papel→permissões de PRODUÇÃO — DECIDED pelo Owner em
 * 2026-09-10 (era UNSPECIFIED-007). O Blueprint (09) lista papéis e
 * permissões, mas não o mapeamento; esta tabela é a decisão aprovada.
 * Mudanças exigem nova decisão do Owner (46-CHANGE-CONTROL), nunca
 * edição silenciosa. Congelada em runtime (frozen).
 */
export const PRODUCTION_ROLE_PERMISSIONS: Readonly<Record<string, ReadonlyArray<string>>> = Object.freeze({
  MOVO_PLATFORM_ADMIN: Object.freeze([
    'tenant.read', 'tenant.update', 'subscription.read', 'subscription.manage', 'audit.read',
    'ride.read', 'ride.dispatch', 'ride.accept', 'ride.cancel', 'ride.chat',
    'driver.read', 'driver.manage',
  ]),
  TENANT_ADMIN: Object.freeze([
    'tenant.read', 'tenant.update', 'branding.manage', 'driver.read', 'driver.manage',
    'ride.read', 'ride.dispatch', 'ride.chat', 'audit.read', 'subscription.read',
  ]),
  OPERATOR: Object.freeze(['ride.read', 'ride.dispatch', 'ride.cancel', 'ride.chat', 'driver.read']),
  SUPPORT_AGENT: Object.freeze(['ride.read', 'ride.chat', 'audit.read']),
  // driver.manage cobre o autosserviço (disponibilidade própria).
  DRIVER: Object.freeze(['ride.read', 'ride.accept', 'ride.chat', 'ride.rate', 'driver.read', 'driver.manage']),
  PASSENGER: Object.freeze(['ride.request', 'ride.read', 'ride.cancel', 'ride.chat', 'ride.rate']),
});

export function permissionsForRole(role: string): ReadonlyArray<string> {
  return PRODUCTION_ROLE_PERMISSIONS[role] ?? [];
}
