import { Tenant } from '../../domain/tenant.js';
import { User } from '../../domain/user.js';
import { AuditEvent } from '../../domain/audit.js';
import type {
  TenantRepository,
  UserRepository,
  AuditEventRepository,
} from '../../application/repositories.js';

/** Adaptadores em memória — usados pelos testes offline (38). */

export class InMemoryTenantRepository implements TenantRepository {
  private readonly byId = new Map<string, Tenant>();

  async save(tenant: Tenant): Promise<void> {
    this.byId.set(tenant.id, tenant);
  }

  async findById(id: string): Promise<Tenant | null> {
    return this.byId.get(id) ?? null;
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    for (const tenant of this.byId.values()) {
      if (tenant.slug === slug) return tenant;
    }
    return null;
  }

  async listAll(): Promise<Tenant[]> {
    return [...this.byId.values()];
  }
}

export class InMemoryUserRepository implements UserRepository {
  private readonly byId = new Map<string, User>();

  async save(user: User): Promise<void> {
    this.byId.set(user.id, user);
  }

  async findById(id: string): Promise<User | null> {
    return this.byId.get(id) ?? null;
  }

  async findByEmail(email: string): Promise<User | null> {
    for (const user of this.byId.values()) {
      if (user.email === email) return user;
    }
    return null;
  }

  async findByPhone(phone: string): Promise<User | null> {
    for (const user of this.byId.values()) {
      if (user.phone === phone) return user;
    }
    return null;
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    return [...this.byId.values()].filter((user) => user.tenantId === tenantId);
  }
}

export class InMemoryAuditEventRepository implements AuditEventRepository {
  private readonly events: AuditEvent[] = [];

  async append(event: AuditEvent): Promise<void> {
    this.events.push(event);
  }

  async listByTenant(tenantId: string): Promise<AuditEvent[]> {
    return this.events.filter((event) => event.tenantScope === tenantId);
  }
}
