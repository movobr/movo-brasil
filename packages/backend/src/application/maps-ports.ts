/**
 * Porta de mapas — 16-MAPS-GEOLOCATION (Routes API v2 via adapter).
 * Adapter vivo Google nas fases de infra com credenciais; cálculo de tarifa
 * usa somente estes valores (cliente nunca é autoridade).
 */
export interface Coordinates {
  readonly lat: number;
  readonly lng: number;
}

export interface RouteRequest {
  readonly origin: string;
  readonly destination: string;
}

export interface RouteResult {
  readonly distanceMeters: number;
  readonly durationSeconds: number;
  readonly pickup: Coordinates;
  readonly dropoff: Coordinates;
}

export interface MapsProvider {
  route(request: RouteRequest): Promise<RouteResult>;
}
