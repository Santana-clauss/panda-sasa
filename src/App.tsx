import { useState } from 'react';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import BottomNav, { type TabKey } from '@/components/BottomNav';
import AuthScreen from '@/screens/AuthScreen';
import HomeScreen from '@/screens/HomeScreen';
import AdvisorScreen from '@/screens/AdvisorScreen';
import WeatherScreen from '@/screens/WeatherScreen';
import MapScreen from '@/screens/MapScreen';
import ProfileScreen from '@/screens/ProfileScreen';

function MainApp() {
  const { session, isGuest, loading } = useAuth();
  const [tab, setTab] = useState<TabKey>('home');

  if (loading) {
    return (
      <div className="min-h-screen bg-surface flex items-center justify-center">
        <p className="text-on-surface-variant">Loading Panda Sasa…</p>
      </div>
    );
  }

  if (!session && !isGuest) {
    return <AuthScreen />;
  }

  return (
    <div className="min-h-screen bg-surface md:flex">
      <BottomNav active={tab} onChange={setTab} />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 py-4 md:px-8 md:py-8 pb-24 md:pb-8 transition-all">
        {tab === 'home' && <HomeScreen onNavigate={setTab} />}
        {tab === 'advisor' && <AdvisorScreen />}
        {tab === 'weather' && <WeatherScreen />}
        {tab === 'map' && <MapScreen />}
        {tab === 'profile' && <ProfileScreen />}
      </main>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
