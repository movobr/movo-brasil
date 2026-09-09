import { DataStates } from '../../../components/DataStates.js';
import { getBackend } from '../../../lib/backend.js';

/** Platform admin → tenants (23): lista governada por permissão explícita. */
export default async function TenantsAdminPage() {
  const backend = await getBackend();
  let tenants;
  try {
    tenants = await backend.tenants.listTenants(backend.platformActor);
  } catch {
    return (
      <DataStates state="forbidden">
        <></>
      </DataStates>
    );
  }
  if (tenants.length === 0) {
    return (
      <DataStates state="empty" emptyMessage="Nenhum tenant cadastrado.">
        <></>
      </DataStates>
    );
  }
  return (
    <DataStates state="success">
      <h1>Tenants</h1>
      <div className="table-responsive table-cards">
        <table>
          <thead>
            <tr>
              <th scope="col">Nome</th>
              <th scope="col">Slug</th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {tenants.map((tenant) => (
              <tr key={tenant.id}>
                <td data-label="Nome">
                  <a href={`/admin/tenants/${tenant.slug}`}>{tenant.name}</a>
                </td>
                <td data-label="Slug">{tenant.slug}</td>
                <td data-label="Estado">
                  <span className="badge" data-tone={tenant.status === 'ACTIVE' ? 'ok' : 'bad'}>
                    {tenant.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataStates>
  );
}
