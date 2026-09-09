import { validateCoordinates } from '@movo/brasil/src/domain/driver-location.js';

/**
 * Handoff de navegação — 20 área 6. URI padrão `geo:` com destino; o app
 * externo resolve a rota. Sem SDK de mapas no cliente (16: cliente só
 * apresenta; tarifa é sempre servidor).
 */
export function navigationHandoffUri(latitude: number, longitude: number, label: string): string {
  validateCoordinates(latitude, longitude);
  const clean = label.trim().slice(0, 100);
  return `geo:${latitude},${longitude}?q=${latitude},${longitude}${clean === '' ? '' : `(${encodeURIComponent(clean)})`}`;
}
