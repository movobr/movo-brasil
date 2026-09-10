import type { SupabaseClient } from '@supabase/supabase-js';
import { DomainError } from '../../domain/errors.js';
import { Ride, type RideStatus } from '../../domain/ride.js';
import type { RideRepository } from '../../application/ride-repositories.js';

/** Mapeamento linha <-> entidade, fiel ao contrato 11 (migration 0002). */
interface RideRow {
  id: string;
  tenant_id: string;
  passenger_id: string;
  driver_id: string | null;
  service_type_id: string;
  status: string;
  pickup_lat: number;
  pickup_lng: number;
  dropoff_lat: number;
  dropoff_lng: number;
  quoted_minor: number;
  final_minor: number | null;
  route_distance_meters: number | null;
  route_duration_seconds: number | null;
  currency: string;
  requested_at: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

function toRide(row: RideRow): Ride {
  const ride = Ride.request({
    id: row.id,
    tenantId: row.tenant_id,
    passengerId: row.passenger_id,
    serviceTypeId: row.service_type_id,
    pickupLat: row.pickup_lat,
    pickupLng: row.pickup_lng,
    dropoffLat: row.dropoff_lat,
    dropoffLng: row.dropoff_lng,
    quotedMinor: row.quoted_minor,
    currency: row.currency,
    routeDistanceMeters: row.route_distance_meters,
    routeDurationSeconds: row.route_duration_seconds,
    now: new Date(row.requested_at),
  });
  if (row.driver_id !== null) ride.driverId = row.driver_id;
  ride.status = row.status as RideStatus;
  ride.acceptedAt = row.accepted_at !== null ? new Date(row.accepted_at) : null;
  ride.startedAt = row.started_at !== null ? new Date(row.started_at) : null;
  ride.completedAt = row.completed_at !== null ? new Date(row.completed_at) : null;
  ride.cancelledAt = row.cancelled_at !== null ? new Date(row.cancelled_at) : null;
  return ride;
}

export class SupabaseRideRepository implements RideRepository {
  constructor(private readonly db: SupabaseClient) {}

  async save(ride: Ride): Promise<void> {
    const now = new Date().toISOString();
    const { error } = await this.db.from('rides').upsert(
      {
        id: ride.id,
        tenant_id: ride.tenantId,
        passenger_id: ride.passengerId,
        driver_id: ride.driverId,
        service_type_id: ride.serviceTypeId,
        status: ride.status,
        pickup_lat: ride.pickupLat,
        pickup_lng: ride.pickupLng,
        dropoff_lat: ride.dropoffLat,
        dropoff_lng: ride.dropoffLng,
        quoted_minor: ride.quotedMinor,
        route_distance_meters: ride.routeDistanceMeters,
        route_duration_seconds: ride.routeDurationSeconds,
        currency: ride.currency,
        requested_at: ride.requestedAt.toISOString(),
        accepted_at: ride.acceptedAt?.toISOString() ?? null,
        started_at: ride.startedAt?.toISOString() ?? null,
        completed_at: ride.completedAt?.toISOString() ?? null,
        cancelled_at: ride.cancelledAt?.toISOString() ?? null,
        created_at: ride.requestedAt.toISOString(),
        updated_at: now,
      },
      { onConflict: 'id' },
    );
    if (error !== null) {
      throw new DomainError('PERSISTENCE_FAILED', `Failed to save ride: ${error.message}`);
    }
  }

  async findById(id: string): Promise<Ride | null> {
    const { data, error } = await this.db.from('rides').select('*').eq('id', id).maybeSingle();
    if (error !== null) {
      throw new DomainError('PERSISTENCE_FAILED', `Failed to load ride: ${error.message}`);
    }
    if (data === null) return null;
    return toRide(data as RideRow);
  }

  async listByTenant(tenantId: string): Promise<Ride[]> {
    const { data, error } = await this.db.from('rides').select('*').eq('tenant_id', tenantId);
    if (error !== null) {
      throw new DomainError('PERSISTENCE_FAILED', `Failed to list rides: ${error.message}`);
    }
    return ((data ?? []) as RideRow[]).map(toRide);
  }

  async listByDriver(driverId: string): Promise<Ride[]> {
    const { data, error } = await this.db.from('rides').select('*').eq('driver_id', driverId);
    if (error !== null) {
      throw new DomainError('PERSISTENCE_FAILED', `Failed to list rides: ${error.message}`);
    }
    return ((data ?? []) as RideRow[]).map(toRide);
  }
}
