import { DomainError } from './errors.js';

/**
 * Configuração de tenant — contrato 07-TENANT-CONFIGURATION.
 * Grupos fechados; chaves desconhecidas são rejeitadas (nunca aceitar
 * JSON arbitrário silenciosamente). Precedência:
 * contexto de request/sessão -> override do tenant -> padrão da plataforma.
 */
export const CONFIG_GROUPS = [
  'branding',
  'identity',
  'operations',
  'service_catalog',
  'pricing',
  'cancellation',
  'payment_methods',
  'notifications',
  'features',
  'support',
  'legal_content',
] as const;

export type ConfigGroup = (typeof CONFIG_GROUPS)[number];

export interface ConfigKeyDef {
  group: ConfigGroup;
  key: string;
}

export class ConfigKeyRegistry {
  private readonly keys = new Set<string>();

  register(def: ConfigKeyDef): void {
    this.keys.add(`${def.group}.${def.key}`);
  }

  has(group: string, key: string): boolean {
    return this.keys.has(`${group}.${key}`);
  }
}

/**
 * Chaves derivadas mecanicamente do conjunto bloqueante de ativação (05).
 * DERIVED-003: os nomes são identificadores internos; o comportamento
 * (o que é exigido para ativação) vem integralmente do contrato 05.
 */
export const WELL_KNOWN_KEYS: ReadonlyArray<ConfigKeyDef> = [
  { group: 'identity', key: 'legal_name' },
  { group: 'legal_content', key: 'accepted' },
  { group: 'service_catalog', key: 'service_types' },
  { group: 'operations', key: 'operating_areas' },
  { group: 'pricing', key: 'policy' },
  { group: 'payment_methods', key: 'capability_ready' },
  { group: 'operations', key: 'driver_onboarding_policy' },
];

export function createDefaultRegistry(): ConfigKeyRegistry {
  const registry = new ConfigKeyRegistry();
  for (const def of WELL_KNOWN_KEYS) registry.register(def);
  return registry;
}

export class TenantConfiguration {
  private readonly values = new Map<string, unknown>();
  private readonly platformDefaults = new Map<string, unknown>();

  constructor(private readonly registry: ConfigKeyRegistry) {}

  setPlatformDefault(group: string, key: string, value: unknown): void {
    this.assertKnown(group, key);
    this.platformDefaults.set(`${group}.${key}`, value);
  }

  set(group: string, key: string, value: unknown): void {
    this.assertKnown(group, key);
    this.values.set(`${group}.${key}`, value);
  }

  /**
   * Precedência 07: override de sessão/request > override do tenant > padrão.
   */
  get(group: string, key: string, sessionOverride?: unknown): unknown {
    this.assertKnown(group, key);
    const namespaced = `${group}.${key}`;
    if (sessionOverride !== undefined) return sessionOverride;
    if (this.values.has(namespaced)) return this.values.get(namespaced);
    return this.platformDefaults.get(namespaced);
  }

  private assertKnown(group: string, key: string): void {
    if (!(CONFIG_GROUPS as ReadonlyArray<string>).includes(group)) {
      throw new DomainError('VALIDATION_FAILED', `Unknown configuration group: ${group}.`, { group });
    }
    if (!this.registry.has(group, key)) {
      throw new DomainError('VALIDATION_FAILED', `Unknown configuration key: ${group}.${key}.`, {
        group,
        key,
      });
    }
  }
}
