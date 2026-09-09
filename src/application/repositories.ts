import type { Tenant } from '../domain/tenant.js';
import type { User } from '../domain/user.js';
import type { AuditEvent } from '../domain/audit.js';

/** Portas de persistência (contrato 11). Implementações em infrastructure/. */
export interface TenantRepository {
  save(tenant: Tenant): Promise<void>;
  findById(id: string): Promise<Tenant | null>;
  findBySlug(slug: string): Promise<Tenant | null>;
  /** Uso restrito a principais de plataforma; isolamento aplicado no serviço. */
  listAll(): Promise<Tenant[]>;
}

export interface UserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  listByTenant(tenantId: string): Promise<User[]>;
}

export interface AuditEventRepository {
  /** Append-only: não existe update/delete. */
  append(event: AuditEvent): Promise<void>;
  listByTenant(tenantId: string): Promise<AuditEvent[]>;
}
