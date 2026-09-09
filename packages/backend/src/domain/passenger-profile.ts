import { DomainError } from './errors.js';

/** Perfil do passageiro — 10/11 (sem estados próprios no contrato V1). */
export interface PassengerProfileInit {
  id: string;
  tenantId: string;
  userId: string;
  /** Vocabulário pendente (classe de UNSPECIFIED-003). */
  status: string;
  now: Date;
}

export class PassengerProfile {
  readonly id: string;
  readonly tenantId: string;
  readonly userId: string;
  status: string;
  readonly createdAt: Date;
  updatedAt: Date;

  private constructor(init: PassengerProfileInit) {
    this.id = init.id;
    this.tenantId = init.tenantId;
    this.userId = init.userId;
    this.status = init.status;
    this.createdAt = init.now;
    this.updatedAt = init.now;
  }

  static register(init: PassengerProfileInit): PassengerProfile {
    if (init.id.trim() === '' || init.tenantId.trim() === '' || init.userId.trim() === '') {
      throw new DomainError('VALIDATION_FAILED', 'Passenger profile requires id, tenantId and userId.');
    }
    if (init.status.trim() === '') {
      throw new DomainError('VALIDATION_FAILED', 'Passenger profile requires a status.');
    }
    return new PassengerProfile(init);
  }
}
