import { DataStates } from '../../components/DataStates.js';
import { getBackend } from '../../lib/backend.js';
import { requireSession } from '../../lib/require-session.js';
import { renderTemplate } from '@movo/brasil/src/domain/notification.js';

/** 18: caixa de entrada in-app do usuário da sessão (push chega no device). */
export default async function NotificationsPage() {
  const actor = await requireSession().catch(() => null);
  if (actor === null || actor.tenantId === null) {
    return (
      <DataStates state="forbidden">
        <></>
      </DataStates>
    );
  }
  const backend = await getBackend();
  if (backend.inbox === null) {
    return (
      <DataStates state="empty">
        <p>Notificações indisponíveis com stores vivos (fase de infra).</p>
      </DataStates>
    );
  }
  const items = await backend.inbox.listForUser(actor.tenantId, actor.userId, 50);
  return (
    <DataStates state="success">
      <h1>Notificações</h1>
      {items.length === 0 ? (
        <p role="status">Nenhuma notificação.</p>
      ) : (
        <ul>
          {items.map((notification) => (
            <li key={notification.id}>
              <p>{renderTemplate(notification.templateKey)}</p>
              <p>
                <span className="badge">{notification.channel}</span>{' '}
                <span className="badge">{notification.status}</span>{' '}
                <time dateTime={notification.createdAt.toISOString()}>
                  {notification.createdAt.toLocaleString('pt-BR')}
                </time>
              </p>
            </li>
          ))}
        </ul>
      )}
    </DataStates>
  );
}
