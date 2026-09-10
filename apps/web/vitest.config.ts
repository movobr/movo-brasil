import { defineConfig } from 'vitest/config';

/** Vitest: specs E2E do Playwright (e2e/) rodam via `playwright test`. */
export default defineConfig({
  test: {
    exclude: ['e2e/**', 'node_modules/**'],
  },
});
