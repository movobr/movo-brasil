import { DataStates } from '../../../components/DataStates.js';
import { computeQuote } from '../actions.js';
import type { RideCategory } from '@movo/brasil/src/domain/pricing.js';

/** 26-3 Fare Quote: estimativa server-side (backend confirma no request). */
export default async function QuotePage({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; origin?: string; destination?: string; category?: string }>;
}) {
  const params = await searchParams;
  const tenant = params.tenant ?? 'demo-tenant-a';
  const origin = params.origin ?? '';
  const destination = params.destination ?? '';
  const category = (params.category === 'motorcycle' ? 'motorcycle' : 'car') as RideCategory;
  const ready = origin !== '' && destination !== '';
  const quote = ready ? await computeQuote({ origin, destination, category }) : null;
  return (
    <DataStates state="success">
      <h1>Cotação</h1>
      <form method="GET" className="card" aria-label="Calcular cotação">
        <input type="hidden" name="tenant" value={tenant} />
        <p>
          <label htmlFor="origin">Origem </label>
          <input id="origin" name="origin" defaultValue={origin} required />
        </p>
        <p>
          <label htmlFor="destination">Destino </label>
          <input id="destination" name="destination" defaultValue={destination} required />
        </p>
        <p>
          <label htmlFor="category">Categoria </label>
          <select id="category" name="category" defaultValue={category}>
            <option value="car">Carro</option>
            <option value="motorcycle">Moto</option>
          </select>
        </p>
        <p>
          <button className="primary" type="submit">
            Calcular
          </button>
        </p>
      </form>
      {quote !== null ? (
        <section className="card" aria-label="Resultado" aria-live="polite">
          <p>
            Estimativa: <strong>R$ {(quote.total.amountMinor / 100).toFixed(2).replace('.', ',')}</strong>
          </p>
          <p>Válida por 2 minutos ou até origem/destino mudarem.</p>
          <form method="GET" action="/ride/confirm">
            <input type="hidden" name="tenant" value={tenant} />
            <input type="hidden" name="origin" value={origin} />
            <input type="hidden" name="destination" value={destination} />
            <input type="hidden" name="category" value={category} />
            <p>
              <label htmlFor="payment">Pagamento </label>
              <select id="payment" name="payment" defaultValue="card">
                <option value="card">Cartão</option>
                <option value="pix">Pix (pré-pago)</option>
              </select>
            </p>
            <button className="primary" type="submit">
              Continuar
            </button>
          </form>
        </section>
      ) : null}
    </DataStates>
  );
}
