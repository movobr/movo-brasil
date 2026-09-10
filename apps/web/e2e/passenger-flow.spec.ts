import { expect, test } from '@playwright/test';

/**
 * Fluxo passageiro demo (39): login → cotação → confirmação →
 * corrida com rota → fila do /ops. Sem rede externa (FakeMaps).
 */
test('passageiro pede corrida e vê rota; ops lista na fila', async ({ page }) => {
  await page.goto('/login');
  await page.fill('#email', 'passenger@demo-tenant-a.example');
  await page.fill('#code', '123456');
  await page.click('button[type="submit"]');
  await page.waitForURL('/');

  await page.goto(
    '/ride/quote?tenant=demo-tenant-a&origin=Av+Paulista&destination=Guarulhos&category=car',
  );
  await expect(page.getByText('Estimativa:')).toBeVisible();

  await page.click('button:has-text("Continuar")');
  await page.waitForURL(/\/ride\/confirm.*/);
  await expect(page.getByText('Confirmar corrida')).toBeVisible();

  await page.click('button:has-text("Confirmar e pedir corrida")');
  await page.waitForURL(/\/ride\/[0-9a-f-]+.*/);
  await expect(page.getByText('Tarifa cotada:')).toBeVisible();
  await expect(page.getByText(/Rota:/)).toBeVisible();
  const rideId = page.url().match(/\/ride\/([0-9a-f-]+)/)?.[1];
  expect(rideId).toBeTruthy();

  await page.goto('/ops?tenant=demo-tenant-a');
  await expect(page.getByText('Fila (1)')).toBeVisible();
  await expect(page.getByText('REQUESTED').first()).toBeVisible();
});
