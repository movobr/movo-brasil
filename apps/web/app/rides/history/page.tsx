import { notFound } from 'next/navigation';
import { DataStates } from '../../../components/DataStates.js';
import { getBackend } from '../../../lib/backend.js';

/** 26-10 Ride History: lista e detalhe das corridas permitidas. */
export default async function RideHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const slug = (await searchParams).tenant ?? 'demo-tenant-a';
  const backend = await getBackend();
  const tenants = await backend.tenants.listTenants(backend.platformActor);
  const tenant = tenants.find((t) => t.slug === slug);
  if (tenant === undefined) notFound();
  const rides = await backend.orchestrator.listTenantRides(backend.platformActor, tenant.id);
  if (rides.length === 0) {
    return (
      <DataStates state="empty" emptyMessage="Nenhuma corrida ainda. Peça a primeira na cotação.">
        <></>
      </DataStates>
    );
  }
  return (
    <DataStates state="success">
      <h1>Histórico de corridas</h1>
      <div className="table-responsive table-cards">
        <table>
          <thead>
            <tr>
              <th scope="col">Corrida</th>
              <th scope="col">Tarifa</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {rides.map((ride) => (
              <tr key={ride.id}>
                <td data-label="Corrida">
                  <a href={`/ride/${ride.id}?tenant=${slug}`}>{ride.id.slice(0, 8)}…</a>
                </td>
                <td data-label="Tarifa">R$ {(ride.quotedMinor / 100).toFixed(2).replace('.', ',')}</td>
                <td data-label="Estado">
                  <span className="badge">{ride.status}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataStates>
  );
}
