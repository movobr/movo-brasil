'use server';

import { redirect } from 'next/navigation';
import { AuditEvent } from '@movo/brasil/src/domain/audit.js';
import { getBackend } from '../../lib/backend.js';
import { requireSession } from '../../lib/require-session.js';

async function tenantBySlug(slug: string) {
  const backend = await getBackend();
  const tenants = await backend.tenants.listTenants(backend.platformActor);
  const tenant = tenants.find((t) => t.slug === slug);
  if (tenant === undefined) throw new Error(`Tenant desconhecido: ${slug}.`);
  return { backend, tenant };
}

/** 24/32: dispatch manual com auditoria (dispatch overrides são auditáveis). */
export async function manualDispatchAction(rideId: string, slug: string): Promise<never> {
  const actor = await requireSession();
  const { backend, tenant } = await tenantBySlug(slug);
  try {
    if (actor.tenantId !== tenant.id) throw new Error('Sessão de outro tenant.');
    await backend.orchestrator.startMatching(actor, rideId);
    if (backend.audits !== null) {
      await backend.audits.append(
        AuditEvent.record(
          {
            actorUserId: actor.userId, tenantScope: tenant.id, action: 'ops.manual_dispatch',
            resourceType: 'ride', resourceId: rideId, result: 'SUCCESS',
            correlationId: actor.correlationId, metadata: {},
          },
          { eventId: () => crypto.randomUUID(), now: () => new Date() },
        ),
      );
    }
  } catch (error) {
    redirect(`/ops?tenant=${slug}&opError=${encodeURIComponent(error instanceof Error ? error.message : 'Falha.')}`);
  }
  redirect(`/ops?tenant=${slug}`);
}
