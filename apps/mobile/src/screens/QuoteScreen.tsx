import { useState } from 'react';
import { Button, Text, View } from 'react-native';
import type { RideCategory } from '@movo/brasil/src/domain/pricing.js';
import { estimateFare, formatBrl } from '../lib/quote.js';

/**
 * 21 Fare Quote: estimativa com o motor real (estimativa — a tarifa
 * autoritativa vem do backend no requestRide).
 */
export function QuoteScreen({ category }: { category: RideCategory }) {
  const [estimate, setEstimate] = useState<{ total: number; expiresIn: number } | null>(null);
  const now = new Date('2026-09-09T12:00:00.000Z');

  const calculate = (): void => {
    // Distância/duração virão do Maps em fase de integração; demo fixa.
    const quote = estimateFare(category, 10000, 1200, now);
    setEstimate({ total: quote.total.amountMinor, expiresIn: 120 });
  };

  return (
    <View accessible accessibilityLabel="Cotação da corrida">
      <Text accessibilityRole="header">Estimativa ({category === 'car' ? 'Carro' : 'Moto'})</Text>
      <Button title="Calcular" onPress={calculate} accessibilityLabel="Calcular estimativa" />
      {estimate !== null ? (
        <View>
          <Text accessibilityLiveRegion="polite">
            {formatBrl(estimate.total)} · válida por {estimate.expiresIn}s (estimativa; backend confirma)
          </Text>
        </View>
      ) : null}
    </View>
  );
}
