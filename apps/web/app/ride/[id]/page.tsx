import { notFound } from 'next/navigation';
import { randomUUID } from 'node:crypto';
import { buildReceipt } from '@movo/brasil/src/domain/receipt.js';
import { DataStates } from '../../../components/DataStates.js';
import { getBackend } from '../../../lib/backend.js';
import { requireSession } from '../../../lib/require-session.js';
import { advanceAction, cancelRideAction, openChatAction, reportChatMessageAction, sendChatMessageAction, startMatchingAction } from '../actions.js';

/** 26-5..9: matching, assigned, arriving, in-progress, completed + cancel. */
export default async function RideStatusPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tenant?: string; fee?: string; opError?: string; chat?: string }>;
}) {
  const actor = await requireSession().catch(() => null);
  if (actor === null) {
    return (
      <DataStates state="forbidden">
        <></>
      </DataStates>
    );
  }
  const { id } = await params;
  const query = await searchParams;
  const slug = query.tenant ?? 'demo-tenant-a';
  const backend = await getBackend();
  const tenants = await backend.tenants.listTenants(backend.platformActor);
  const tenant = tenants.find((t) => t.slug === slug);
  if (tenant === undefined) notFound();
  let ride;
  try {
    ride = await backend.orchestrator.getRide(actor, id);
  } catch {
    notFound();
  }
  if (ride.tenantId !== tenant.id) {
    return (
      <DataStates state="forbidden">
        <></>
      </DataStates>
    );
  }
  const driverName =
    ride.driverId !== null && backend.users !== null
      ? ((await backend.users.findById(ride.driverId))?.name ?? ride.driverId)
      : null;

  const start = startMatchingAction.bind(null, ride.id, slug);
  const cancel = cancelRideAction.bind(null, ride.id, slug);
  const advance = (to: string, trigger: string) => advanceAction.bind(null, ride.id, slug, to, trigger);

  return (
    <DataStates state="success">
      <h1>Corrida</h1>
      {query.opError !== undefined ? (
        <div className="alert" role="alert">
          <p>{query.opError}</p>
        </div>
      ) : null}
      {query.fee !== undefined ? (
        <p role="status">Corrida cancelada. Taxa aplicada: R$ {(Number(query.fee) / 100).toFixed(2).replace('.', ',')}</p>
      ) : null}
      <section className="card" aria-label="Estado atual">
        <p>
          Estado: <span className="badge">{ride.status}</span>
        </p>
        <p>Tarifa cotada: R$ {(ride.quotedMinor / 100).toFixed(2).replace('.', ',')}</p>
        {driverName !== null ? <p>Motorista: {driverName}</p> : null}
      </section>
      {ride.status === 'REQUESTED' ? (
        <form action={start}>
          <button className="primary" type="submit">Buscar motorista</button>
        </form>
      ) : null}
      {ride.status === 'MATCHING' ? (
        <section className="card" aria-label="Buscando motorista" aria-live="polite">
          <p>Buscando motorista próximo… O aceite acontece no app do motorista.</p>
          <form action={cancel}>
            <button type="submit">Cancelar (grátis antes da atribuição)</button>
          </form>
        </section>
      ) : null}
      {ride.status === 'ACCEPTED' ? (
        <form action={advance('DRIVER_ARRIVING', 'system')}>
          <button className="primary" type="submit">Motorista a caminho</button>
        </form>
      ) : null}
      {ride.status === 'DRIVER_ARRIVING' ? (
        <form action={advance('DRIVER_ARRIVED', 'location-rule')}>
          <button className="primary" type="submit">Motorista chegou</button>
        </form>
      ) : null}
      {ride.status === 'DRIVER_ARRIVED' ? (
        <form action={advance('IN_PROGRESS', 'driver-start')}>
          <button className="primary" type="submit">Iniciar corrida</button>
        </form>
      ) : null}
      {ride.status === 'IN_PROGRESS' ? (
        <form action={advance('COMPLETED', 'driver-completion')}>
          <button className="primary" type="submit">Concluir corrida</button>
        </form>
      ) : null}
      {['ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED'].includes(ride.status) ? (
        <form action={cancel}>
          <button type="submit">Cancelar corrida (conforme política)</button>
        </form>
      ) : null}
      {ride.status === 'COMPLETED' ? (
        <ReceiptSection rideId={ride.id} tenantId={tenant.id} quotedMinor={ride.quotedMinor} completedAt={ride.completedAt} />
      ) : null}
      {ride.status === 'CANCELLED' ? <p role="status">Corrida cancelada.</p> : null}
      {ride.driverId !== null && backend.chat !== null ? (
        <section className="card" aria-label="Chat da corrida" aria-live="polite">
          <h2>Chat da corrida</h2>
          {query.chat === undefined ? (
            <form action={openChatAction.bind(null, ride.id, slug)}>
              <button type="submit">Abrir chat com {actor.userId === ride.passengerId ? 'o motorista' : 'o passageiro'}</button>
            </form>
          ) : (
            <ChatThread rideId={ride.id} slug={slug} tenantId={tenant.id} actor={actor} />
          )}
        </section>
      ) : null}
      <p>
        <a href={`/rides/history?tenant=${slug}`}>Histórico</a>
      </p>
    </DataStates>
  );
}

