import { notFound } from 'next/navigation';
import { splitFare } from '@movo/brasil/src/domain/ledger.js';
import { DataStates } from '../../../components/DataStates.js';
import { getBackend } from '../../../lib/backend.js';

/** 26 driver 7: concluídas e ganhos (80% do cotado; reconciliação final em fase própria). */
export default async function DriverEarningsPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string }>;
}) {
  const slug = (await searchParams).tenant ?? 'demo-tenant-a';
  const backend = await getBackend();
  const tenants = await backend.tenants.listTenants(backend.platformActor);
  const tenant = tenants.find((t) => t.slug === slug);
  if (tenant === undefined) notFound();
  const driverUserId = await backend.demoDriverUserId(tenant.id);
  if (driverUserId === null) {
    return (
      <DataStates state="empty" emptyMessage="Nenhum motorista demo neste tenant.">
        <></>
      </DataStates>
    );
  }
  const rides = await backend.orchestrator.listTenantRides(backend.platformActor, tenant.id);
  const completed = rides.filter((ride) => ride.driverId === driverUserId && ride.status === 'COMPLETED');
  const earnings = completed.map((ride) => ({
    ride,
    driverMinor: splitFare({ grossMinor: ride.quotedMinor, tenantDiscountsMinor: 0, movoDiscountsMinor: 0 }).driverMinor,
  }));
  const total = earnings.reduce((sum, e) => sum + e.driverMinor, 0);
  if (completed.length === 0) {
    return (
      <DataStates state="empty" emptyMessage="Nenhuma corrida concluída ainda.">
        <></>
      </DataStates>
    );
  }
  return (
    <DataStates state="success">
      <h1>Ganhos (demo)</h1>
      <p>
        Total motorista (80% do cotado): <strong>R$ {(total / 100).toFixed(2).replace('.', ',')}</strong>
      </p>
      <div className="table-responsive table-cards">
        <table>
          <thead>
            <tr>
              <th scope="col">Corrida</th>
              <th scope="col">Cotado</th>
              <th scope="col">Motorista (80%)</th>
            </tr>
          </thead>
          <tbody>
            {earnings.map(({ ride, driverMinor }) => (
              <tr key={ride.id}>
                <td data-label="Corrida">{ride.id.slice(0, 8)}…</td>
                <td data-label="Cotado">R$ {(ride.quotedMinor / 100).toFixed(2).replace('.', ',')}</td>
                <td data-label="Motorista (80%)">R$ {(driverMinor / 100).toFixed(2).replace('.', ',')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataStates>
  );
}
