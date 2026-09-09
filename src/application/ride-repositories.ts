import type { Ride } from '../domain/ride.js';

/** Porta de persistência de corridas (contrato 11, migration 0002). */
export interface RideRepository {
  save(ride: Ride): Promise<void>;
  findById(id: string): Promise<Ride | null>;
  listByTenant(tenantId: string): Promise<Ride[]>;
  listByDriver(driverId: string): Promise<Ride[]>;
}
