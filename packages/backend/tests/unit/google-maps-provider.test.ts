import { describe, expect, it } from 'vitest';
import { GoogleMapsProvider } from '../../src/infrastructure/maps/google-maps-provider.js';

function jsonResponse(body: unknown): Response {
  return { json: async () => body } as Response;
}

describe('GoogleMapsProvider', () => {
  it('geocodifica origem/destino e calcula rota DRIVE', async () => {
    const calls: string[] = [];
    const fetchFn = async (url: string, init?: RequestInit): Promise<Response> => {
      calls.push(url);
      if (url.includes('geocode')) {
        const lat = url.includes('Paulista') ? -23.56 : -23.43;
        return jsonResponse({ status: 'OK', results: [{ geometry: { location: { lat, lng: -46.65 } } }] });
      }
      const body = JSON.parse((init?.body as string) ?? '{}') as Record<string, unknown>;
      expect(body.travelMode).toBe('DRIVE');
      return jsonResponse({ routes: [{ distanceMeters: 26551, duration: '1904s' }] });
    };
    const provider = new GoogleMapsProvider('key-test', fetchFn);
    const result = await provider.route({ origin: 'Paulista', destination: 'Guarulhos' });
    expect(result).toEqual({
      distanceMeters: 26551,
      durationSeconds: 1904,
      pickup: { lat: -23.56, lng: -46.65 },
      dropoff: { lat: -23.43, lng: -46.65 },
    });
    expect(calls).toHaveLength(3);
  });

  it('rejeita endereço sem resultado e rota ausente', async () => {
    const empty = new GoogleMapsProvider('k', async () =>
      jsonResponse({ status: 'ZERO_RESULTS', results: [] }),
    );
    await expect(empty.route({ origin: 'X', destination: 'Y' })).rejects.toMatchObject({
      code: 'PERSISTENCE_FAILED',
    });
    const noRoute = new GoogleMapsProvider('k', async (url: string) =>
      url.includes('geocode')
        ? jsonResponse({ status: 'OK', results: [{ geometry: { location: { lat: 0, lng: 0 } } }] })
        : jsonResponse({ routes: [] }),
    );
    await expect(noRoute.route({ origin: 'X', destination: 'Y' })).rejects.toMatchObject({
      code: 'PERSISTENCE_FAILED',
    });
  });

  it('exige API key', () => {
    expect(() => new GoogleMapsProvider('')).toThrow('requires an API key');
  });
});
