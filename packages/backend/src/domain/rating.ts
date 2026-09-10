import { DomainError } from './errors.js';

/**
 * Avaliação pós-corrida — DECIDED pelo Owner (era UNSPECIFIED-008):
 * bilateral, 1–5 estrelas inteiras, uma por avaliador por corrida.
 * Só participantes da corrida avaliam; só corrida concluída recebe
 * avaliação. Sem média agregada aqui (leitura futura, sem contrato).
 */
export const RATING_MIN_STARS = 1;
export const RATING_MAX_STARS = 5;

export type RatingDirection = 'passenger_to_driver' | 'driver_to_passenger';

export interface RatingInit {
  id: string;
  tenantId: string;
  rideId: string;
  raterUserId: string;
  rateeUserId: string;
  direction: RatingDirection;
  stars: number;
  now: Date;
}

export class Rating {
  readonly id: string;
  readonly tenantId: string;
  readonly rideId: string;
  readonly raterUserId: string;
  readonly rateeUserId: string;
  readonly direction: RatingDirection;
  readonly stars: number;
  readonly createdAt: Date;

  private constructor(init: RatingInit) {
    this.id = init.id;
    this.tenantId = init.tenantId;
    this.rideId = init.rideId;
    this.raterUserId = init.raterUserId;
    this.rateeUserId = init.rateeUserId;
    this.direction = init.direction;
    this.stars = init.stars;
    this.createdAt = init.now;
  }

  static submit(init: RatingInit): Rating {
    if (!Number.isInteger(init.stars) || init.stars < RATING_MIN_STARS || init.stars > RATING_MAX_STARS) {
      throw new DomainError('VALIDATION_FAILED', 'Rating must be an integer between 1 and 5 stars.');
    }
    if (init.raterUserId === init.rateeUserId) {
      throw new DomainError('VALIDATION_FAILED', 'Rater and ratee must be different users.');
    }
    return new Rating(init);
  }
}
