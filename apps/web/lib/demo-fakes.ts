import type { DomainEvent, EventPublisher } from '@movo/brasil/src/application/event-ports.js';
import type { MapsProvider, RouteRequest, RouteResult } from '@movo/brasil/src/application/maps-ports.js';
import type { PaymentProvider, PixOrder, PixOrderInput } from '@movo/brasil/src/application/payment-service.js';

/**
 * Doubles de demonstração (39): sem rede, determinísticos. Usados pelo
 * runtime demo do web e reexportados para os testes.
 */
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

/** Provedor demo (39): sem rede, determinístico, só para demonstração. */
export class DemoPaymentProvider implements PaymentProvider {
  async createPixOrder(input: PixOrderInput): Promise<PixOrder> {
    return { providerReference: `demo-mp-${input.rideId}`, qrData: `qr-demo:${input.rideId}` };
  }

  verifyWebhookSignature(): boolean {
    return true;
  }
}
