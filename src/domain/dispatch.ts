import { DomainError } from './errors.js';

/**
 * Dispatch/matching V1 — 13-DISPATCH-MATCHING + DEC-DISP-001..008.
 * Puro e determinístico: elegibilidade, ranking lexicográfico, ondas e
 * vencedor único como funções de dados. Temporização real (12 s), entrega
 * de ofertas e transação de atribuição no banco vivem no runtime/persistência
 * das fases donas; aqui o contrato é a política.
 */

export const OFFER_TIMEOUT_SECONDS = 12;
export const MAX_OFFERS_PER_WAVE = 5;
export const STALE_LOCATION_SECONDS = 20;

export interface DispatchWave {
  readonly wave: number;
  readonly radiusKm: number;
  readonly maxOffers: number;
  readonly timeoutSeconds: number;
}

export const WAVES: ReadonlyArray<DispatchWave> = [
  { wave: 1, radiusKm: 2, maxOffers: MAX_OFFERS_PER_WAVE, timeoutSeconds: OFFER_TIMEOUT_SECONDS },
  { wave: 2, radiusKm: 4, maxOffers: MAX_OFFERS_PER_WAVE, timeoutSeconds: OFFER_TIMEOUT_SECONDS },
  { wave: 3, radiusKm: 7, maxOffers: MAX_OFFERS_PER_WAVE, timeoutSeconds: OFFER_TIMEOUT_SECONDS },
];

export interface DriverCandidate {
  readonly driverId: string;
  readonly tenantId: string;
  readonly activeVerified: boolean;
  readonly available: boolean;
  readonly serviceCategories: ReadonlyArray<string>;
  readonly zoneCompatible: boolean;
  /** Idade da última localização, em segundos. */
  readonly locationAgeSeconds: number;
  /** Distância ao pickup, em km. */
  readonly distanceKm: number;
  /** ETA ao pickup, em segundos. */
  readonly etaSeconds: number;
  /** Carimbo da localização (ms) — quanto maior, mais fresca. */
  readonly locationTimestamp: number;
  /** Tempo ocioso atual, em segundos. */
  readonly idleSeconds: number;
  readonly assignedToActiveRide: boolean;
}

export interface DispatchRequest {
  readonly tenantId: string;
  readonly serviceCategory: string;
}

/** Elegibilidade (13 §Eligibility): os 7 critérios, todos obrigatórios. */
export function isEligible(candidate: DriverCandidate, request: DispatchRequest): boolean {
  return (
    candidate.tenantId === request.tenantId &&
    candidate.activeVerified &&
    candidate.available &&
    candidate.serviceCategories.includes(request.serviceCategory) &&
    candidate.zoneCompatible &&
    candidate.locationAgeSeconds <= STALE_LOCATION_SECONDS &&
    !candidate.assignedToActiveRide
  );
}

/** Ranking lexicográfico (13 §Ranking order). Não muta a entrada. */
export function rankCandidates(candidates: ReadonlyArray<DriverCandidate>): DriverCandidate[] {
  return [...candidates].sort((a, b) => {
    if (a.etaSeconds !== b.etaSeconds) return a.etaSeconds - b.etaSeconds;
    if (a.locationTimestamp !== b.locationTimestamp) return b.locationTimestamp - a.locationTimestamp;
    if (a.idleSeconds !== b.idleSeconds) return b.idleSeconds - a.idleSeconds;
    return a.driverId < b.driverId ? -1 : a.driverId > b.driverId ? 1 : 0;
  });
}

export interface WaveOffers {
  readonly wave: DispatchWave;
  readonly driverIds: ReadonlyArray<string>;
}

/**
 * Monta as ofertas de uma onda: candidatos ranqueados dentro do raio que
 * ainda não receberam oferta (sem re-oferta após timeout/rejeição).
 */
export function planWaveOffers(
  ranked: ReadonlyArray<DriverCandidate>,
  wave: DispatchWave,
  alreadyOffered: ReadonlySet<string>,
): WaveOffers {
  const driverIds: string[] = [];
  for (const candidate of ranked) {
    if (driverIds.length >= wave.maxOffers) break;
    if (candidate.distanceKm <= wave.radiusKm && !alreadyOffered.has(candidate.driverId)) {
      driverIds.push(candidate.driverId);
    }
  }
  return { wave, driverIds };
}

export type AssignmentStatus = 'OPEN' | 'ASSIGNED' | 'NO_DRIVER_AVAILABLE';

export interface RideAssignment {
  readonly rideId: string;
  readonly status: AssignmentStatus;
  readonly winnerDriverId: string | null;
}

/**
 * Vencedor único (13 §Atomic winner): o primeiro aceite válido adquire a
 * atribuição. Aceites posteriores recebem conflito determinístico e não
 * podem mutar o vencedor. Na persistência, a mesma regra vive como
 * constraint transacional (DEC-DISP-007).
 */
export function acceptRide(assignment: RideAssignment, driverId: string): RideAssignment {
  if (assignment.status === 'ASSIGNED') {
    throw new DomainError('CONFLICT', 'Ride already has a winning driver.', {
      rideId: assignment.rideId,
      winnerDriverId: assignment.winnerDriverId,
    });
  }
  if (assignment.status === 'NO_DRIVER_AVAILABLE') {
    throw new DomainError('CONFLICT', 'Ride is closed with no driver available.', {
      rideId: assignment.rideId,
    });
  }
  return { ...assignment, status: 'ASSIGNED', winnerDriverId: driverId };
}

export interface NoDriverEvent {
  readonly type: 'dispatch.no_driver_available';
  readonly rideId: string;
  readonly tenantId: string;
}

/**
 * Sem disponibilidade (13 §No availability): após a onda 3 sem vencedor,
 * resultado operacional + evento + passageiro deve tentar de novo (mensagem
 * recuperável — nunca inventar um motorista).
 */
export function closeWithoutDriver(rideId: string, tenantId: string): { assignment: RideAssignment; event: NoDriverEvent } {
  return {
    assignment: { rideId, status: 'NO_DRIVER_AVAILABLE', winnerDriverId: null },
    event: { type: 'dispatch.no_driver_available', rideId, tenantId },
  };
}
