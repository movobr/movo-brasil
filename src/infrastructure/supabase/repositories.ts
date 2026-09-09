import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '../../domain/errors.js';
import { Tenant, type TenantStatus } from '../../domain/tenant.js';
import { User, type Role, type UserScope } from '../../domain/user.js';
import { AuditEvent, type AuditResult } from '../../domain/audit.js';
import type {
  TenantRepository,
  UserRepository,
  AuditEventRepository,
} from '../../application/repositories.js';

/** Mapeamento linha <-> entidade, fiel ao contrato 11-DATABASE-CONTRACT. */

interface TenantRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface UserRow {
  id: string;
  tenant_id: string | null;
  role_scope: string;
  role: string;
  email: string | null;
  phone: string | null;
  name: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface AuditEventRow {
  id: string;
  tenant_id: string | null;
  actor_user_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  result: string;
  correlation_id: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

function toTenant(row: TenantRow): Tenant {
  return Tenant.rehydrate({
    id: row.id,
    slug: row.slug,
    name: row.name,
    status: row.status as TenantStatus,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  });
}

function toUser(row: UserRow): User {
  return User.create({
    id: row.id,
    tenantId: row.tenant_id,
    roleScope: row.role_scope as UserScope,
    role: row.role as Role,
    email: row.email,
    phone: row.phone,
    name: row.name,
    status: row.status,
    now: new Date(row.created_at),
  });
}

function toAuditEvent(row: AuditEventRow): AuditEvent {
  return AuditEvent.record(
    {
      actorUserId: row.actor_user_id,
      tenantScope: row.tenant_id,
      action: row.action,
      resourceType: row.resource_type,
      resourceId: row.resource_id,
      result: row.result as AuditResult,
      correlationId: row.correlation_id,
      metadata: row.metadata,
    },
    { eventId: () => row.id, now: () => new Date(row.created_at) },
  );
}

function throwIfError(error: { message: string } | null, context: string): void {
  if (error !== null) {
    throw new DomainError('PERSISTENCE_FAILED', `${context}: ${error.message}`);
  }
}

export class SupabaseTenantRepository implements TenantRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(tenant: Tenant): Promise<void> {
    const { error } = await this.db.from('tenants').upsert(
      {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        status: tenant.status,
        created_at: tenant.createdAt.toISOString(),
        updated_at: tenant.updatedAt.toISOString(),
      },
      { onConflict: 'id' },
    );
    throwIfError(error, 'Failed to save tenant');
  }

  async findById(id: string): Promise<Tenant | null> {
    const { data, error } = await this.db.from('tenants').select('*').eq('id', id).maybeSingle();
    throwIfError(error, 'Failed to load tenant');
    if (data === null) return null;
    return toTenant(data as TenantRow);
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    const { data, error } = await this.db.from('tenants').select('*').eq('slug', slug).maybeSingle();
    throwIfError(error, 'Failed to load tenant');
    if (data === null) return null;
    return toTenant(data as TenantRow);
  }

  async listAll(): Promise<Tenant[]> {
    const { data, error } = await this.db.from('tenants').select('*');
    throwIfError(error, 'Failed to list tenants');
    return ((data ?? []) as TenantRow[]).map(toTenant);
  }
}

export class SupabaseUserRepository implements UserRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(user: User): Promise<void> {
    const { error } = await this.db.from('users').upsert(
      {
        id: user.id,
        tenant_id: user.tenantId,
        role_scope: user.roleScope,
        role: user.role,
        email: user.email,
        phone: user.phone,
        name: user.name,
        status: user.status,
        created_at: user.createdAt.toISOString(),
        updated_at: user.updatedAt.toISOString(),
      },
      { onConflict: 'id' },
    );
    throwIfError(error, 'Failed to save user');
  }

  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.db.from('users').select('*').eq('id', id).maybeSingle();
    throwIfError(error, 'Failed to load user');
    if (data === null) return null;
    return toUser(data as UserRow);
  }

  async listByTenant(tenantId: string): Promise<User[]> {
    const { data, error } = await this.db.from('users').select('*').eq('tenant_id', tenantId);
    throwIfError(error, 'Failed to list users');
    return ((data ?? []) as UserRow[]).map(toUser);
  }
}

export class SupabaseAuditEventRepository implements AuditEventRepository {
  constructor(private readonly db: SupabaseClient) {}

  async append(event: AuditEvent): Promise<void> {
    const { error } = await this.db.from('audit_events').insert({
      id: event.eventId,
      tenant_id: event.tenantScope,
      actor_user_id: event.actorUserId,
      action: event.action,
      resource_type: event.resourceType,
      resource_id: event.resourceId,
      result: event.result,
      correlation_id: event.correlationId,
      metadata: event.metadata,
      created_at: event.occurredAt.toISOString(),
    });
    throwIfError(error, 'Failed to append audit event');
  }

  async listByTenant(tenantId: string): Promise<AuditEvent[]> {
    const { data, error } = await this.db
      .from('audit_events')
      .select('*')
      .eq('tenant_id', tenantId)
      .order('created_at', { ascending: true });
    throwIfError(error, 'Failed to list audit events');
    return ((data ?? []) as AuditEventRow[]).map(toAuditEvent);
  }
}
