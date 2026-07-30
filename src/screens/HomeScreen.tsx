import { useEffect, useMemo, useState } from 'react';
import { Sprout, Bell, ChevronRight, MapPin, TrendingUp, Clock, CloudSun, AlertTriangle, CircleDot, LocateFixed, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Season, type Activity } from '@/lib/supabase';
import { COUNTIES, getCrop, type CropInfo } from '@/lib/data';
import { calcGrowthStatus, generateNotifications } from '@/lib/recommendations';
import { generateRecommendations, type CropRecommendation, type DataSources } from '@/lib/recommendationEngine';
import { fetchWeather, weatherToRecommendations } from '@/lib/weather';
import { detectLocation } from '@/lib/location';
import { WeatherIcon } from '@/components/ui';
import type { TabKey } from '@/components/BottomNav';

export default function HomeScreen({ onNavigate }: { onNavigate: (k: TabKey) => void }) {
  const { profile, isGuest, detectedCounty, detectedCoords } = useAuth();
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [liveRecs, setLiveRecs] = useState<CropRecommendation[]>([]);
  const [dataSources, setDataSources] = useState<DataSources | null>(null);
  const [recsLoading, setRecsLoading] = useState(false);
  const [weatherSummary, setWeatherSummary] = useState<string | null>(null);
  const [weatherCode, setWeatherCode] = useState<number | null>(null);
  const [temp, setTemp] = useState<number | null>(null);
  const [notifs, setNotifs] = useState<{ id: string; title: string; body: string; priority: string; type: string }[]>([]);
  const [currentActivity, setCurrentActivity] = useState<Activity | null>(null);
  const [manualCoords, setManualCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [manualCounty, setManualCounty] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [showCountyPicker, setShowCountyPicker] = useState(false);

  const county = manualCounty ?? profile?.county ?? detectedCounty ?? 'Nakuru';
  const countyInfo = useMemo(() => COUNTIES.find((c) => c.name === county), [county]);

  // Use the user's exact GPS coordinates for weather and soil lookups when
  // available. Manual override takes priority, then detected GPS, then county center.
  const lookupCoords = useMemo(
    () => manualCoords ?? detectedCoords ?? (countyInfo ? { latitude: countyInfo.latitude, longitude: countyInfo.longitude } : null),
    [manualCoords, detectedCoords, countyInfo],
  );

  async function useMyLocation() {
    setLocating(true);
    setLocMsg(null);
    try {
      const loc = await detectLocation();
      setManualCoords({ latitude: loc.latitude, longitude: loc.longitude });
      setManualCounty(loc.county.name);
      setLocMsg(`Located: ${loc.county.name} (±${Math.round(loc.accuracyMeters ?? 0)}m)`);
    } catch (e) {
      setLocMsg(e instanceof Error ? e.message : 'Could not detect location.');
    } finally {
      setLocating(false);
    }
  }

  function selectCounty(name: string) {
    setManualCounty(name);
    setManualCoords(null);
    setShowCountyPicker(false);
    setLocMsg(`Using ${name}`);
  }

  // Live recommendations from APIs (climate + soil + weather + FAO)
  useEffect(() => {
    if (!lookupCoords) return;
    setRecsLoading(true);
    generateRecommendations({
      lat: lookupCoords.latitude,
      lon: lookupCoords.longitude,
      countyName: county,
    })
      .then((result) => {
        setLiveRecs(result.recommendations);
        setDataSources(result.sources);
      })
      .catch(() => {
        setLiveRecs([]);
        setDataSources(null);
      })
      .finally(() => setRecsLoading(false));
  }, [lookupCoords, county]);

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

  // Fetch the current week's actual saved activity for the active season.
  useEffect(() => {
    if (!activeSeason || !growth || growth.isBeforePlanting) {
      setCurrentActivity(null);
      return;
    }
    const currentWeek = Math.floor(growth.daysAfterPlanting / 7) + 1;
    supabase
      .from('activities')
      .select('*')
      .eq('season_id', activeSeason.id)
      .eq('week_number', currentWeek)
      .maybeSingle()
      .then(({ data }) => setCurrentActivity((data as Activity) ?? null));
  }, [activeSeason?.id, growth?.daysAfterPlanting, growth?.isBeforePlanting]);

  const greetingName = profile?.name?.split(' ')[0] ?? (isGuest ? 'Guest' : 'Farmer');

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <header className="bg-gradient-to-r from-primary via-primary to-primary-container p-6 md:p-8 rounded-3xl shadow-md text-on-primary">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-on-primary/80 text-sm font-medium">Jambo, {greetingName}</p>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Panda Sasa Dashboard</h1>
            <div className="flex items-center gap-2 text-on-primary/90 text-sm mt-1.5 font-medium">
              <MapPin size={16} />
              <span>{county} · {countyInfo?.agroEcologicalZone ?? 'Kenya'}</span>
            </div>
          </div>
          <button onClick={() => onNavigate('profile')} className="self-start sm:self-auto relative p-3 rounded-2xl bg-white/15 hover:bg-white/25 transition-colors flex items-center gap-2">
            <Bell size={20} className="text-on-primary" />
            <span className="text-xs font-semibold">Notifications</span>
            {notifs.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-error text-on-error text-xs font-bold flex items-center justify-center">
                {notifs.length}
              </span>
            )}
          </button>
        </div>

        {/* Location controls */}
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-white/15">
          <button
            onClick={useMyLocation}
            disabled={locating}
            className="flex items-center gap-1.5 text-xs text-on-primary/90 bg-white/15 hover:bg-white/25 transition-colors px-3.5 py-2 rounded-xl disabled:opacity-60 font-medium"
          >
            {locating ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
            {locating ? 'Detecting location…' : 'Use my GPS location'}
          </button>
          <button
            onClick={() => setShowCountyPicker(!showCountyPicker)}
            className="flex items-center gap-1.5 text-xs text-on-primary/90 bg-white/15 hover:bg-white/25 transition-colors px-3.5 py-2 rounded-xl font-medium"
          >
            <MapPin size={14} /> Select County
          </button>
        </div>
        {locMsg && <p className="text-xs text-on-primary/80 mt-2 font-medium">{locMsg}</p>}
        {showCountyPicker && (
          <div className="mt-3 bg-white/20 backdrop-blur-md rounded-2xl p-3 max-h-48 overflow-y-auto border border-white/20">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-1.5">
              {COUNTIES.map((c) => (
                <button
                  key={c.name}
                  onClick={() => selectCounty(c.name)}
                  className={`text-xs px-3 py-2 rounded-xl text-left transition-colors ${
                    c.name === county ? 'bg-white text-primary font-bold shadow-sm' : 'text-on-primary/90 hover:bg-white/20'
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Grid Row 1: Weather + Active Season Tracker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weather Summary Card */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/50 flex flex-col justify-between">
          <div className="flex items-start justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Weather & Climate</span>
              <h2 className="text-xl font-bold text-on-surface mt-1">{county} Forecast</h2>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center text-primary">
              {weatherCode != null ? <WeatherIcon code={weatherCode} size={28} /> : <CloudSun size={28} />}
            </div>
          </div>
          <div className="my-4">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-on-surface">{temp != null ? `${temp.toFixed(0)}°C` : '—'}</span>
              <span className="text-sm font-medium text-outline">Current Temperature</span>
            </div>
            <p className="text-sm text-on-surface-variant mt-2 leading-relaxed">
              {weatherSummary ?? 'Tap below to view full 14-day forecast and rainfall advisory.'}
            </p>
          </div>
          <button
            onClick={() => onNavigate('advisor')}
            className="w-full mt-2 py-3 px-4 rounded-2xl bg-surface-container-high hover:bg-primary hover:text-on-primary transition-all text-sm font-semibold flex items-center justify-between text-on-surface"
          >
            <span>View Planting Advisor</span>
            <ChevronRight size={18} />
          </button>
        </div>

        {/* My Season Tracker */}
        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/50 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-primary">Season Progress</span>
              <h2 className="text-xl font-bold text-on-surface mt-1">My Active Season</h2>
            </div>
            {activeSeason && (
              <button onClick={() => onNavigate('advisor')} className="text-sm text-primary font-semibold hover:underline">
                View Plan →
              </button>
            )}
          </div>

          {activeSeason && growth ? (
            <div className="my-4 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl p-2 rounded-2xl bg-surface-container-low">{getCrop(activeSeason.crop)?.emoji ?? '🌱'}</span>
                  <div>
                    <p className="font-bold text-lg text-on-surface">{activeSeason.crop}</p>
                    <p className="text-xs text-outline">{activeSeason.variety ?? 'Standard variety'}</p>
                  </div>
                </div>
                <div className="text-right">
                  {growth.isBeforePlanting ? (
                    <>
                      <p className="text-xs text-outline">Opens in</p>
                      <p className="text-base font-bold text-primary">{growth.remainingDays} days</p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs text-outline">Day {growth.daysAfterPlanting}</p>
                      <p className="text-base font-bold text-primary">{growth.currentStage}</p>
                    </>
                  )}
                </div>
              </div>

              <div>
                <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${growth.progressPercent}%` }} />
                </div>
                <div className="flex items-center justify-between text-xs text-on-surface-variant font-medium">
                  <span className="flex items-center gap-1"><Clock size={13} /> {growth.remainingDays}d remaining</span>
                  <span>Est. Harvest: {growth.harvestDate}</span>
                </div>
              </div>

              {/* Task preview */}
              {(() => {
                if (growth.isBeforePlanting) {
                  return (
                    <div className="bg-primary-container/15 rounded-2xl p-3.5 flex items-start gap-3">
                      <CircleDot size={18} className="text-primary shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs font-bold text-primary">Pre-Planting Stage</p>
                        <p className="text-sm font-semibold text-on-surface mt-0.5">Prepare soil & certified seeds</p>
                      </div>
                    </div>
                  );
                }
                const currentWeek = Math.floor(growth.daysAfterPlanting / 7) + 1;
                const task = currentActivity;
                if (!task) return null;
                return (
                  <div className="bg-primary-container/15 rounded-2xl p-3.5 flex items-start gap-3">
                    <CircleDot size={18} className="text-primary shrink-0 mt-0.5 animate-pulse" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-primary">This Week · Week {currentWeek}</p>
                        {task.completed && <span className="text-xs text-primary font-bold">✓ Completed</span>}
                      </div>
                      <p className="text-sm font-semibold text-on-surface mt-0.5 truncate">{task.title}</p>
                    </div>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div className="my-6 text-center py-4">
              <Sprout size={36} className="mx-auto text-outline/60 mb-2" />
              <p className="text-sm font-semibold text-on-surface">No active season tracked yet</p>
              <p className="text-xs text-outline mt-1 max-w-xs mx-auto">Get week-by-week guidance customized for your crop and region.</p>
              <button
                onClick={() => onNavigate('advisor')}
                className="mt-4 px-5 py-2.5 rounded-xl bg-primary text-on-primary text-xs font-bold shadow-md hover:bg-primary/90 transition-all"
              >
                Plan First Season
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid Row 2: Reminders + Recommended Crops */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Reminders Column */}
        {notifs.length > 0 && (
          <div className="lg:col-span-4 bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/50">
            <h2 className="text-lg font-bold text-on-surface mb-4 flex items-center justify-between">
              <span>Reminders</span>
              <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">{notifs.length} new</span>
            </h2>
            <div className="space-y-3">
              {notifs.slice(0, 4).map((n) => (
                <div key={n.id} className="bg-surface-container-low/70 rounded-2xl p-3.5 flex items-start gap-3 border border-outline-variant/30">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                    n.priority === 'high' ? 'bg-error-container text-on-error-container' : 'bg-primary-container/30 text-primary'
                  }`}>
                    {n.priority === 'high' ? <AlertTriangle size={16} /> : <Bell size={16} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-on-surface">{n.title}</p>
                    <p className="text-xs text-on-surface-variant line-clamp-2 mt-0.5">{n.body}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommended Crops Grid */}
        <div className={`${notifs.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12'} bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/50`}>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-on-surface">Top Recommended Crops</h2>
              <p className="text-xs text-outline">
                {liveRecs.length > 0
                  ? `Live analysis for ${county} — soil, climate & weather data`
                  : `Tailored for ${county} soil & rainfall profile`}
              </p>
              {dataSources && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${dataSources.climate === 'live' ? 'bg-primary/10 text-primary' : 'bg-outline/10 text-outline'}`}>
                    {dataSources.climate === 'live' ? '🟢' : '🟡'} Climate
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${dataSources.soil === 'live' ? 'bg-primary/10 text-primary' : 'bg-outline/10 text-outline'}`}>
                    {dataSources.soil === 'live' ? '🟢' : '🟡'} Soil
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${dataSources.weather === 'live' ? 'bg-primary/10 text-primary' : 'bg-outline/10 text-outline'}`}>
                    {dataSources.weather === 'live' ? '🟢' : '🟡'} Weather
                  </span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${dataSources.faoCalendar === 'live' ? 'bg-primary/10 text-primary' : 'bg-outline/10 text-outline'}`}>
                    {dataSources.faoCalendar === 'live' ? '🟢' : '🟡'} FAO
                  </span>
                </div>
              )}
            </div>
            {recsLoading ? <Loader2 size={20} className="text-primary animate-spin" /> : <TrendingUp size={20} className="text-primary" />}
          </div>
          {recsLoading && liveRecs.length === 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="animate-pulse bg-surface-container-low/60 rounded-2xl p-4 border border-outline-variant/30 h-24 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-surface-container-high" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-surface-container-high rounded w-3/4" />
                    <div className="h-3 bg-surface-container-high rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : liveRecs.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {liveRecs.slice(0, 4).map((r) => (
                <LiveCropCard key={r.crop.name} rec={r} onClick={() => onNavigate('advisor')} />
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-on-surface-variant text-sm">
              <p>Live recommendations loading from API…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function LiveCropCard({ rec, onClick }: { rec: CropRecommendation; onClick: () => void }) {
  const { crop, score, verdict, explanations } = rec;
  const verdictColor = verdict === 'Highly Recommended' ? 'text-primary' : verdict === 'Recommended' ? 'text-tertiary' : verdict === 'Marginal' ? 'text-outline' : 'text-error';
  return (
    <button
      onClick={onClick}
      className="w-full bg-surface-container-low/60 rounded-2xl p-4 border border-outline-variant/30 flex items-center gap-4 text-left hover:bg-surface-container-high hover:border-primary/40 transition-all group"
    >
      <span className="text-3xl p-2 rounded-2xl bg-surface-container-lowest shadow-xs group-hover:scale-105 transition-transform">{crop.emoji}</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <p className="font-bold text-on-surface">{crop.name}</p>
          <span className="text-xs font-extrabold text-primary px-2 py-0.5 rounded-full bg-primary/10">{score}%</span>
        </div>
        <p className={`text-[11px] font-semibold mt-0.5 ${verdictColor}`}>{verdict}</p>
        <p className="text-xs text-on-surface-variant line-clamp-1 mt-0.5">{explanations[0]}</p>
        <div className="h-1.5 bg-surface-container-high rounded-full mt-2 overflow-hidden">
          <div
            className={`h-full rounded-full ${score >= 70 ? 'bg-primary' : score >= 50 ? 'bg-tertiary' : 'bg-error'}`}
            style={{ width: `${score}%` }}
          />
        </div>
      </div>
      <ChevronRight size={18} className="text-outline group-hover:text-primary transition-colors" />
    </button>
  );
}

