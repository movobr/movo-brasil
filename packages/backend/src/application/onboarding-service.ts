import { randomUUID } from 'node:crypto';
import { DomainError } from '../domain/errors.js';
import { DriverProfile, type VerificationStatus } from '../domain/driver-profile.js';
import { PassengerProfile } from '../domain/passenger-profile.js';
import { Vehicle } from '../domain/vehicle.js';
import { AuditEvent } from '../domain/audit.js';
import { authorize, type ActorContext } from '../domain/authorization.js';
import type { AuditEventRepository } from './repositories.js';

export const DRIVER_PERMISSIONS = {
  driverRead: 'driver.read',
  driverManage: 'driver.manage',
} as const;

export interface DriverProfileRepository {
  save(profile: DriverProfile): Promise<void>;
  findById(id: string): Promise<DriverProfile | null>;
  findByUserId(userId: string): Promise<DriverProfile | null>;
  listByTenant(tenantId: string): Promise<DriverProfile[]>;
}

export interface PassengerProfileRepository {
  save(profile: PassengerProfile): Promise<void>;
  findById(id: string): Promise<PassengerProfile | null>;
  findByUserId(userId: string): Promise<PassengerProfile | null>;
}

export interface VehicleRepository {
  save(vehicle: Vehicle): Promise<void>;
  findById(id: string): Promise<Vehicle | null>;
  listByDriver(driverUserId: string): Promise<Vehicle[]>;
}

/**
 * Onboarding e verificação (58/20/21). Registro, avanço de verificação,
 * disponibilidade e veículo — sempre com autorização e auditoria.
 */
export class OnboardingService {
  constructor(
    private readonly drivers: DriverProfileRepository,
    private readonly passengers: PassengerProfileRepository,
    private readonly vehicles: VehicleRepository,
    private readonly audits: AuditEventRepository,
    private readonly clock: { now: () => Date } = { now: () => new Date() },
    private readonly newId: () => string = randomUUID,
  ) {}

  async registerDriver(
    actor: ActorContext,
    input: { tenantId: string; userId: string; status: string },
  ): Promise<DriverProfile> {
    authorize(actor, DRIVER_PERMISSIONS.driverManage, input.tenantId);
    const existing = await this.drivers.findByUserId(input.userId);
    if (existing !== null) {
      throw new DomainError('CONFLICT', 'User already has a driver profile.', { userId: input.userId });
    }
    const profile = DriverProfile.register({ id: this.newId(), ...input, now: this.clock.now() });
    await this.drivers.save(profile);
    await this.recordAudit(actor, input.tenantId, 'driver.register', profile.id, 'SUCCESS', {});
    return profile;
  }

  async advanceVerification(
    actor: ActorContext,
    profileId: string,
    to: VerificationStatus,
  ): Promise<DriverProfile> {
    const profile = await this.requireDriverProfile(actor, profileId);
    authorize(actor, DRIVER_PERMISSIONS.driverManage, profile.tenantId);
    profile.transitionVerification(to, this.clock.now());
    await this.drivers.save(profile);
    await this.recordAudit(actor, profile.tenantId, 'driver.verification', profile.id, 'SUCCESS', { to });
    return profile;
  }

  async setAvailability(actor: ActorContext, profileId: string, available: boolean): Promise<DriverProfile> {
    const profile = await this.requireDriverProfile(actor, profileId);
    authorize(actor, DRIVER_PERMISSIONS.driverManage, profile.tenantId);
    profile.setAvailable(available);
    await this.drivers.save(profile);
    return profile;
  }

  async getDriverProfileByUser(actor: ActorContext, userId: string): Promise<DriverProfile> {
    const profile = await this.drivers.findByUserId(userId);
    if (profile === null) {
      throw new DomainError('NOT_FOUND', `Driver profile not found for user: ${userId}.`);
    }
    authorize(actor, DRIVER_PERMISSIONS.driverRead, profile.tenantId);
    return profile;
  }

  async registerVehicle(
    actor: ActorContext,
    input: { tenantId: string; driverUserId: string; typeId: string; serviceCategory: string; plate: string; status: string },
  ): Promise<Vehicle> {
    authorize(actor, DRIVER_PERMISSIONS.driverManage, input.tenantId);
    const vehicle = Vehicle.register({ id: this.newId(), ...input, now: this.clock.now() });
    await this.vehicles.save(vehicle);
    await this.recordAudit(actor, input.tenantId, 'vehicle.register', vehicle.id, 'SUCCESS', {});
    return vehicle;
  }

  async registerPassenger(
    actor: ActorContext,
    input: { tenantId: string; userId: string; status: string },
  ): Promise<PassengerProfile> {
    authorize(actor, DRIVER_PERMISSIONS.driverManage, input.tenantId);
    const existing = await this.passengers.findByUserId(input.userId);
    if (existing !== null) {
      throw new DomainError('CONFLICT', 'User already has a passenger profile.', { userId: input.userId });
    }
    const profile = PassengerProfile.register({ id: this.newId(), ...input, now: this.clock.now() });
    await this.passengers.save(profile);
    await this.recordAudit(actor, input.tenantId, 'passenger.register', profile.id, 'SUCCESS', {});
    return profile;
  }

  private async requireDriverProfile(actor: ActorContext, profileId: string): Promise<DriverProfile> {
    const profile = await this.drivers.findById(profileId);
    if (profile === null) throw new DomainError('NOT_FOUND', `Driver profile not found: ${profileId}.`);
    authorize(actor, DRIVER_PERMISSIONS.driverRead, profile.tenantId);
    return profile;
  }

  private async recordAudit(
    actor: ActorContext,
    tenantScope: string,
    action: string,
    resourceId: string,
    result: 'SUCCESS' | 'DENIED' | 'FAILED',
    metadata: Record<string, unknown>,
  ): Promise<void> {
    await this.audits.append(
      AuditEvent.record(
        { actorUserId: actor.userId, tenantScope, action, resourceType: 'driver', resourceId, result, correlationId: actor.correlationId, metadata },
        { eventId: () => this.newId(), now: () => this.clock.now() },
      ),
    );
  }
}
