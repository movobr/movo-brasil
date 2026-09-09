'use server';

import { redirect } from 'next/navigation';
import { getBackend } from '../../lib/backend.js';
import { requireSession } from '../../lib/require-session.js';

async function tenantBySlug(slug: string) {
  const backend = await getBackend();
  const tenants = await backend.tenants.listTenants(backend.platformActor);
  const tenant = tenants.find((t) => t.slug === slug);
  if (tenant === undefined) throw new Error(`Tenant desconhecido: ${slug}.`);
  return { backend, tenant };
}

function backToDriver(slug: string, extra = ''): never {
  redirect(`/driver?tenant=${slug}${extra}`);
}

export async function toggleAvailabilityAction(slug: string, available: string): Promise<never> {
  const actor = await requireSession();
  const { backend } = await tenantBySlug(slug);
  try {
    const profile = await backend.onboarding.getDriverProfileByUser(actor, actor.userId);
    await backend.onboarding.setAvailability(actor, profile.id, available === 'on');
  } catch (error) {
    backToDriver(slug, `&opError=${encodeURIComponent(error instanceof Error ? error.message : 'Falha.')}`);
  }
  backToDriver(slug);
}

export async function acceptRideAction(rideId: string, slug: string): Promise<never> {
  const actor = await requireSession();
  const { backend } = await tenantBySlug(slug);
  try {
    const profile = await backend.onboarding.getDriverProfileByUser(actor, actor.userId);
    await backend.orchestrator.acceptOffer(actor, rideId, profile.userId);
    redirect(`/ride/${rideId}?tenant=${slug}`);
  } catch (error) {
    backToDriver(slug, `&opError=${encodeURIComponent(error instanceof Error ? error.message : 'Falha no aceite.')}`);
  }
}
