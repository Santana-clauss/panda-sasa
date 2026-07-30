import { Home, Sprout, ShoppingBag, MapPin, User } from 'lucide-react';

export type TabKey = 'home' | 'advisor' | 'market' | 'map' | 'profile';

const tabs: { key: TabKey; label: string; icon: typeof Home; description: string }[] = [
  { key: 'home', label: 'Home', icon: Home, description: 'Dashboard & Tasks' },
  { key: 'advisor', label: 'Advisor', icon: Sprout, description: 'Planting Recommendations' },
  { key: 'market', label: 'Market', icon: ShoppingBag, description: 'Opportunity Signals' },
  { key: 'map', label: 'Zones', icon: MapPin, description: 'Agro-Ecological Map' },
  { key: 'profile', label: 'Profile', icon: User, description: 'Settings & Seasons' },
];

export default function BottomNav({
  active,
  onChange,
}: {
  active: TabKey;
  onChange: (k: TabKey) => void;
}) {
  return (
    <>
      {/* Mobile Bottom Bar (visible on < md screens) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-surface-container-low/95 backdrop-blur-md border-t border-outline-variant">
        <div className="mx-auto max-w-md flex items-stretch justify-between px-2 py-1.5">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                onClick={() => onChange(t.key)}
                className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-full transition-colors ${
                  isActive ? 'bg-primary/10' : ''
                }`}
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

      {/* Desktop Sidebar (visible on >= md screens) */}
      <aside className="hidden md:flex flex-col w-64 lg:w-72 shrink-0 border-r border-outline-variant/60 bg-surface-container-lowest/80 backdrop-blur-md min-h-screen sticky top-0 h-screen p-6 shadow-sm">
        {/* Brand Header */}
        <div className="flex items-center gap-3 mb-8 px-2">
          <div className="w-11 h-11 rounded-2xl bg-primary flex items-center justify-center text-on-primary shadow-md shadow-primary/20">
            <Sprout size={26} strokeWidth={2.4} />
          </div>
          <div>
            <h1 className="text-xl font-bold text-on-surface tracking-tight leading-none">Panda Sasa</h1>
            <p className="text-xs text-on-surface-variant/80 font-medium mt-1">Smart Farming Kenya</p>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="space-y-1.5 flex-1">
          {tabs.map((t) => {
            const Icon = t.icon;
            const isActive = active === t.key;
            return (
              <button
                key={t.key}
                onClick={() => onChange(t.key)}
                className={`w-full flex items-center gap-3.5 px-4 py-3 rounded-2xl text-left transition-all ${
                  isActive
                    ? 'bg-primary text-on-primary font-semibold shadow-md shadow-primary/20 translate-x-1'
                    : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface'
                }`}
              >
                <Icon
                  size={22}
                  className={isActive ? 'text-on-primary' : 'text-outline'}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                <div>
                  <div className="text-sm leading-snug">{t.label}</div>
                  <div className={`text-[11px] font-normal ${isActive ? 'text-on-primary/80' : 'text-outline'}`}>
                    {t.description}
                  </div>
                </div>
              </button>
            );
          })}
        </nav>

        {/* Footer info in sidebar */}
        <div className="mt-auto pt-6 border-t border-outline-variant/50 px-2">
          <div className="p-3.5 rounded-2xl bg-surface-container-low border border-outline-variant/40">
            <div className="flex items-center gap-2 text-xs font-semibold text-primary">
              <Sprout size={16} />
              <span>County Advisory</span>
            </div>
            <p className="text-[11px] text-on-surface-variant mt-1 leading-relaxed">
              Localized agricultural guidance tuned for Kenyan soil & climate zones.
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}

