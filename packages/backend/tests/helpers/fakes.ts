import type { DomainEvent, EventPublisher } from '../../src/application/event-ports.js';
import type { MapsProvider, RouteRequest, RouteResult } from '../../src/application/maps-ports.js';

/** Doubles de teste: sem rede, comportamento determinístico. */
export class FakeMapsProvider implements MapsProvider {
  constructor(private readonly result: RouteResult = {
    distanceMeters: 10000,
    durationSeconds: 1200,
    pickup: { lat: -23.5505, lng: -46.6333 },
    dropoff: { lat: -23.5645, lng: -46.6433 },
  }) {}

  async route(_request: RouteRequest): Promise<RouteResult> {
    return this.result;
  }
}

export class InMemoryEventCollector implements EventPublisher {
  public readonly events: DomainEvent[] = [];

  async publish(event: DomainEvent): Promise<void> {
    this.events.push(event);
  }

  types(): string[] {
    return this.events.map((event) => event.eventType);
  }
}
