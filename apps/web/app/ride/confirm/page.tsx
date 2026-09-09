import { DataStates } from '../../../components/DataStates.js';
import { computeQuote, requestRideAction } from '../actions.js';
import type { RideCategory } from '@movo/brasil/src/domain/pricing.js';

/** 26-4 Request Confirmation: pickup, destino, expiração e confirmação. */
export default async function ConfirmPage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; origin?: string; destination?: string; category?: string; payment?: string }>;
}) {
  const params = await searchParams;
  const tenant = params.tenant ?? 'demo-tenant-a';
  const origin = params.origin ?? '';
  const destination = params.destination ?? '';
  const category = (params.category === 'motorcycle' ? 'motorcycle' : 'car') as RideCategory;
  const payment = params.payment === 'pix' ? 'pix' : 'card';
  if (origin === '' || destination === '') {
    return (
      <DataStates state="error" error="Origem e destino são obrigatórios.">
        <></>
      </DataStates>
    );
  }
  const quote = await computeQuote({ origin, destination, category });
  return (
    <DataStates state="success">
      <h1>Confirmar corrida</h1>
      <section className="card" aria-label="Resumo">
        <p>De: <strong>{origin}</strong></p>
        <p>Para: <strong>{destination}</strong></p>
        <p>Categoria: <strong>{category === 'car' ? 'Carro' : 'Moto'}</strong></p>
        <p>Pagamento: <strong>{payment === 'pix' ? 'Pix (pré-pago)' : 'Cartão'}</strong></p>
        <p>
          Tarifa: <strong>R$ {(quote.total.amountMinor / 100).toFixed(2).replace('.', ',')}</strong>
        </p>
        <p>Cotação válida por 2 minutos.</p>
      </section>
      <form action={requestRideAction}>
        <input type="hidden" name="tenant" value={tenant} />
        <input type="hidden" name="origin" value={origin} />
        <input type="hidden" name="destination" value={destination} />
        <input type="hidden" name="category" value={category} />
        <input type="hidden" name="payment" value={payment} />
        <button className="primary" type="submit">
          Confirmar e pedir corrida
        </button>
      </form>
    </DataStates>
  );
}
