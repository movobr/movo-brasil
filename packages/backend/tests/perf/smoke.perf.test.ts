import { describe, expect, it } from 'vitest';
import { DEFAULT_CATALOG, quoteFare } from '../../src/domain/pricing.js';
import { rankCandidates, type DriverCandidate } from '../../src/domain/dispatch.js';

/**
 * Smoke de carga local (62): mede vazão dos núcleos quentes SEM afirmar
 * capacidade de produção (62 veda inferir produção de medições locais).
 * Registra números; não fixa thresholds (thresholds são NFR de staging).
 */
function candidate(i: number): DriverCandidate {
  return {
    driverId: `driver-${String(i).padStart(4, '0')}`,
    tenantId: 'tenant-a',
    activeVerified: true,
    available: true,
    serviceCategories: ['car'],
    zoneCompatible: true,
    locationAgeSeconds: 5,
    distanceKm: (i % 7) + 0.5,
    etaSeconds: 60 + (i % 300),
    locationTimestamp: 1000 + i,
    idleSeconds: i % 600,
    assignedToActiveRide: false,
  };
}

describe('local throughput smoke (62, sem afirmação de produção)', () => {
  it('quotes 2000 fares com correção preservada', () => {
    const now = new Date('2026-09-09T12:00:00.000Z');
    const started = Date.now();
    let total = 0;
    for (let i = 0; i < 2000; i += 1) {
      const quote = quoteFare({
        category: 'car',
        distanceMeters: 10000,
        durationSeconds: 1200,
        tollsMinor: 0,
        waitingSeconds: 0,
        coupon: null,
        automaticPromotion: null,
        surgeMilli: 1000,
        origin: 'a',
        destination: 'b',
        catalog: DEFAULT_CATALOG.car,
      }, now);
      total += quote.total.amountMinor;
    }
    const elapsedMs = Date.now() - started;
    expect(total).toBe(2000 * 2800);
    console.log(`smoke: 2000 quotes em ${elapsedMs}ms (${(2000000 / Math.max(elapsedMs, 1)).toFixed(0)} quotes/s local)`);
  });

  it('ranks 5000 candidates deterministicamente', () => {
    const pool = Array.from({ length: 5000 }, (_, i) => candidate(i));
    const started = Date.now();
    const ranked = rankCandidates(pool);
    const elapsedMs = Date.now() - started;
    expect(ranked).toHaveLength(5000);
    expect(ranked[0]!.driverId).toBe(rankCandidates(pool)[0]!.driverId);
    console.log(`smoke: ranking de 5000 em ${elapsedMs}ms`);
  });
});
