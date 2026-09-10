import { notFound } from 'next/navigation';
import { DataStates } from '../../../../components/DataStates.js';
import { getBackend } from '../../../../lib/backend.js';
import { requireSession } from '../../../../lib/require-session.js';
import { themeKindFor, themeStyleFor } from '../../../../lib/theme.js';
import { updateBrandingAction } from './actions.js';

/** Platform admin → detalhe do tenant: estado, assinatura, marca e auditoria. */
export default async function TenantDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ brandError?: string; brandSaved?: string }>;
}) {
  const actor = await requireSession().catch(() => null);
  if (actor === null || actor.tenantId !== null) {
    return (
      <DataStates state="forbidden">
        <></>
      </DataStates>
    );
  }
  const { slug } = await params;
  const query = await searchParams;
  const backend = await getBackend();
  const tenants = await backend.tenants.listTenants(actor);
  const tenant = tenants.find((t) => t.slug === slug);
  if (tenant === undefined) notFound();
  const branding = await backend.brandingForTenant(tenant.id, tenant.slug);
  let subscriptionStatus = 'sem assinatura';
  try {
    const subscription = await backend.subscriptions.getSubscription(actor, tenant.id);
    subscriptionStatus = `${subscription.status} · plano ${subscription.planId}`;
  } catch {
    subscriptionStatus = 'sem assinatura';
  }
  const auditEvents = backend.audits !== null ? await backend.audits.listByTenant(tenant.id) : [];
  return (
    <div style={themeStyleFor(branding)}>
      <h1>{tenant.name}</h1>
      <p>
        Estado: <span className="badge" data-tone={tenant.status === 'ACTIVE' ? 'ok' : 'bad'}>{tenant.status}</span>{' '}
        Assinatura: <strong>{subscriptionStatus}</strong> Tema: <strong>{themeKindFor(branding)}</strong>
      </p>
      <section className="card" aria-label="Marca do tenant">
        <h2>Marca</h2>
        {query.brandError !== undefined ? (
          <p role="alert">{query.brandError}</p>
        ) : null}
        {query.brandSaved !== undefined ? <p role="status">Marca salva.</p> : null}
        <form action={updateBrandingAction.bind(null, tenant.id, tenant.slug)}>
          <label>
            Nome comercial
            <input type="text" name="commercialName" defaultValue={branding?.commercialName ?? ''} maxLength={120} autoComplete="organization" />
          </label>
          <label>
            Logo principal (https)
            <input type="url" name="primaryLogoUrl" defaultValue={branding?.primaryLogoUrl ?? ''} maxLength={500} inputMode="url" />
          </label>
          <label>
            Cor primária
            <input type="text" name="primaryColor" defaultValue={branding?.colors?.['primary'] ?? ''} maxLength={7} placeholder="#0b5fff" />
          </label>
          <button className="primary" type="submit">Salvar marca</button>
        </form>
        <p>Upload de arquivo (tipo/dimensão/conteúdo) chega na ativação de assets.</p>
      </section>
      <section className="card" aria-label="Trilha de auditoria">
        <h2>Auditoria</h2>
        <DataStates
          state={auditEvents.length === 0 ? 'empty' : 'success'}
          emptyMessage="Nenhum evento auditado para este tenant."
        >
          <ul>
            {auditEvents.map((event) => (
              <li key={event.eventId}>
                {event.action} · {event.result} · {event.occurredAt.toISOString()}
              </li>
            ))}
          </ul>
        </DataStates>
      </section>
    </div>
  );
}
