'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

/**
 * Ouvinte realtime do painel operacional (36).
 * Assina os canais das corridas listadas; ao receber broadcast,
 * recarrega os dados do servidor. Sem credenciais, exibe o aviso
 * honesto de modo sem realtime (24 §Realtime UX).
 */
export function OpsLiveListener({
  tenantId,
  rideIds,
  supabaseUrl,
  publishableKey,
}: {
  tenantId: string;
  rideIds: string[];
  supabaseUrl: string | null;
  publishableKey: string | null;
}) {
  const router = useRouter();
  const [live, setLive] = useState(false);

  useEffect(() => {
    if (supabaseUrl === null || publishableKey === null || rideIds.length === 0) return;
    const client = createClient(supabaseUrl, publishableKey);
    const channels = rideIds.map((rideId) =>
      client
        .channel(`movo:${tenantId}:ride:${rideId}`)
        .on('broadcast', { event: '*' }, () => router.refresh())
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') setLive(true);
        }),
    );
    return () => {
      for (const channel of channels) void client.removeChannel(channel);
    };
  }, [tenantId, rideIds.join(','), supabaseUrl, publishableKey, router]);

  if (supabaseUrl === null || publishableKey === null) {
    return (
      <p role="status">
        Dados atualizados em <time>{new Date().toLocaleString('pt-BR')}</time>. Sem realtime
        nesta fase: recarregue para atualizar.
      </p>
    );
  }
  return (
    <p role="status">
      {live ? 'Ao vivo: atualizando automaticamente.' : 'Conectando ao tempo real…'} Recarregue
      se a conexão cair.
    </p>
  );
}
