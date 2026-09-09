'use client';

import { useEffect, useState, type ReactNode } from 'react';

/**
 * Estados de UI (71/26): idle, loading, success, empty, error, offline,
 * stale, forbidden, retrying. Servidor entrega o estado inicial com dados
 * reais; cliente só adiciona o banner offline (29: live regions).
 */
export type DataState =
  | 'idle'
  | 'loading'
  | 'success'
  | 'empty'
  | 'error'
  | 'offline'
  | 'stale'
  | 'forbidden'
  | 'retrying';

export function OnlineStatus(): ReactNode {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    setOnline(navigator.onLine);
    const goOffline = (): void => setOnline(false);
    const goOnline = (): void => setOnline(true);
    window.addEventListener('offline', goOffline);
    window.addEventListener('online', goOnline);
    return () => {
      window.removeEventListener('offline', goOffline);
      window.removeEventListener('online', goOnline);
    };
  }, []);
  if (online) return null;
  return (
    <div className="offline-banner" role="alert">
      Você está offline. Os dados podem estar desatualizados.
    </div>
  );
}

export function DataStates({
  state,
  error,
  emptyMessage,
  children,
}: {
  state: DataState;
  error?: string;
  emptyMessage?: string;
  children: ReactNode;
}): ReactNode {
  if (state === 'loading' || state === 'retrying' || state === 'idle') {
    return (
      <div role="status" aria-live="polite">
        <p>{state === 'idle' ? 'Aguardando…' : 'Carregando…'}</p>
      </div>
    );
  }
  if (state === 'error') {
    return (
      <div className="alert" role="alert">
        <p>Algo deu errado: {error ?? 'erro desconhecido.'}</p>
        <p>
          <a className="button" href="">
            Tentar novamente
          </a>
        </p>
      </div>
    );
  }
  if (state === 'forbidden') {
    return (
      <div className="alert" role="alert">
        <p>Você não tem permissão para ver este conteúdo.</p>
      </div>
    );
  }
  if (state === 'empty') {
    return (
      <div role="status">
        <p>{emptyMessage ?? 'Nenhum item encontrado.'}</p>
      </div>
    );
  }
  if (state === 'stale') {
    return (
      <div>
        <p role="status">Estes dados podem estar desatualizados.</p>
        {children}
      </div>
    );
  }
  return <>{children}</>;
}
