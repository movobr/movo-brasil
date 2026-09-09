import { DomainError } from './errors.js';

/**
 * Contexto de tenant por requisição autenticada — contrato 02.
 * Toda ação autoritativa valida: identidade do ator, escopo de tenant,
 * permissões e correlation ID. O servidor determina o contexto; nunca
 * confia em tenant_id enviado pelo cliente.
 */
export interface ActorContext {
  userId: string;
  /** null = principal de plataforma (MOVO-global). */
  tenantId: string | null;
  permissions: ReadonlyArray<string>;
  correlationId: string;
}

/**
 * Autorização por permissão explícita + escopo + propriedade do recurso.
 * Regra cross-tenant (02): um principal com escopo de tenant não pode ler,
 * listar, modificar, excluir nem inferir dados de outro tenant — mesmo que
 * possua a permissão nominal. Negação cross-tenant precede qualquer allow.
 */
export function authorize(
  actor: ActorContext,
  permission: string,
  resourceTenantId?: string | null,
): void {
  if (
    resourceTenantId !== undefined &&
    resourceTenantId !== null &&
    actor.tenantId !== null &&
    actor.tenantId !== resourceTenantId
  ) {
    throw new DomainError('CROSS_TENANT_DENIED', 'Cross-tenant access is denied by default.', {
      permission,
    });
  }
  if (!actor.permissions.includes(permission)) {
    throw new DomainError('UNAUTHORIZED', `Missing required permission: ${permission}.`, {
      permission,
    });
  }
}
