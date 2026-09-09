import { DomainError } from './errors.js';

/**
 * Veículo — 10/11. typeId referencia o catálogo de serviços (FK chega com
 * a migration do catálogo). Compatibilidade de categoria é igualdade
 * mecânica com a categoria da corrida.
 */
export interface VehicleInit {
  id: string;
  tenantId: string;
  driverUserId: string;
  typeId: string;
  serviceCategory: string;
  plate: string;
  /** Vocabulário pendente (classe de UNSPECIFIED-003). */
  status: string;
  now: Date;
}

export class Vehicle {
  readonly id: string;
  readonly tenantId: string;
  readonly driverUserId: string;
  readonly typeId: string;
  readonly serviceCategory: string;
  plate: string;
  status: string;
  readonly createdAt: Date;
  updatedAt: Date;

  private constructor(init: VehicleInit) {
    this.id = init.id;
    this.tenantId = init.tenantId;
    this.driverUserId = init.driverUserId;
    this.typeId = init.typeId;
    this.serviceCategory = init.serviceCategory;
    this.plate = init.plate;
    this.status = init.status;
    this.createdAt = init.now;
    this.updatedAt = init.now;
  }

  static register(init: VehicleInit): Vehicle {
    if (init.id.trim() === '' || init.tenantId.trim() === '' || init.driverUserId.trim() === '') {
      throw new DomainError('VALIDATION_FAILED', 'Vehicle requires id, tenantId and driverUserId.');
    }
    if (init.plate.trim() === '' || init.serviceCategory.trim() === '') {
      throw new DomainError('VALIDATION_FAILED', 'Vehicle requires plate and serviceCategory.');
    }
    return new Vehicle(init);
  }

  servesCategory(serviceCategory: string): boolean {
    return this.serviceCategory === serviceCategory;
  }
}
