import { authorize, type ActorContext } from '../domain/authorization.js';
import { DomainError } from '../domain/errors.js';
import { Rating, type RatingDirection } from '../domain/rating.js';

/** Portas da avaliação (19→26: segue o padrão do chat). */
export interface RatingStore {
  findByRideAndRater(rideId: string, raterUserId: string): Promise<Rating | null>;
  save(rating: Rating): Promise<void>;
  listByRide(tenantId: string, rideId: string): Promise<Rating[]>;
}

export interface RideRatingLookup {
  findById(tenantId: string, rideId: string): Promise<{
    status: string;
    passengerUserId: string;
    driverUserId: string | null;
  } | null>;
}

export const RATING_PERMISSIONS = {
  rideRate: 'ride.rate',
} as const;

/**
 * Avaliação bilateral 1–5 (Owner DECIDED, era UNSPECIFIED-008).
 * Direção derivada dos participantes; unicidade por (corrida, avaliador).
 */
export class RatingService {
  constructor(
    private readonly ratings: RatingStore,
    private readonly rides: RideRatingLookup,
    private readonly ids: () => string,
    private readonly clock: () => Date,
  ) {}

  async submitRating(actor: ActorContext, tenantId: string, rideId: string, stars: number): Promise<Rating> {
    authorize(actor, RATING_PERMISSIONS.rideRate, tenantId);
    const ride = await this.rides.findById(tenantId, rideId);
    if (ride === null) throw new DomainError('NOT_FOUND', 'Ride not found for this tenant.');
    if (ride.status !== 'COMPLETED') {
      throw new DomainError('VALIDATION_FAILED', 'Only completed rides can be rated.');
    }
    if (ride.driverUserId === null) {
      throw new DomainError('VALIDATION_FAILED', 'Rides without an assigned driver cannot be rated.');
    }
    let direction: RatingDirection;
    let rateeUserId: string;
    if (actor.userId === ride.passengerUserId) {
      direction = 'passenger_to_driver';
      rateeUserId = ride.driverUserId;
    } else if (actor.userId === ride.driverUserId) {
      direction = 'driver_to_passenger';
      rateeUserId = ride.passengerUserId;
    } else {
      throw new DomainError('UNAUTHORIZED', 'Only ride participants can rate.');
    }
    const existing = await this.ratings.findByRideAndRater(rideId, actor.userId);
    if (existing !== null) throw new DomainError('CONFLICT', 'This ride was already rated by this user.');
    const rating = Rating.submit({
      id: this.ids(),
      tenantId,
      rideId,
      raterUserId: actor.userId,
      rateeUserId,
      direction,
      stars,
      now: this.clock(),
    });
    await this.ratings.save(rating);
    return rating;
  }

  async listRatings(actor: ActorContext, tenantId: string, rideId: string): Promise<Rating[]> {
    authorize(actor, RATING_PERMISSIONS.rideRate, tenantId);
    return this.ratings.listByRide(tenantId, rideId);
  }
}
