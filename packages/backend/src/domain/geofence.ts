import { validateCoordinates } from './driver-location.js';

/**
 * Geofence — 16-MAPS-GEOLOCATION. Embarque/desembarque dentro de um
 * polígono operacional do tenant, com 100 m de tolerância operacional.
 * Polígonos chegam por parâmetro (fonte = config do tenant,
 * UNSPECIFIED-002); aqui, só a geometria decidida. Terra esférica,
 * haversine — suficiente para a tolerância contratada.
 */
export const GEOFENCE_TOLERANCE_METERS = 100;

export interface GeoPoint {
  readonly latitude: number;
  readonly longitude: number;
}

export type ServicePolygon = ReadonlyArray<GeoPoint>;

const EARTH_RADIUS_METERS = 6371000;

export function haversineMeters(a: GeoPoint, b: GeoPoint): number {
  validateCoordinates(a.latitude, a.longitude);
  validateCoordinates(b.latitude, b.longitude);
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h));
}

/** Ray casting sobre (lng, lat). Borda conta como dentro. */
export function isInsidePolygon(point: GeoPoint, polygon: ServicePolygon): boolean {
  validateCoordinates(point.latitude, point.longitude);
  if (polygon.length < 3) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const vi = polygon[i];
    const vj = polygon[j];
    if (vi === undefined || vj === undefined) continue;
    const crosses =
      vi.latitude > point.latitude !== vj.latitude > point.latitude &&
      point.longitude < ((vj.longitude - vi.longitude) * (point.latitude - vi.latitude)) / (vj.latitude - vi.latitude) + vi.longitude;
    if (crosses) inside = !inside;
  }
  return inside;
}

function distanceToSegmentMeters(point: GeoPoint, a: GeoPoint, b: GeoPoint): number {
  // Projeção equiretangular local — válida na escala da tolerância (100 m).
  const toRad = (degrees: number) => (degrees * Math.PI) / 180;
  const latRef = toRad((a.latitude + b.latitude) / 2);
  const ax = toRad(a.longitude) * Math.cos(latRef) * EARTH_RADIUS_METERS;
  const ay = toRad(a.latitude) * EARTH_RADIUS_METERS;
  const bx = toRad(b.longitude) * Math.cos(latRef) * EARTH_RADIUS_METERS;
  const by = toRad(b.latitude) * EARTH_RADIUS_METERS;
  const px = toRad(point.longitude) * Math.cos(latRef) * EARTH_RADIUS_METERS;
  const py = toRad(point.latitude) * EARTH_RADIUS_METERS;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;
  const t = lengthSquared === 0 ? 0 : Math.min(1, Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSquared));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function distanceToPolygonMeters(point: GeoPoint, polygon: ServicePolygon): number {
  if (polygon.length === 0) return Number.POSITIVE_INFINITY;
  let minimum = Number.POSITIVE_INFINITY;
  for (let i = 0; i < polygon.length; i += 1) {
    const a = polygon[i];
    const b = polygon[(i + 1) % polygon.length];
    if (a === undefined || b === undefined) continue;
    minimum = Math.min(minimum, distanceToSegmentMeters(point, a, b));
  }
  return minimum;
}

/** 16: dentro do polígono OU até 100 m da borda. */
export function isServiceable(point: GeoPoint, polygons: ReadonlyArray<ServicePolygon>): boolean {
  return polygons.some(
    (polygon) => isInsidePolygon(point, polygon) || distanceToPolygonMeters(point, polygon) <= GEOFENCE_TOLERANCE_METERS,
  );
}

export function validateServiceArea(
  pickup: GeoPoint,
  dropoff: GeoPoint,
  polygons: ReadonlyArray<ServicePolygon>,
): { pickupOk: boolean; dropoffOk: boolean } {
  if (polygons.length === 0) return { pickupOk: false, dropoffOk: false };
  return { pickupOk: isServiceable(pickup, polygons), dropoffOk: isServiceable(dropoff, polygons) };
}
