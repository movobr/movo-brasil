import { notFound } from 'next/navigation';
import { DataStates } from '../../../../components/DataStates.js';
import { getBackend } from '../../../../lib/backend.js';
import { requireSession } from '../../../../lib/require-session.js';
import { themeKindFor, themeStyleFor } from '../../../../lib/theme.js';

/** Platform admin → detalhe do tenant: estado, assinatura, marca e auditoria. */
export default async function TenantDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const actor = await requireSession().catch(() => null);
  if (actor === null || actor.tenantId !== null) {
    return (
      <DataStates state="forbidden">
        <></>
      </DataStates>
    );
  }
  const { slug } = await params;
  const backend = await getBackend();
  const tenants = await backend.tenants.listTenants(actor);
  const tenant = tenants.find((t) => t.slug === slug);
  if (tenant === undefined) notFound();
  const branding = backend.demoBrandingForSlug(tenant.slug);
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
