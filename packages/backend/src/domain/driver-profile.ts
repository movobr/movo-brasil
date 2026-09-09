import { DomainError } from './errors.js';

/**
 * Verificação de motorista — 58-DRIVER-ONBOARDING-VERIFICATION.
 * Tabela fechada: APPLICATION -> DOCUMENT_REVIEW -> VERIFICATION ->
 * APPROVED | REJECTED | SUSPENDED, mais APPROVED -> SUSPENDED (ação de
 * performance, CXL-005). Documentos/provedores/validades são política por
 * mercado via config do tenant (58) — jamais inventados aqui.
 * Sem ofertas em produção antes de APPROVED.
 */
export const VERIFICATION_STATUSES = [
  'APPLICATION',
  'DOCUMENT_REVIEW',
  'VERIFICATION',
  'APPROVED',
  'REJECTED',
  'SUSPENDED',
] as const;

export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

const VERIFICATION_TRANSITIONS: Readonly<Record<VerificationStatus, ReadonlyArray<VerificationStatus>>> = {
  APPLICATION: ['DOCUMENT_REVIEW'],
  DOCUMENT_REVIEW: ['VERIFICATION'],
  VERIFICATION: ['APPROVED', 'REJECTED', 'SUSPENDED'],
  APPROVED: ['SUSPENDED'],
  REJECTED: [],
  SUSPENDED: [],
};

export interface DriverProfileInit {
  id: string;
  tenantId: string;
  userId: string;
  /** Vocabulário pendente (classe de UNSPECIFIED-003). */
  status: string;
  now: Date;
}

export class DriverProfile {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  status: string;
  verificationStatus: VerificationStatus = 'APPLICATION';
  available = false;
  readonly createdAt: Date;
  updatedAt: Date;

  private constructor(init: DriverProfileInit) {
    this.id = init.id;
    this.tenantId = init.tenantId;
    this.userId = init.userId;
    this.status = init.status;
    this.createdAt = init.now;
    this.updatedAt = init.now;
  }

  static register(init: DriverProfileInit): DriverProfile {
    if (init.id.trim() === '' || init.tenantId.trim() === '' || init.userId.trim() === '') {
      throw new DomainError('VALIDATION_FAILED', 'Driver profile requires id, tenantId and userId.');
    }
    if (init.status.trim() === '') {
      throw new DomainError('VALIDATION_FAILED', 'Driver profile requires a status.');
    }
    return new DriverProfile(init);
  }

  transitionVerification(to: VerificationStatus, now: Date): void {
    const allowed = VERIFICATION_TRANSITIONS[this.verificationStatus] ?? [];
    if (!allowed.includes(to)) {
      throw new DomainError(
        'INVALID_TRANSITION',
        `Verification transition ${this.verificationStatus} -> ${to} is not allowed.`,
        { from: this.verificationStatus, to },
      );
    }
    this.verificationStatus = to;
    this.updatedAt = now;
    if (to !== 'APPROVED') this.available = false;
  }

  setAvailable(available: boolean): void {
    if (available && this.verificationStatus !== 'APPROVED') {
      throw new DomainError('UNAUTHORIZED', 'Drivers must complete verification before receiving offers.');
    }
    this.available = available;
  }

  /** Elegível a ofertas: verificado + disponível (13/58). */
  canReceiveOffers(): boolean {
    return this.verificationStatus === 'APPROVED' && this.available;
  }
}
