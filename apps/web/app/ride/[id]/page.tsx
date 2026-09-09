import { notFound } from 'next/navigation';
import { DataStates } from '../../../components/DataStates.js';
import { getBackend } from '../../../lib/backend.js';
import { acceptDemoAction, advanceAction, cancelRideAction, startMatchingAction } from '../actions.js';

/** 26-5..9: matching, assigned, arriving, in-progress, completed + cancel. */
export default async function RideStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tenant?: string; fee?: string; opError?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const slug = query.tenant ?? 'demo-tenant-a';
  const backend = await getBackend();
  const tenants = await backend.tenants.listTenants(backend.platformActor);
  const tenant = tenants.find((t) => t.slug === slug);
  if (tenant === undefined) notFound();
  let ride;
  try {
    ride = await backend.orchestrator.getRide(backend.platformActor, id);
  } catch {
    notFound();
  }
  if (ride.tenantId !== tenant.id) {
    return (
      <DataStates state="forbidden">
        <></>
      </DataStates>
    );
  }
  const driverName =
    ride.driverId !== null && backend.users !== null
      ? ((await backend.users.findById(ride.driverId))?.name ?? ride.driverId)
      : null;

  const start = startMatchingAction.bind(null, ride.id, slug);
  const accept = acceptDemoAction.bind(null, ride.id, slug);
  const cancel = cancelRideAction.bind(null, ride.id, slug);
  const advance = (to: string, trigger: string) => advanceAction.bind(null, ride.id, slug, to, trigger);

  return (
    <DataStates state="success">
      <h1>Corrida</h1>
      {query.opError !== undefined ? (
        <div className="alert" role="alert">
          <p>{query.opError}</p>
        </div>
      ) : null}
      {query.fee !== undefined ? (
        <p role="status">Corrida cancelada. Taxa aplicada: R$ {(Number(query.fee) / 100).toFixed(2).replace('.', ',')}</p>
      ) : null}
      <section className="card" aria-label="Estado atual">
        <p>
          Estado: <span className="badge">{ride.status}</span>
        </p>
        <p>Tarifa cotada: R$ {(ride.quotedMinor / 100).toFixed(2).replace('.', ',')}</p>
        {driverName !== null ? <p>Motorista: {driverName}</p> : null}
      </section>
      {ride.status === 'REQUESTED' ? (
        <form action={start}>
          <button className="primary" type="submit">Buscar motorista</button>
        </form>
      ) : null}
      {ride.status === 'MATCHING' ? (
        <section className="card" aria-label="Buscando motorista" aria-live="polite">
          <p>Buscando motorista próximo… (demonstração)</p>
          <form action={accept}>
            <button className="primary" type="submit">Simular aceite do motorista demo</button>
          </form>
          <form action={cancel}>
            <button type="submit">Cancelar (grátis antes da atribuição)</button>
          </form>
        </section>
      ) : null}
      {ride.status === 'ACCEPTED' ? (
        <form action={advance('DRIVER_ARRIVING', 'system')}>
          <button className="primary" type="submit">Motorista a caminho</button>
        </form>
      ) : null}
      {ride.status === 'DRIVER_ARRIVING' ? (
        <form action={advance('DRIVER_ARRIVED', 'location-rule')}>
          <button className="primary" type="submit">Motorista chegou</button>
        </form>
      ) : null}
      {ride.status === 'DRIVER_ARRIVED' ? (
        <form action={advance('IN_PROGRESS', 'driver-start')}>
          <button className="primary" type="submit">Iniciar corrida</button>
        </form>
      ) : null}
      {ride.status === 'IN_PROGRESS' ? (
        <form action={advance('COMPLETED', 'driver-completion')}>
          <button className="primary" type="submit">Concluir corrida</button>
        </form>
      ) : null}
      {['ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED'].includes(ride.status) ? (
        <form action={cancel}>
          <button type="submit">Cancelar corrida (conforme política)</button>
        </form>
      ) : null}
      {ride.status === 'COMPLETED' ? (
        <p role="status">Corrida concluída. Recibo e avaliação chegam na fase de pós-corrida.</p>
      ) : null}
      {ride.status === 'CANCELLED' ? <p role="status">Corrida cancelada.</p> : null}
      <p>
        <a href={`/rides/history?tenant=${slug}`}>Histórico</a>
      </p>
    </DataStates>
  );
}
