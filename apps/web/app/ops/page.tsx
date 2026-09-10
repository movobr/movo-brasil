import { notFound } from 'next/navigation';
import { DataStates } from '../../components/DataStates.js';
import { getBackend } from '../../lib/backend.js';
import { requireSession } from '../../lib/require-session.js';
import { manualDispatchAction } from './actions.js';
import { OpsLiveListener } from './OpsLiveListener.js';

/**
 * 24-OPERATIONAL-PANEL: fila, corridas ativas, disponibilidade, alertas.
 * Realtime (36) via OpsLiveListener; sem credenciais, o ouvinte exibe o
 * aviso honesto e a página nunca afirma atualidade além do render.
 */
export default async function OpsPage({
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
  const renderedAt = new Date();
  const rides = await backend.orchestrator.listTenantRides(actor, tenant.id);
  const queue = rides.filter((ride) => ride.status === 'REQUESTED' || ride.status === 'MATCHING');
  const active = rides.filter((ride) =>
    ['ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS'].includes(ride.status),
  );
  const paymentFailed = rides.filter((ride) => ride.status === 'PAYMENT_FAILED');
  return (
    <DataStates state="success">
      <h1>Operação — {tenant.name}</h1>
      {query.opError !== undefined ? (
        <div className="alert" role="alert">
          <p>{query.opError}</p>
        </div>
      ) : null}
      <p role="status">
        Dados atualizados em <time dateTime={renderedAt.toISOString()}>{renderedAt.toLocaleString('pt-BR')}</time>.
      </p>
      <OpsLiveListener
        tenantId={tenant.id}
        rideIds={rides.map((ride) => ride.id)}
        supabaseUrl={process.env['NEXT_PUBLIC_SUPABASE_URL'] ?? null}
        publishableKey={process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'] ?? null}
      />
      <section className="card" aria-label="Fila de corridas" aria-live="polite">
        <h2>Fila ({queue.length})</h2>
        {queue.length === 0 ? (
          <p role="status">Fila vazia.</p>
        ) : (
          <ul>
            {queue.map((ride) => (
              <li key={ride.id}>
                {ride.id.slice(0, 8)}… <span className="badge">{ride.status}</span>{' '}
                {ride.status === 'REQUESTED' ? (
                  <form action={manualDispatchAction.bind(null, ride.id, slug)}>
                    <button type="submit">Despachar manualmente</button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
      <section className="card" aria-label="Corridas ativas" aria-live="polite">
        <h2>Ativas ({active.length})</h2>
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
      <section className="card" aria-label="Alertas operacionais">
        <h2>Alertas ({paymentFailed.length})</h2>
        {paymentFailed.length === 0 ? (
          <p role="status">Sem alertas.</p>
        ) : (
          <ul>
            {paymentFailed.map((ride) => (
              <li key={ride.id}>
                Pagamento falhou: <a href={`/ride/${ride.id}?tenant=${slug}`}>{ride.id.slice(0, 8)}…</a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </DataStates>
  );
}
