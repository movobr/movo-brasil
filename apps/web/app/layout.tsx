import type { ReactNode } from 'react';
import './globals.css';
import { OnlineStatus } from '../components/DataStates.js';
import { PLATFORM_THEME_STYLE } from '../lib/theme.js';
import { readSession } from '../lib/require-session.js';
import { logoutAction } from './login/actions.js';

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await readSession();
  return (
    <html lang="pt-BR">
      <body>
        <a className="skip-link" href="#conteudo">
          Pular para o conteúdo
        </a>
        <OnlineStatus />
        <div className="layout" style={PLATFORM_THEME_STYLE}>
          <aside className="sidebar" aria-label="Navegação principal">
            <nav aria-label="Seções">
              <ul>
                <li>
                  <a href="/">Início</a>
                </li>
                <li>
                  <a href="/ride/quote">Pedir corrida</a>
                </li>
                <li>
                  <a href="/rides/history">Histórico</a>
                </li>
                <li>
                  <a href="/driver">Motorista</a>
                </li>
                <li>
                  <a href="/ops">Operação</a>
                </li>
                <li>
                  <a href="/notifications">Notificações</a>
                </li>
                <li>
                  <a href="/admin/tenants">Tenants</a>
                </li>
              </ul>
            </nav>
            {session !== null ? (
              <form action={logoutAction}>
                <button type="submit">Sair</button>
              </form>
            ) : (
              <p>
                <a href="/login">Entrar</a>
              </p>
            )}
          </aside>
          <main id="conteudo" className="main" tabIndex={-1}>
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
