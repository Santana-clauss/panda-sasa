import { Home, Sprout, CloudRain, MapPin, User } from 'lucide-react';

export type TabKey = 'home' | 'advisor' | 'weather' | 'map' | 'profile';

const tabs: { key: TabKey; label: string; icon: typeof Home }[] = [
  { key: 'home', label: 'Home', icon: Home },
  { key: 'advisor', label: 'Advisor', icon: Sprout },
  { key: 'weather', label: 'Weather', icon: CloudRain },
  { key: 'map', label: 'Zones', icon: MapPin },
  { key: 'profile', label: 'Profile', icon: User },
];

export default function BottomNav({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-surface-container-low/95 backdrop-blur-md border-t border-outline-variant">
      <div className="mx-auto max-w-md flex items-stretch justify-between px-2 py-1.5">
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.key;
          return (
            <button
              key={t.key}
              onClick={() => onChange(t.key)}
              className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-colors"
            >
              <Icon
                size={22}
                className={isActive ? 'text-primary' : 'text-outline'}
                strokeWidth={isActive ? 2.4 : 2}
              />
              <span
                className={`text-[11px] font-medium ${isActive ? 'text-primary' : 'text-outline'}`}
              >
                {t.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
