import { useState } from 'react';
import { View } from 'react-native';
import { AuthScreen } from './src/screens/AuthScreen.js';
import { DriverScreen } from './src/screens/DriverScreen.js';
import { HistoryScreen, PaymentSheet, TrackingScreen } from './src/screens/PassengerScreens.js';
import { HomeScreen } from './src/screens/HomeScreen.js';
import { QuoteScreen } from './src/screens/QuoteScreen.js';

type Route = 'auth' | 'home' | 'quote' | 'driver' | 'tracking' | 'history' | 'payment';

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
      {route === 'driver' ? (
        <DriverScreen branding={null} offers={[]} activeRide={null} screenState="empty" onNavigate={() => {}} />
      ) : null}
      {route === 'tracking' ? (
        <TrackingScreen
          branding={null}
          status="MATCHING"
          rideId="device-ride"
          tenantId="device-tenant"
          driverName={null}
          etaSeconds={null}
          driverUpdatedAt={null}
          quotedMinor={0}
          paymentMethod={null}
          paymentStatus={null}
          paidMinor={null}
          now={new Date()}
          screenState="ready"
        />
      ) : null}
      {route === 'history' ? <HistoryScreen branding={null} entries={[]} screenState="empty" /> : null}
      {route === 'payment' ? <PaymentSheet selected="pix" onSelect={() => {}} /> : null}
    </View>
  );
}
