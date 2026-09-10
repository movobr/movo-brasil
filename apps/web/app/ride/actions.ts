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

/** 19: abre a conversa da corrida (mutação via POST, nunca no GET). */
export async function openChatAction(rideId: string, slug: string): Promise<never> {
  const actor = await requireSession();
  const { backend, tenant } = await tenantBySlug(slug);
  if (backend.chat === null) backTo(rideId, slug, '&opError=Chat+indispon%C3%ADvel.');
  try {
    await backend.chat.openForRide(actor, tenant.id, rideId);
  } catch (error) {
    failure(rideId, slug, error);
  }
  backTo(rideId, slug, '&chat=1');
}

/** 19: envia mensagem; idempotente por clientMessageId (form gera UUID). */
export async function sendChatMessageAction(rideId: string, slug: string, formData: FormData): Promise<never> {
  const actor = await requireSession();
  const { backend, tenant } = await tenantBySlug(slug);
  if (backend.chat === null) backTo(rideId, slug, '&opError=Chat+indispon%C3%ADvel.');
  try {
    const peeked = await backend.chat.peek(actor, tenant.id, rideId, 100);
    if (peeked === null) throw new Error('Abra o chat primeiro.');
    await backend.chat.sendMessage(
      actor,
      peeked.conversation.id,
      tenant.id,
      rideId,
      String(formData.get('body') ?? ''),
      String(formData.get('clientMessageId') ?? ''),
      false,
    );
  } catch (error) {
    failure(rideId, slug, error);
  }
  backTo(rideId, slug, '&chat=1');
}

/** 19: denúncia de abuso (registrada; sem auto-moderação). */
export async function reportChatMessageAction(rideId: string, slug: string, messageId: string): Promise<never> {
  const actor = await requireSession();
  const { backend, tenant } = await tenantBySlug(slug);
  if (backend.chat === null) backTo(rideId, slug, '&opError=Chat+indispon%C3%ADvel.');
  try {
    const peeked = await backend.chat.peek(actor, tenant.id, rideId, 100);
    if (peeked === null) throw new Error('Conversa não encontrada.');
    const message = peeked.messages.find((m) => m.id === messageId);
    if (message === undefined) throw new Error('Mensagem não encontrada.');
    await backend.chat.reportMessage(actor, tenant.id, peeked.conversation, message);
  } catch (error) {
    failure(rideId, slug, error);
  }
  backTo(rideId, slug, '&chat=1');
}

/** Avaliação bilateral 1–5 (Owner DECIDED, era UNSPECIFIED-008). */
export async function submitRatingAction(rideId: string, slug: string, formData: FormData): Promise<never> {
  const actor = await requireSession();
  const { backend, tenant } = await tenantBySlug(slug);
  if (backend.ratings === null) backTo(rideId, slug, '&opError=Avalia%C3%A7%C3%A3o+indispon%C3%ADvel.');
  try {
    await backend.ratings.submitRating(actor, tenant.id, rideId, Number(formData.get('stars')));
  } catch (error) {
    failure(rideId, slug, error);
  }
  backTo(rideId, slug);
}
