import { DomainError } from '../../domain/errors.js';
import type {
  Coordinates,
  MapsProvider,
  RouteRequest,
  RouteResult,
} from '../../application/maps-ports.js';

/**
 * Adapter vivo Google Maps (16-MAPS-GEOLOCATION, fase de infra).
 * Geocoding API (endereço → coordenadas) + Routes API v2
 * (computeRoutes → distância/duração). `fetchFn` injetável para testes.
 */
type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

interface GeocodeResponse {
  status: string;
  error_message?: string;
  results: Array<{ geometry: { location: { lat: number; lng: number } } }>;
}

interface RoutesResponse {
  error?: { message?: string };
  routes?: Array<{ distanceMeters?: number; duration?: string }>;
}

function parseDuration(value: string): number {
  const match = /^(\d+)s$/.exec(value.trim());
  if (match === null) throw new DomainError('PERSISTENCE_FAILED', 'Routes returned an unreadable duration.');
  return Number(match[1]);
}

export class GoogleMapsProvider implements MapsProvider {
  constructor(
    private readonly apiKey: string,
    private readonly fetchFn: FetchFn = fetch,
  ) {
    if (apiKey.trim() === '') {
      throw new DomainError('VALIDATION_FAILED', 'Google Maps requires an API key.');
    }
  }

  private async geocode(address: string): Promise<Coordinates> {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`;
    const res = await this.fetchFn(url);
    const body = (await res.json()) as GeocodeResponse;
    const first = body.results[0];
    if (body.status !== 'OK' || first === undefined) {
      throw new DomainError('PERSISTENCE_FAILED', `Geocoding failed: ${body.status}.`);
    }
    return { lat: first.geometry.location.lat, lng: first.geometry.location.lng };
  }

  async route(request: RouteRequest): Promise<RouteResult> {
    const [pickup, dropoff] = await Promise.all([
      this.geocode(request.origin),
      this.geocode(request.destination),
    ]);
    const res = await this.fetchFn('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': this.apiKey,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
      },
      body: JSON.stringify({
        origin: { address: request.origin },
        destination: { address: request.destination },
        travelMode: 'DRIVE',
      }),
    });
    const body = (await res.json()) as RoutesResponse;
    const first = body.routes?.[0];
    if (first?.distanceMeters === undefined || first.duration === undefined) {
      throw new DomainError('PERSISTENCE_FAILED', `Routes failed: ${body.error?.message ?? 'no route'}.`);
    }
    return {
      distanceMeters: first.distanceMeters,
      durationSeconds: parseDuration(first.duration),
      pickup,
      dropoff,
    };
  }
}
