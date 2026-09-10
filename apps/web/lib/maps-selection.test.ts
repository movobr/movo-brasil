import { describe, expect, it } from 'vitest';
import { GoogleMapsProvider } from '@movo/brasil/src/infrastructure/maps/google-maps-provider.js';
import { FakeMapsProvider } from './demo-fakes.js';
import { isLiveMode, selectMapsProvider } from './backend.js';

describe('isLiveMode', () => {
  it('força demo com MOVO_E2E_DEMO=1 fora de produção', () => {
    expect(
      isLiveMode({ MOVO_E2E_DEMO: '1', NODE_ENV: 'development', SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' } as unknown as NodeJS.ProcessEnv),
    ).toBe(false);
  });

  it('ignora a trava em produção', () => {
    expect(
      isLiveMode({ MOVO_E2E_DEMO: '1', NODE_ENV: 'production', SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
  });

  it('segue as credenciais sem a trava', () => {
    expect(isLiveMode({} as unknown as NodeJS.ProcessEnv)).toBe(false);
    expect(
      isLiveMode({ SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' } as unknown as NodeJS.ProcessEnv),
    ).toBe(true);
  });
});

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
