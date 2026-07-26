import { useEffect, useMemo, useState } from 'react';
import { Sprout, Bell, ChevronRight, MapPin, TrendingUp, Clock, CloudSun, AlertTriangle, CircleDot } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Season } from '@/lib/supabase';
import { COUNTIES, getCrop, type CropInfo } from '@/lib/data';
import { recommendCrops, calcGrowthStatus, generateNotifications, type CropRanking } from '@/lib/recommendations';
import { fetchWeather, weatherToRecommendations } from '@/lib/weather';
import { WeatherIcon } from '@/components/ui';
import type { TabKey } from '@/components/BottomNav';

export default function HomeScreen({ onNavigate }: { onNavigate: (k: TabKey) => void }) {
  const { profile, isGuest, detectedCounty, detectedCoords } = useAuth();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [rankings, setRankings] = useState<CropRanking[]>([]);
  const [weatherSummary, setWeatherSummary] = useState<string | null>(null);
  const [weatherCode, setWeatherCode] = useState<number | null>(null);
  const [temp, setTemp] = useState<number | null>(null);
  const [notifs, setNotifs] = useState<{ id: string; title: string; body: string; priority: string; type: string }[]>([]);

  const county = profile?.county ?? detectedCounty ?? 'Nakuru';
  const countyInfo = useMemo(() => COUNTIES.find((c) => c.name === county), [county]);

  // Use the user's exact GPS coordinates for weather and soil lookups when
  // available. Falls back to the county center only if GPS was denied.
  const lookupCoords = useMemo(
    () => detectedCoords ?? (countyInfo ? { latitude: countyInfo.latitude, longitude: countyInfo.longitude } : null),
    [detectedCoords, countyInfo],
  );

  useEffect(() => {
    setRankings(recommendCrops(county));
  }, [county]);

  useEffect(() => {
    if (isGuest) {
      setSeasons([]);
      return;
    }
    supabase
      .from('seasons')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data }) => setSeasons((data as Season[]) ?? []));
  }, [isGuest]);

  useEffect(() => {
    if (!lookupCoords) return;
    fetchWeather(lookupCoords.latitude, lookupCoords.longitude)
      .then((w) => {
        setWeatherCode(w.current.weatherCode);
        setTemp(w.current.temp);
        const recs = weatherToRecommendations(w.daily);
        if (recs.length) setWeatherSummary(recs[0].text);
      })
      .catch(() => setWeatherSummary(null));
  }, [lookupCoords]);

  useEffect(() => {
    if (!seasons.length) {
      setNotifs([]);
      return;
    }
    setNotifs(generateNotifications({ seasons, weatherRecs: weatherSummary ? [{ text: weatherSummary, tone: 'warning' }] : [] }));
  }, [seasons, weatherSummary]);

  const activeSeason = seasons[0];
  const growth = activeSeason ? calcGrowthStatus(activeSeason.planting_date, activeSeason.crop, activeSeason.variety ?? undefined) : null;

  const greetingName = profile?.name?.split(' ')[0] ?? (isGuest ? 'Guest' : 'Farmer');

  return (
    <div className="pb-24">
      {/* Header */}
      <header className="bg-gradient-to-b from-primary to-primary-container px-5 pt-12 pb-20 rounded-b-3xl">
        <div className="flex items-center justify-between mb-1">
          <div>
            <p className="text-on-primary/70 text-sm">Jambo, {greetingName}</p>
            <h1 className="text-on-primary text-2xl font-bold">Panda Sasa</h1>
          </div>
          <button onClick={() => onNavigate('profile')} className="relative w-10 h-10 rounded-full bg-white/15 flex items-center justify-center">
            <Bell size={20} className="text-on-primary" />
            {notifs.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-error text-on-error text-[10px] font-bold flex items-center justify-center">
                {notifs.length}
              </span>
            )}
          </button>
        </div>
        <div className="flex items-center gap-1.5 text-on-primary/80 text-sm mt-2">
          <MapPin size={14} />
          <span>{county} · {countyInfo?.agroEcologicalZone ?? 'Kenya'}</span>
        </div>
      </header>

      {/* Weather card */}
      <div className="px-5 -mt-12">
        <button
          onClick={() => onNavigate('weather')}
          className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-md flex items-center gap-4 hover:shadow-lg transition-shadow text-left"
        >
          <div className="w-12 h-12 rounded-full bg-primary-container/15 flex items-center justify-center">
            {weatherCode != null ? <WeatherIcon code={weatherCode} size={26} /> : <CloudSun size={26} className="text-primary" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold text-on-surface">{temp != null ? `${temp.toFixed(0)}°` : '—'}</span>
              <span className="text-sm text-outline">today</span>
            </div>
            <p className="text-xs text-on-surface-variant truncate">
              {weatherSummary ?? 'Tap to view 14-day forecast and planting advice'}
            </p>
          </div>
          <ChevronRight size={20} className="text-outline" />
        </button>
      </div>

      {/* My Season — ongoing guidance */}
      <section className="px-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-on-surface">My Season</h2>
          {activeSeason && (
            <button onClick={() => onNavigate('advisor')} className="text-sm text-primary font-medium">Guidance</button>
          )}
        </div>
        {activeSeason && growth ? (
          <button
            onClick={() => onNavigate('advisor')}
            className="w-full bg-surface-container-lowest rounded-2xl p-5 shadow-sm text-left"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{getCrop(activeSeason.crop)?.emoji ?? '🌱'}</span>
                <div>
                  <p className="font-semibold text-on-surface">{activeSeason.crop}</p>
                  <p className="text-xs text-outline">{activeSeason.variety ?? 'Standard variety'}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-outline">Day {growth.daysAfterPlanting}</p>
                <p className="text-sm font-medium text-primary">{growth.currentStage}</p>
              </div>
            </div>
            <div className="h-2 bg-surface-container-high rounded-full overflow-hidden mb-2">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${growth.progressPercent}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-on-surface-variant mb-3">
              <span className="flex items-center gap-1"><Clock size={12} /> {growth.remainingDays}d to harvest</span>
              <span>Harvest: {growth.harvestDate}</span>
            </div>
            {/* This week's task preview */}
            {(() => {
              const currentWeek = Math.floor(growth.daysAfterPlanting / 7) + 1;
              const cropData = getCrop(activeSeason.crop);
              const weekAct = cropData?.weeklyActivities.find((a) => a.week === currentWeek);
              if (!weekAct) return null;
              return (
                <div className="bg-primary-container/15 rounded-xl p-3 flex items-start gap-2.5">
                  <CircleDot size={16} className="text-primary shrink-0 mt-0.5 animate-pulse" />
                  <div>
                    <p className="text-xs font-semibold text-primary">This Week · Week {currentWeek}</p>
                    <p className="text-sm text-on-surface font-medium mt-0.5">{weekAct.title}</p>
                    <p className="text-xs text-on-surface-variant mt-0.5">{weekAct.description}</p>
                  </div>
                </div>
              );
            })()}
          </button>
        ) : (
          <button
            onClick={() => onNavigate('advisor')}
            className="w-full bg-surface-container-lowest rounded-2xl p-5 border-2 border-dashed border-outline-variant text-center"
          >
            <Sprout size={28} className="mx-auto text-outline mb-2" />
            <p className="text-sm font-medium text-on-surface">Plan your first season</p>
            <p className="text-xs text-outline mt-0.5">Get week-by-week guidance from planting to harvest</p>
          </button>
        )}
      </section>

      {/* Notifications */}
      {notifs.length > 0 && (
        <section className="px-5 mt-6">
          <h2 className="text-lg font-bold text-on-surface mb-3">Reminders</h2>
          <div className="space-y-2">
            {notifs.slice(0, 3).map((n) => (
              <div key={n.id} className="bg-surface-container-lowest rounded-xl p-3 flex items-start gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  n.priority === 'high' ? 'bg-error-container' : n.priority === 'medium' ? 'bg-tertiary-fixed' : 'bg-surface-container-high'
                }`}>
                  {n.priority === 'high' ? <AlertTriangle size={16} className="text-on-error-container" /> : <Bell size={16} className="text-on-surface-variant" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-on-surface">{n.title}</p>
                  <p className="text-xs text-on-surface-variant line-clamp-2">{n.body}</p>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Crop recommendations */}
      <section className="px-5 mt-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-on-surface">Recommended for {county}</h2>
          <TrendingUp size={18} className="text-primary" />
        </div>
        <div className="space-y-2.5">
          {rankings.slice(0, 5).map((r) => (
            <CropCard key={r.crop.name} ranking={r} onClick={() => onNavigate('advisor')} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CropCard({ ranking, onClick }: { ranking: CropRanking; onClick: () => void }) {
  const { crop, score, reasons } = ranking;
  return (
    <button
      onClick={onClick}
      className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex items-center gap-4 text-left hover:shadow-md transition-shadow"
    >
      <span className="text-3xl">{crop.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-on-surface">{crop.name}</p>
          <span className="text-sm font-bold text-primary">{score}%</span>
        </div>
        <p className="text-xs text-on-surface-variant line-clamp-1">{reasons[0]}</p>
        <div className="h-1 bg-surface-container-high rounded-full mt-1.5 overflow-hidden">
          <div className="h-full bg-primary rounded-full" style={{ width: `${score}%` }} />
        </div>
      </div>
      <ChevronRight size={18} className="text-outline" />
    </button>
  );
}
