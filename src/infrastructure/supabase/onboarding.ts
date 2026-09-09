import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '../../domain/errors.js';
import { DriverProfile, type VerificationStatus } from '../../domain/driver-profile.js';
import { PassengerProfile } from '../../domain/passenger-profile.js';
import { Vehicle } from '../../domain/vehicle.js';
import type {
  DriverProfileRepository,
  PassengerProfileRepository,
  VehicleRepository,
} from '../../application/onboarding-service.js';

/** Persistência viva, fiel ao contrato 11 (migration 0003). */
interface DriverProfileRow {
  id: string;
  tenant_id: string;
  user_id: string;
  status: string;
  verification_status: string;
  available: boolean;
  created_at: string;
  updated_at: string;
}

interface PassengerProfileRow {
  id: string;
  tenant_id: string;
  user_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

interface VehicleRow {
  id: string;
  tenant_id: string;
  driver_user_id: string;
  type_id: string;
  service_category: string;
  plate: string;
  status: string;
  created_at: string;
  updated_at: string;
}

function fail(context: string, message: string): never {
  throw new DomainError('PERSISTENCE_FAILED', `${context}: ${message}`);
}

function toDriverProfile(row: DriverProfileRow): DriverProfile {
  const profile = DriverProfile.register({
    id: row.id,
    tenantId: row.tenant_id,
    userId: row.user_id,
    status: row.status,
    now: new Date(row.created_at),
  });
  profile.verificationStatus = row.verification_status as VerificationStatus;
  if (row.available) profile.setAvailable(true);
  profile.updatedAt = new Date(row.updated_at);
  return profile;
}

export class SupabaseDriverProfileRepository implements DriverProfileRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(profile: DriverProfile): Promise<void> {
    const { error } = await this.db.from('driver_profiles').upsert(
      {
        id: profile.id,
        tenant_id: profile.tenantId,
        user_id: profile.userId,
        status: profile.status,
        verification_status: profile.verificationStatus,
        available: profile.available,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (error !== null) fail('Failed to save driver profile', error.message);
  }

  async findById(id: string): Promise<DriverProfile | null> {
    const { data, error } = await this.db.from('driver_profiles').select('*').eq('id', id).maybeSingle();
    if (error !== null) fail('Failed to load driver profile', error.message);
    if (data === null) return null;
    return toDriverProfile(data as DriverProfileRow);
  }

  async findByUserId(userId: string): Promise<DriverProfile | null> {
    const { data, error } = await this.db.from('driver_profiles').select('*').eq('user_id', userId).maybeSingle();
    if (error !== null) fail('Failed to load driver profile', error.message);
    if (data === null) return null;
    return toDriverProfile(data as DriverProfileRow);
  }

  async listByTenant(tenantId: string): Promise<DriverProfile[]> {
    const { data, error } = await this.db.from('driver_profiles').select('*').eq('tenant_id', tenantId);
    if (error !== null) fail('Failed to list driver profiles', error.message);
    return ((data ?? []) as DriverProfileRow[]).map(toDriverProfile);
  }
}

export class SupabasePassengerProfileRepository implements PassengerProfileRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(profile: PassengerProfile): Promise<void> {
    const { error } = await this.db.from('passenger_profiles').upsert(
      {
        id: profile.id,
        tenant_id: profile.tenantId,
        user_id: profile.userId,
        status: profile.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (error !== null) fail('Failed to save passenger profile', error.message);
  }

  async findById(id: string): Promise<PassengerProfile | null> {
    const { data, error } = await this.db.from('passenger_profiles').select('*').eq('id', id).maybeSingle();
    if (error !== null) fail('Failed to load passenger profile', error.message);
    if (data === null) return null;
    const row = data as PassengerProfileRow;
    const profile = PassengerProfile.register({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      status: row.status,
      now: new Date(row.created_at),
    });
    profile.updatedAt = new Date(row.updated_at);
    return profile;
  }

  async findByUserId(userId: string): Promise<PassengerProfile | null> {
    const { data, error } = await this.db.from('passenger_profiles').select('*').eq('user_id', userId).maybeSingle();
    if (error !== null) fail('Failed to load passenger profile', error.message);
    if (data === null) return null;
    const row = data as PassengerProfileRow;
    return PassengerProfile.register({
      id: row.id,
      tenantId: row.tenant_id,
      userId: row.user_id,
      status: row.status,
      now: new Date(row.created_at),
    });
  }
}

export class SupabaseVehicleRepository implements VehicleRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(vehicle: Vehicle): Promise<void> {
    const { error } = await this.db.from('vehicles').upsert(
      {
        id: vehicle.id,
        tenant_id: vehicle.tenantId,
        driver_user_id: vehicle.driverUserId,
        type_id: vehicle.typeId,
        service_category: vehicle.serviceCategory,
        plate: vehicle.plate,
        status: vehicle.status,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    );
    if (error !== null) fail('Failed to save vehicle', error.message);
  }

  async findById(id: string): Promise<Vehicle | null> {
    const { data, error } = await this.db.from('vehicles').select('*').eq('id', id).maybeSingle();
    if (error !== null) fail('Failed to load vehicle', error.message);
    if (data === null) return null;
    const row = data as VehicleRow;
    return Vehicle.register({
      id: row.id,
      tenantId: row.tenant_id,
      driverUserId: row.driver_user_id,
      typeId: row.type_id,
      serviceCategory: row.service_category,
      plate: row.plate,
      status: row.status,
      now: new Date(row.created_at),
    });
  }

  async listByDriver(driverUserId: string): Promise<Vehicle[]> {
    const { data, error } = await this.db.from('vehicles').select('*').eq('driver_user_id', driverUserId);
    if (error !== null) fail('Failed to list vehicles', error.message);
    return ((data ?? []) as VehicleRow[]).map((row) =>
      Vehicle.register({
        id: row.id,
        tenantId: row.tenant_id,
        driverUserId: row.driver_user_id,
        typeId: row.type_id,
        serviceCategory: row.service_category,
        plate: row.plate,
        status: row.status,
        now: new Date(row.created_at),
      }),
    );
  }
}