async function ChatThread({ rideId, slug, tenantId, actor }: { rideId: string; slug: string; tenantId: string; actor: { userId: string } }) {
  const backend = await getBackend();
  if (backend.chat === null) return <p role="status">Chat indisponível.</p>;
  const full = await requireSession();
  const peeked = await backend.chat.peek(full, tenantId, rideId, 100).catch(() => null);
  if (peeked === null) return <p role="status">Chat ainda não aberto.</p>;
  const send = sendChatMessageAction.bind(null, rideId, slug);
  return (
    <div>
      {peeked.messages.length === 0 ? (
        <p role="status">Nenhuma mensagem ainda. Sem realtime nesta fase: recarregue para ver respostas.</p>
      ) : (
        <ul>
          {peeked.messages.map((message) => (
            <li key={message.id}>
              <strong>{message.senderUserId === actor.userId ? 'Você' : 'Outro participante'}</strong>{' '}
              <time dateTime={message.sentAt.toISOString()}>{message.sentAt.toLocaleTimeString('pt-BR')}</time>
              <p>{message.body}</p>
              {message.reported ? (
                <span className="badge">denunciada</span>
              ) : (
                <form action={reportChatMessageAction.bind(null, rideId, slug, message.id)}>
                  <button type="submit">Denunciar</button>
                </form>
              )}
            </li>
          ))}
        </ul>
      )}
      <form action={send}>
        <input type="hidden" name="clientMessageId" value={randomUUID()} />
        <label>
          Mensagem
          <input type="text" name="body" required maxLength={1000} autoComplete="off" />
        </label>
        <button className="primary" type="submit">Enviar</button>
      </form>
    </div>
  );
}

/** 26-9: recibo pós-corrida (read-model; avaliação = UNSPECIFIED-008). */
async function ReceiptSection({ rideId, tenantId, quotedMinor, completedAt }: { rideId: string; tenantId: string; quotedMinor: number; completedAt: Date | null }) {
  const backend = await getBackend();
  const intents = await backend.paymentIntentsForRide(rideId).catch(() => []);
  const latest = intents[intents.length - 1] ?? null;
  let receipt;
  try {
    receipt = buildReceipt({
      rideId,
      tenantId,
      rideStatus: 'COMPLETED',
      quotedMinor,
      tenantDiscountsMinor: 0,
      movoDiscountsMinor: 0,
      paymentMethod: latest?.method ?? null,
      paymentStatus: latest?.status ?? null,
      paidMinor: latest?.amountMinor ?? null,
      completedAt,
    });
  } catch {
    return <p role="status">Recibo indisponível.</p>;
  }
  const brl = (minor: number) => `R$ ${(minor / 100).toFixed(2).replace('.', ',')}`;
  return (
    <section className="card" aria-label="Recibo">
      <h2>Recibo</h2>
      <dl>
        <div>
          <dt>Tarifa final</dt>
          <dd>{brl(receipt.quotedMinor)}</dd>
        </div>
        <div>
          <dt>Motorista (80%)</dt>
          <dd>{brl(receipt.split.driverMinor)}</dd>
        </div>
        <div>
          <dt>Operador (17%)</dt>
          <dd>{brl(receipt.split.tenantMinor)}</dd>
        </div>
        <div>
          <dt>Plataforma</dt>
          <dd>{brl(receipt.split.movoMinor)}</dd>
        </div>
        <div>
          <dt>Pagamento</dt>
          <dd>{receipt.paymentMethod ?? '—'} · {receipt.paymentStatus ?? 'sem registro'}</dd>
        </div>
        <div>
          <dt>Concluída em</dt>
          <dd>
            <time dateTime={receipt.completedAt.toISOString()}>{receipt.completedAt.toLocaleString('pt-BR')}</time>
          </dd>
        </div>
      </dl>
      <p role="status">Avaliação da corrida: em definição com o Owner (escala e regras pendentes).</p>
    </section>
  );
}
