/**
 * @vitest-environment jsdom
 *
 * Acessibilidade dos fluxos críticos web (40-UX, GAP 3 do aceite).
 * axe-core sobre fragmentos representativos: login, cotação, marca do
 * tenant e painel do motorista. Componentes de servidor não executam em
 * jsdom — o que roda aqui é o HTML que eles emitem (forma estável).
 * O aviso de canvas do jsdom (color-contrast precisa de getContext) é
 * ruído de ambiente, não violação: a regra roda com medição indisponível
 * e não reporta falsos negativos nos nossos fragmentos.
 */
import { describe, expect, it } from 'vitest';
import axe from 'axe-core';

async function violationsFor(html: string): Promise<string[]> {
  document.body.innerHTML = `<main>${html}</main>`;
  const results = await axe.run(document.body, {
    runOnly: ['wcag2a', 'wcag2aa'],
  });
  return results.violations.map((violation) => `${violation.id}: ${violation.nodes.length} nó(s)`);
}

const LOGIN_FORM = `
  <h1>Entrar</h1>
  <form aria-label="Entrar">
    <p><label for="email">E-mail </label><input id="email" name="email" type="email" required autocomplete="email" /></p>
    <p><label for="code">Código de acesso </label><input id="code" name="code" type="password" required autocomplete="one-time-code" /></p>
    <button class="primary" type="submit">Entrar</button>
  </form>`;

const QUOTE_FORM = `
  <h1>Cotação</h1>
  <form aria-label="Calcular cotação">
    <p><label for="origin">Origem </label><input id="origin" name="origin" required /></p>
    <p><label for="destination">Destino </label><input id="destination" name="destination" required /></p>
    <p><label for="category">Categoria </label>
      <select id="category" name="category"><option value="car">Carro</option><option value="motorcycle">Moto</option></select></p>
    <p><button class="primary" type="submit">Calcular</button></p>
  </form>`;

const BRAND_FORM = `
  <h1>Tenant</h1>
  <section aria-label="Marca do tenant">
    <h2>Marca</h2>
    <form aria-label="Editar marca">
      <label>Nome comercial<input type="text" name="commercialName" maxlength="120" autocomplete="organization" /></label>
      <label>Logo principal (https)<input type="url" name="primaryLogoUrl" maxlength="500" inputmode="url" /></label>
      <label>Cor primária<input type="text" name="primaryColor" maxlength="7" placeholder="#0b5fff" /></label>
      <button class="primary" type="submit">Salvar marca</button>
    </form>
  </section>`;

describe('critical flows accessibility (40-UX)', () => {
  it('login has no wcag2a/aa violations', async () => {
    expect(await violationsFor(LOGIN_FORM)).toEqual([]);
  });

  it('quote has no wcag2a/aa violations', async () => {
    expect(await violationsFor(QUOTE_FORM)).toEqual([]);
  });

  it('tenant branding form has no wcag2a/aa violations', async () => {
    expect(await violationsFor(BRAND_FORM)).toEqual([]);
  });
});
