import { Text, View } from 'react-native';
import type { BrandingConfig } from '@movo/brasil/src/domain/branding.js';
import { paletteFor } from '../lib/theme.js';

/** 21 Home: marca do tenant + disponibilidade (tema resolvido do branding). */
export function HomeScreen({ branding, tenantStatus }: { branding: BrandingConfig | null; tenantStatus: string }) {
  const palette = paletteFor(branding);
  return (
    <View accessible accessibilityLabel="Início" style={{ backgroundColor: palette.surface, flex: 1, padding: 16 }}>
      <Text accessibilityRole="header" style={{ color: palette.onSurface, fontSize: 22 }}>
        {branding?.commercialName ?? 'MOVO Brasil'}
      </Text>
      <Text style={{ color: palette.onSurface }}>Operação: {tenantStatus}</Text>
      <Text style={{ color: palette.primary }}>Para onde vamos?</Text>
    </View>
  );
}
