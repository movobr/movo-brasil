import { DomainError } from './errors.js';

/** Papéis — contrato 09-ROLES-PERMISSIONS. */
export const ROLES = [
  'MOVO_PLATFORM_ADMIN',
  'TENANT_ADMIN',
  'OPERATOR',
  'SUPPORT_AGENT',
  'DRIVER',
  'PASSENGER',
] as const;

export type Role = (typeof ROLES)[number];

/**
 * Escopo do vínculo do usuário — contrato 02-ACTORS-AND-TENANCY.
 * PLATFORM implica tenantId nulo; TENANT exige tenantId.
 */
export type UserScope = 'PLATFORM' | 'TENANT' | 'USER';

export interface UserInit {
  id: string;
  tenantId: string | null;
  roleScope: UserScope;
  role: Role;
  email: string | null;
  phone: string | null;
  name: string;
  /** Vocabulário de status pendente de decisão — ver UNSPECIFIED-003. */
  status: string;
  now: Date;
}

export class User {
  readonly id: string;
  readonly tenantId: string | null;
  readonly roleScope: UserScope;
  readonly role: Role;
  readonly email: string | null;
  readonly phone: string | null;
  name: string;
  status: string;
  readonly createdAt: Date;
  updatedAt: Date;

  private constructor(init: UserInit) {
    this.id = init.id;
    this.tenantId = init.tenantId;
    this.roleScope = init.roleScope;
    this.role = init.role;
    this.email = init.email;
    this.phone = init.phone;
    this.name = init.name;
    this.status = init.status;
    this.createdAt = init.now;
    this.updatedAt = init.now;
  }

  static create(init: UserInit): User {
    if (init.id.trim() === '' || init.name.trim() === '') {
      throw new DomainError('VALIDATION_FAILED', 'User requires id and name.');
    }
    if (!(ROLES as ReadonlyArray<string>).includes(init.role)) {
      throw new DomainError('VALIDATION_FAILED', `Unknown role: ${String(init.role)}.`);
    }
    if (init.roleScope === 'PLATFORM' && init.tenantId !== null) {
      throw new DomainError('VALIDATION_FAILED', 'PLATFORM-scoped users must not carry a tenantId.');
    }
    if (init.roleScope === 'TENANT' && init.tenantId === null) {
      throw new DomainError('VALIDATION_FAILED', 'TENANT-scoped users require a tenantId.');
    }
    if (init.status.trim() === '') {
      throw new DomainError('VALIDATION_FAILED', 'User requires a status.');
    }
    return new User(init);
  }

  /** true quando este usuário pode atuar no tenant informado. */
  belongsTo(tenantId: string): boolean {
    return this.tenantId === tenantId;
  }
}
