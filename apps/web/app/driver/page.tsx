import { notFound } from 'next/navigation';
import { DataStates } from '../../components/DataStates.js';
import { getBackend } from '../../lib/backend.js';
import { requireSession } from '../../lib/require-session.js';
import { acceptRideAction, toggleAvailabilityAction } from './actions.js';

/** 26 driver 2/3: home/disponibilidade + ofertas (ator = motorista logado). */
export default async function DriverHomePage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; opError?: string }>;
}) {
  const actor = await requireSession().catch(() => null);
  if (actor === null || actor.tenantId === null) {
    return (
      <DataStates state="forbidden">
        <></>
      </DataStates>
    );
  }
  const query = await searchParams;
  const slug = query.tenant ?? 'demo-tenant-a';
  const backend = await getBackend();
  const tenants = await backend.tenants.listTenants(backend.platformActor);
  const tenant = tenants.find((t) => t.slug === slug);
  if (tenant === undefined || tenant.id !== actor.tenantId) notFound();
  let profile;
  try {
    profile = await backend.onboarding.getDriverProfileByUser(actor, actor.userId);
  } catch {
    return (
      <DataStates state="forbidden">
        <></>
      </DataStates>
    );
  }
  const rides = await backend.orchestrator.listTenantRides(actor, tenant.id);
  const offers = rides.filter((ride) => ride.status === 'MATCHING');
  const active = rides.filter(
    (ride) => ride.driverId === actor.userId && !['COMPLETED', 'CANCELLED', 'PAID'].includes(ride.status),
  );
  const toggle = toggleAvailabilityAction.bind(null, slug, profile.available ? 'off' : 'on');
  return (
    <DataStates state="success">
      <h1>Motorista</h1>
      {query.opError !== undefined ? (
        <div className="alert" role="alert">
          <p>{query.opError}</p>
        </div>
      ) : null}
      <section className="card" aria-label="Disponibilidade">
        <p>
          Verificação: <span className="badge">{profile.verificationStatus}</span>{' '}
          Disponível: <span className="badge">{profile.available ? 'SIM' : 'NÃO'}</span>
        </p>
        <form action={toggle}>
          <button className="primary" type="submit">
            {profile.available ? 'Ficar indisponível' : 'Ficar disponível'}
          </button>
        </form>
      </section>
      <section className="card" aria-label="Corrida ativa" aria-live="polite">
        <h2>Corrida ativa</h2>
        {active.length === 0 ? (
          <p role="status">Nenhuma corrida ativa.</p>
        ) : (
          <ul>
            {active.map((ride) => (
              <li key={ride.id}>
                <a href={`/ride/${ride.id}?tenant=${slug}`}>{ride.id.slice(0, 8)}…</a>{' '}
                <span className="badge">{ride.status}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card" aria-label="Ofertas recebidas" aria-live="polite">
        <h2>Ofertas ({offers.length})</h2>
        {offers.length === 0 ? (
          <p role="status">Sem ofertas no momento.</p>
        ) : (
          <ul>
            {offers.map((ride) => (
              <li key={ride.id}>
                {ride.id.slice(0, 8)}… · R$ {(ride.quotedMinor / 100).toFixed(2).replace('.', ',')}{' '}
                <form action={acceptRideAction.bind(null, ride.id, slug)}>
                  <button className="primary" type="submit">
                    Aceitar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </section>
      <p>
        <a href={`/driver/earnings?tenant=${slug}`}>Ganhos</a>
      </p>
    </DataStates>
  );
}
