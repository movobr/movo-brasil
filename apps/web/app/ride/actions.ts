'use server';

import { redirect } from 'next/navigation';
import { DEFAULT_CATALOG, quoteFare, type RideCategory } from '@movo/brasil/src/domain/pricing.js';
import { assessCancellation } from '@movo/brasil/src/domain/cancellation.js';
import { getBackend } from '../../lib/backend.js';
import { requireSession } from '../../lib/require-session.js';
import { FakeMapsProvider } from '../../lib/demo-fakes.js';

async function tenantBySlug(slug: string) {
  // Resolução interna server-side (nunca exposta); a autorização de cada
  // ato usa o ator da sessão.
  const backend = await getBackend();
  const tenants = await backend.tenants.listTenants(backend.platformActor);
  const tenant = tenants.find((t) => t.slug === slug);
  if (tenant === undefined) throw new Error(`Tenant desconhecido: ${slug}.`);
  return { backend, tenant };
}

function backTo(rideId: string, slug: string, extra = ''): never {
  redirect(`/ride/${rideId}?tenant=${slug}${extra}`);
}

function failure(rideId: string, slug: string, error: unknown): never {
  backTo(rideId, slug, `&opError=${encodeURIComponent(error instanceof Error ? error.message : 'Falha.')}`);
}

export async function computeQuote(input: { origin: string; destination: string; category: RideCategory }) {
  const route = await new FakeMapsProvider().route({ origin: input.origin, destination: input.destination });
  return quoteFare(
    {
      category: input.category,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      tollsMinor: 0,
      waitingSeconds: 0,
      coupon: null,
      automaticPromotion: null,
      surgeMilli: 1000,
      origin: input.origin,
      destination: input.destination,
      catalog: DEFAULT_CATALOG[input.category],
    },
    new Date(),
  );
}

export async function requestRideAction(formData: FormData): Promise<never> {
  const actor = await requireSession();
  const slug = String(formData.get('tenant') ?? '');
  const origin = String(formData.get('origin') ?? '');
  const destination = String(formData.get('destination') ?? '');
  const category = String(formData.get('category') ?? 'car') as RideCategory;
  const paymentMethod = String(formData.get('payment') ?? 'card') as 'pix' | 'card';
  const { backend, tenant } = await tenantBySlug(slug);
  if (actor.tenantId !== tenant.id) throw new Error('Sessão de outro tenant.');
  const { ride } = await backend.orchestrator.requestRide(actor, { origin, destination, category, paymentMethod });
  redirect(`/ride/${ride.id}?tenant=${slug}`);
}

export async function startMatchingAction(rideId: string, slug: string): Promise<never> {
  const actor = await requireSession();
  const { backend } = await tenantBySlug(slug);
  try {
    await backend.orchestrator.startMatching(actor, rideId);
  } catch (error) {
    failure(rideId, slug, error);
  }
  backTo(rideId, slug);
}

export async function advanceAction(rideId: string, slug: string, to: string, trigger: string): Promise<never> {
  const actor = await requireSession();
  const { backend } = await tenantBySlug(slug);
  try {
    await backend.orchestrator.advanceRide(actor, rideId, to as never, trigger);
  } catch (error) {
    failure(rideId, slug, error);
  }
  backTo(rideId, slug);
}

export async function cancelRideAction(rideId: string, slug: string): Promise<never> {
  const actor = await requireSession();
  const { backend } = await tenantBySlug(slug);
  const ride = await backend.orchestrator.getRide(actor, rideId);
  try {
    const outcome = assessCancellation({
      status: ride.status,
      cancelledBy: 'passenger',
      assignedAt: ride.acceptedAt,
      now: new Date(),
      exceptionalApproval: false,
      reason: 'passenger-request',
    });
    await backend.orchestrator.advanceRide(actor, rideId, 'CANCELLED', 'passenger');
    backTo(rideId, slug, `&fee=${outcome.feeMinor}`);
  } catch (error) {
    failure(rideId, slug, error);
  }
}
