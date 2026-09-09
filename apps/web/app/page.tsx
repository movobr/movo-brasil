import { DataStates } from '../components/DataStates.js';
import { getBackend } from '../lib/backend.js';
import { themeKindFor, themeStyleFor } from '../lib/theme.js';

/** Home do tenant (?tenant=slug): marca, tema e estado da operação. */
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const { tenant: slug } = await searchParams;
  const backend = await getBackend();
  const tenants = await backend.tenants.listTenants(backend.platformActor);
  const current = tenants.find((t) => t.slug === slug) ?? tenants[0];
  if (current === undefined) {
    return (
      <DataStates state="empty" emptyMessage="Nenhum tenant cadastrado.">
        <></>
      </DataStates>
    );
  }
  const branding = backend.demoBrandingForSlug(current.slug);
  return (
    <div style={themeStyleFor(branding)}>
      <h1>{branding?.commercialName ?? 'MOVO Brasil'}</h1>
      <p>
        Tema: <strong>{themeKindFor(branding)}</strong> · Operação: <strong>{current.status}</strong>
      </p>
      <section className="card" aria-label="Tenants disponíveis">
        <h2>Operações</h2>
        <ul>
          {tenants.map((t) => (
            <li key={t.id}>
              <a href={`/?tenant=${t.slug}`} aria-current={t.slug === current.slug ? 'page' : undefined}>
                {t.name}
              </a>{' '}
              <span className="badge" data-tone={t.status === 'ACTIVE' ? 'ok' : 'bad'}>
                {t.status}
              </span>
            </li>
          ))}
        </ul>
      </section>
      <p>
        <a href="/admin/tenants">Administração da plataforma</a>
      </p>
    </div>
  );
}
