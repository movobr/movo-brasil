import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import type { BrandingConfig } from '@movo/brasil/src/domain/branding.js';
import type { PaymentMethod, PaymentStatus } from '@movo/brasil/src/domain/payment.js';
import { paletteFor } from '../lib/theme.js';
import { formatBrl } from '../lib/quote.js';
import {
  PAYMENT_CHOICES,
  completedTotalMinor,
  isDriverPositionStale,
  isPaymentChoice,
  stepLabel,
  trackingReceipt,
  type HistoryEntry,
  type TrackingStatus,
} from '../lib/tracking.js';

export type PassengerScreenState = 'loading' | 'ready' | 'empty' | 'error' | 'stale';

/**
 * Tracking da corrida (21: áreas 7–11). Posição stale nunca afirma
 * atualidade (16/24); recibo real no COMPLETED; pagamento autoritativo
 * no servidor (40); avaliação pendente (UNSPECIFIED-008).
 */
export function TrackingScreen({
  branding,
  status,
  rideId,
  tenantId,
  driverName,
  etaSeconds,
  driverUpdatedAt,
  quotedMinor,
  paymentMethod,
  paymentStatus,
  paidMinor,
  now,
  screenState,
}: {
  branding: BrandingConfig | null;
  status: TrackingStatus;
  rideId: string;
  tenantId: string;
  driverName: string | null;
  etaSeconds: number | null;
  driverUpdatedAt: Date | null;
  quotedMinor: number;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus | null;
  paidMinor: number | null;
  now: Date;
  screenState: PassengerScreenState;
}) {
  const palette = paletteFor(branding);
  if (screenState === 'loading') {
    return (
      <View accessible accessibilityLabel="Carregando corrida" style={{ flex: 1, padding: 16 }}>
        <Text>Acompanhando sua corrida…</Text>
      </View>
    );
  }
  if (screenState === 'error') {
    return (
      <View accessible accessibilityLabel="Erro no tracking" style={{ flex: 1, padding: 16 }}>
        <Text accessibilityRole="alert">Falha de rede. O status real está preservado no servidor.</Text>
      </View>
    );
  }
  const stalePosition =
    driverUpdatedAt !== null && ['ACCEPTED', 'DRIVER_ARRIVING', 'DRIVER_ARRIVED', 'IN_PROGRESS'].includes(status)
      ? isDriverPositionStale(driverUpdatedAt, now)
      : false;
  let receiptMinor: number | null = null;
  try {
    receiptMinor =
      status === 'COMPLETED'
        ? trackingReceipt({
            rideId,
            tenantId,
            quotedMinor,
            paymentMethod,
            paymentStatus,
            paidMinor,
            completedAt: now,
          }).quotedMinor
        : null;
  } catch {
    receiptMinor = null;
  }
  return (
    <View accessible accessibilityLabel="Acompanhamento da corrida" style={{ backgroundColor: palette.surface, flex: 1, padding: 16 }}>
      <Text accessibilityRole="header" style={{ color: palette.onSurface, fontSize: 22 }}>
        {stepLabel(status)}
      </Text>
      {screenState === 'stale' ? <Text accessibilityRole="alert">Dados desatualizados. Recarregue.</Text> : null}
      {driverName !== null ? <Text style={{ color: palette.onSurface }}>Motorista: {driverName}</Text> : null}
      {etaSeconds !== null && !stalePosition ? (
        <Text style={{ color: palette.onSurface }}>Chega em ~{Math.max(1, Math.round(etaSeconds / 60))} min</Text>
      ) : null}
      {stalePosition ? (
        <Text accessibilityRole="alert">Posição do motorista desatualizada (mais de 20 s).</Text>
      ) : null}
      <Text style={{ color: palette.onSurface }}>Tarifa: {formatBrl(quotedMinor)}</Text>
      {receiptMinor !== null ? (
        <View accessible accessibilityLabel="Recibo">
          <Text style={{ color: palette.onSurface }}>Recibo: {formatBrl(receiptMinor)}</Text>
          <Text style={{ color: palette.onSurface }}>Avaliação: em definição.</Text>
        </View>
      ) : null}
    </View>
  );
}

/** Seleção de método (21 área 11): Pix/cartão; processamento no servidor. */
export function PaymentSheet({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (choice: 'pix' | 'card') => void;
}) {
  const [error, setError] = useState<string | null>(null);
  return (
    <View accessible accessibilityLabel="Pagamento">
      {PAYMENT_CHOICES.map((choice) => (
        <Button
          key={choice}
          title={`${choice === 'pix' ? 'Pix' : 'Cartão'}${selected === choice ? ' (selecionado)' : ''}`}
          accessibilityLabel={`Pagar com ${choice}`}
          onPress={() => {
            setError(null);
            onSelect(choice);
          }}
        />
      ))}
      <Button
        title="Confirmar método"
        accessibilityLabel="Confirmar método"
        onPress={() => {
          if (!isPaymentChoice(selected)) setError('Escolha Pix ou cartão.');
        }}
      />
      {error !== null ? <Text accessibilityRole="alert">{error}</Text> : null}
      <Text>O pagamento é processado com segurança no servidor.</Text>
    </View>
  );
}

/** Histórico (21 área 13) com total do que foi pago (ledger; não cotação). */
export function HistoryScreen({
  branding,
  entries,
  screenState,
}: {
  branding: BrandingConfig | null;
  entries: ReadonlyArray<HistoryEntry>;
  screenState: PassengerScreenState;
}) {
  const palette = paletteFor(branding);
  if (screenState === 'loading') {
    return (
      <View style={{ flex: 1, padding: 16 }}>
        <Text>Carregando histórico…</Text>
      </View>
    );
  }
  if (entries.length === 0) {
    return (
      <View accessible accessibilityLabel="Histórico vazio" style={{ backgroundColor: palette.surface, flex: 1, padding: 16 }}>
        <Text role="status">Nenhuma corrida ainda.</Text>
      </View>
    );
  }
  return (
    <View accessible accessibilityLabel="Histórico de corridas" style={{ backgroundColor: palette.surface, flex: 1, padding: 16 }}>
      {entries.map((entry) => (
        <View key={entry.rideId} accessible accessibilityLabel={`Corrida ${entry.rideId.slice(0, 8)}`}>
          <Text style={{ color: palette.onSurface }}>
            {stepLabel(entry.status)} · {formatBrl(entry.quotedMinor)}
          </Text>
        </View>
      ))}
      <Text style={{ color: palette.onSurface }}>Total em concluídas: {formatBrl(completedTotalMinor(entries))}</Text>
    </View>
  );
}
