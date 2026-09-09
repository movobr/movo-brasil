import { classifyFreshness, validateCoordinates, type DriverLocation } from '@movo/brasil/src/domain/driver-location.js';

/**
 * Rastreador de localização do motorista — 16 (cadência) + 20 (driver app).
 * Cadência do contrato: 5 s em corrida ativa, 15 s online sem corrida.
 * Foreground only na V1 (fundo bloqueado, 64). Transporte (Expo Location)
 * entra por esta porta; sincronização com o servidor, por API futura.
 */
export const ON_RIDE_UPDATE_SECONDS = 5;
export const ONLINE_IDLE_UPDATE_SECONDS = 15;

export interface DevicePosition {
  readonly latitude: number;
  readonly longitude: number;
}

export interface LocationProvider {
  getCurrentPosition(): Promise<DevicePosition>;
}

export function updateIntervalSeconds(onRide: boolean): number {
  return onRide ? ON_RIDE_UPDATE_SECONDS : ONLINE_IDLE_UPDATE_SECONDS;
}

export interface TrackerState {
  driverId: string;
  tenantId: string;
  onRide: boolean;
  lastEmittedAt: Date | null;
}

export function createTracker(driverId: string, tenantId: string): TrackerState {
  return { driverId, tenantId, onRide: false, lastEmittedAt: null };
}

/** Emite um registro se a cadência venceu; null quando ainda não. */
export async function tick(
  state: TrackerState,
  provider: LocationProvider,
  now: Date,
): Promise<{ state: TrackerState; location: DriverLocation | null }> {
  const intervalMs = updateIntervalSeconds(state.onRide) * 1000;
  if (state.lastEmittedAt !== null && now.getTime() - state.lastEmittedAt.getTime() < intervalMs) {
    return { state, location: null };
  }
  const position = await provider.getCurrentPosition();
  validateCoordinates(position.latitude, position.longitude);
  const location: DriverLocation = {
    driverId: state.driverId,
    tenantId: state.tenantId,
    latitude: position.latitude,
    longitude: position.longitude,
    updatedAt: now,
    onRide: state.onRide,
  };
  return { state: { ...state, lastEmittedAt: now }, location };
}

export function freshnessOf(location: DriverLocation, now: Date): string {
  return classifyFreshness(location.updatedAt, now);
}
