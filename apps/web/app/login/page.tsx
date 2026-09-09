import { DataStates } from '../../components/DataStates.js';
import { loginAction } from './actions.js';

const DEMO_ENABLED = process.env['ALLOW_DEMO_AUTH'] === 'true' && process.env['NODE_ENV'] !== 'production';

/** Login: Supabase Auth em produção; demo explícito em desenvolvimento. */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const error = (await searchParams).error;
  return (
    <DataStates state="success">
      <h1>Entrar</h1>
      {error !== undefined ? (
        <div className="alert" role="alert">
          <p>{error}</p>
        </div>
      ) : null}
      <form action={loginAction} className="card" aria-label="Entrar">
        <p>
          <label htmlFor="email">E-mail </label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </p>
        <p>
          <label htmlFor="code">Código de acesso </label>
          <input id="code" name="code" type="password" required autoComplete="one-time-code" />
        </p>
        <button className="primary" type="submit">
          Entrar
        </button>
      </form>
      {DEMO_ENABLED ? (
        <section className="card" aria-label="Contas demo">
          <h2>Demonstração (dev)</h2>
          <p>
            Código demo: <strong>123456</strong> para qualquer conta abaixo.
          </p>
          <ul>
            <li>platform-admin@movo.demo (plataforma)</li>
            <li>admin@demo-tenant-a.example (tenant)</li>
            <li>operator@demo-tenant-a.example (operações)</li>
          </ul>
        </section>
      ) : null}
    </DataStates>
  );
}
