export type DomainErrorCode =
  | 'INVALID_TRANSITION'
  | 'UNAUTHORIZED'
  | 'CROSS_TENANT_DENIED'
  | 'VALIDATION_FAILED'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'PERSISTENCE_FAILED';

/**
 * Erro determinístico de domínio. Toda rejeição de regra de negócio
 * (transição inválida, autorização, validação, isolamento) usa este tipo
 * com um código estável, nunca uma exceção genérica.
 */
export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly details: Readonly<Record<string, unknown>> | undefined;

  constructor(code: DomainErrorCode, message: string, details?: Record<string, unknown>) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.details = details;
  }
}
