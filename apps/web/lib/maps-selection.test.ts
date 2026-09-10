import { describe, expect, it } from 'vitest';
import { GoogleMapsProvider } from '@movo/brasil/src/infrastructure/maps/google-maps-provider.js';
import { FakeMapsProvider } from './demo-fakes.js';
import { selectMapsProvider } from './backend.js';

describe('selectMapsProvider', () => {
  it('retorna o adapter vivo com GOOGLE_MAPS_API_KEY', () => {
    const provider = selectMapsProvider({ GOOGLE_MAPS_API_KEY: 'key-test' } as unknown as NodeJS.ProcessEnv);
    expect(provider).toBeInstanceOf(GoogleMapsProvider);
  });

  it('retorna o fake sem key (demo determinístico, custo zero)', () => {
    expect(selectMapsProvider({} as unknown as NodeJS.ProcessEnv)).toBeInstanceOf(FakeMapsProvider);
    expect(selectMapsProvider({ GOOGLE_MAPS_API_KEY: '  ' } as unknown as NodeJS.ProcessEnv)).toBeInstanceOf(
      FakeMapsProvider,
    );
  });
});
