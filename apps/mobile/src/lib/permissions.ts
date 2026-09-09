/**
 * Registro de permissões do device — 64-MOBILE-DEVICE-POLICY.
 * Cada permissão tem finalidade e UX de negação/fallback. Localização em
 * segundo plano está bloqueada no manifest (foreground only na V1).
 */
export type DevicePermission = 'location-foreground' | 'notifications';

export interface PermissionPolicy {
  readonly permission: DevicePermission;
  readonly purpose: string;
  readonly denialFallback: string;
}

export const PERMISSION_POLICIES: ReadonlyArray<PermissionPolicy> = [
  {
    permission: 'location-foreground',
    purpose: 'Encontrar motoristas próximos e calcular a tarifa da corrida.',
    denialFallback: 'Busca por endereço digitado; sem ETA automático nem ofertas por proximidade.',
  },
  {
    permission: 'notifications',
    purpose: 'Avisar sobre ofertas, chegada do motorista e status do pagamento.',
    denialFallback: 'Status consultado na tela da corrida; sem alertas em segundo plano.',
  },
];

export function policyFor(permission: DevicePermission): PermissionPolicy {
  const policy = PERMISSION_POLICIES.find((p) => p.permission === permission);
  if (policy === undefined) throw new Error(`Unknown device permission: ${permission}.`);
  return policy;
}
