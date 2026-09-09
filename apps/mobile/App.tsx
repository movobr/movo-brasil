import { useState } from 'react';
import { View } from 'react-native';
import { AuthScreen } from './src/screens/AuthScreen.js';
import { HomeScreen } from './src/screens/HomeScreen.js';
import { QuoteScreen } from './src/screens/QuoteScreen.js';

type Route = 'auth' | 'home' | 'quote';

/** Composição mínima (navegador dedicado chega com mais telas). */
export default function App() {
  const [route, setRoute] = useState<Route>('auth');
  const [phone, setPhone] = useState<string | null>(null);

  return (
    <View style={{ flex: 1 }}>
      {route === 'auth' ? (
        <AuthScreen
          onAuthenticated={(verified: string) => {
            setPhone(verified);
            setRoute('home');
          }}
        />
      ) : null}
      {route === 'home' && phone !== null ? (
        <View style={{ flex: 1 }}>
          <HomeScreen branding={null} tenantStatus="ACTIVE" />
        </View>
      ) : null}
      {route === 'quote' ? <QuoteScreen category="car" /> : null}
    </View>
  );
}
