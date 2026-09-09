import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import type { BrandingConfig } from '@movo/brasil/src/domain/branding.js';
import { splitFare } from '@movo/brasil/src/domain/ledger.js';
import { paletteFor } from '../lib/theme.js';
import { formatBrl } from '../lib/quote.js';

export interface DriverOffer {
  readonly rideId: string;
  readonly etaSeconds: number;
  readonly quotedMinor: number;
}

export interface DriverActiveRide {
  readonly rideId: string;
  readonly status: string;
  readonly quotedMinor: number;
  readonly destLatitude: number;
  readonly destLongitude: number;
}

export type DriverScreenState = 'loading' | 'ready' | 'empty' | 'error' | 'stale';

/**
 * Jornada do motorista (20: disponibilidade, ofertas, corrida ativa,
 * ganhos). Segurança (20): aceite em dois toques deliberados; auditoria
 * no servidor. Sincronização com o servidor chega com a API de driver.
 */
export function DriverScreen({
  branding,
  offers,
  activeRide,
  screenState,
  onNavigate,
}: {
  branding: BrandingConfig | null;
  offers: ReadonlyArray<DriverOffer>;
  activeRide: DriverActiveRide | null;
  screenState: DriverScreenState;
  onNavigate: (uri: string) => void;
}) {
  const palette = paletteFor(branding);
  const [available, setAvailable] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  if (screenState === 'loading') {
    return (
      <View accessible accessibilityLabel="Carregando painel do motorista" style={{ flex: 1, padding: 16 }}>
        <Text>Carregando…</Text>
      </View>
    );
  }
  if (screenState === 'error') {
    return (
      <View accessible accessibilityLabel="Erro no painel do motorista" style={{ flex: 1, padding: 16 }}>
        <Text accessibilityRole="alert">Falha de rede. Verifique a conexão e tente de novo.</Text>
      </View>
    );
  }

  const earningsMinor =
    activeRide !== null
      ? splitFare({ grossMinor: activeRide.quotedMinor, tenantDiscountsMinor: 0, movoDiscountsMinor: 0 }).driverMinor
      : 0;

  return (
    <View accessible accessibilityLabel="Painel do motorista" style={{ backgroundColor: palette.surface, flex: 1, padding: 16 }}>
      <Text accessibilityRole="header" style={{ color: palette.onSurface, fontSize: 22 }}>
        {available ? 'Online' : 'Offline'}
      </Text>
      <Button
        title={available ? 'Ficar offline' : 'Ficar online'}
        accessibilityLabel={available ? 'Ficar offline' : 'Ficar online'}
        onPress={() => setAvailable(!available)}
      />
      {screenState === 'stale' ? <Text accessibilityRole="alert">Dados desatualizados. Recarregue.</Text> : null}
      {activeRide !== null ? (
        <View accessible accessibilityLabel="Corrida ativa">
          <Text style={{ color: palette.onSurface }}>
            Corrida {activeRide.rideId.slice(0, 8)}… · {activeRide.status}
          </Text>
          <Text style={{ color: palette.onSurface }}>Sua parte: {formatBrl(earningsMinor)}</Text>
          <Button
            title="Navegar até o destino"
            accessibilityLabel="Navegar até o destino"
            onPress={() => onNavigate(`geo:${activeRide.destLatitude},${activeRide.destLongitude}`)}
          />
        </View>
      ) : null}
      {activeRide === null ? (
        <View accessible accessibilityLabel="Ofertas de corrida">
          <Text style={{ color: palette.onSurface }}>Ofertas ({offers.length})</Text>
          {offers.length === 0 && screenState === 'empty' ? <Text>Nenhuma oferta por perto.</Text> : null}
          {offers.map((offer) => (
            <View key={offer.rideId} accessible accessibilityLabel={`Oferta ${offer.rideId.slice(0, 8)}`}>
              <Text style={{ color: palette.onSurface }}>
                {Math.round(offer.etaSeconds / 60)} min · {formatBrl(offer.quotedMinor)}
              </Text>
              {confirmId === offer.rideId ? (
                <View>
                  <Text accessibilityRole="alert">Confirmar aceite? A atribuição é auditada.</Text>
                  <Button title="Confirmar aceite" accessibilityLabel="Confirmar aceite" onPress={() => setConfirmId(null)} />
                  <Button title="Voltar" accessibilityLabel="Voltar" onPress={() => setConfirmId(null)} />
                </View>
              ) : (
                <Button
                  title="Aceitar"
                  accessibilityLabel={`Aceitar corrida ${offer.rideId.slice(0, 8)}`}
                  disabled={!available}
                  onPress={() => setConfirmId(offer.rideId)}
                />
              )}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}
