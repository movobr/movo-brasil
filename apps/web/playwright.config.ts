import { defineConfig } from '@playwright/test';

/** E2E (39): fluxo passageiro demo contra o Next local (porta 3105). */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  use: {
    baseURL: 'http://127.0.0.1:3105',
  },
  webServer: undefined,
});
