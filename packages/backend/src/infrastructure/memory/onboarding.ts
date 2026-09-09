import { DriverProfile } from '../../domain/driver-profile.js';
import { PassengerProfile } from '../../domain/passenger-profile.js';
import { Vehicle } from '../../domain/vehicle.js';
import type {
  DriverProfileRepository,
  PassengerProfileRepository,
  VehicleRepository,
} from '../../application/onboarding-service.js';

/** Adaptadores em memória — testes offline (38). */
export class InMemoryDriverProfileRepository implements DriverProfileRepository {
  private readonly byId = new Map<string, DriverProfile>();

  async save(profile: DriverProfile): Promise<void> {
    this.byId.set(profile.id, profile);
  }

  async findById(id: string): Promise<DriverProfile | null> {
    return this.byId.get(id) ?? null;
  }

  async findByUserId(userId: string): Promise<DriverProfile | null> {
    for (const profile of this.byId.values()) {
      if (profile.userId === userId) return profile;
    }
    return null;
  }

  async listByTenant(tenantId: string): Promise<DriverProfile[]> {
    return [...this.byId.values()].filter((profile) => profile.tenantId === tenantId);
  }
}

export class InMemoryPassengerProfileRepository implements PassengerProfileRepository {
  private readonly byId = new Map<string, PassengerProfile>();

  async save(profile: PassengerProfile): Promise<void> {
    this.byId.set(profile.id, profile);
  }

  async findById(id: string): Promise<PassengerProfile | null> {
    return this.byId.get(id) ?? null;
  }

  async findByUserId(userId: string): Promise<PassengerProfile | null> {
    for (const profile of this.byId.values()) {
      if (profile.userId === userId) return profile;
    }
    return null;
  }
}

export class InMemoryVehicleRepository implements VehicleRepository {
  private readonly byId = new Map<string, Vehicle>();

  async save(vehicle: Vehicle): Promise<void> {
    this.byId.set(vehicle.id, vehicle);
  }

  async findById(id: string): Promise<Vehicle | null> {
    return this.byId.get(id) ?? null;
  }

  async listByDriver(driverUserId: string): Promise<Vehicle[]> {
    return [...this.byId.values()].filter((vehicle) => vehicle.driverUserId === driverUserId);
  }
}
