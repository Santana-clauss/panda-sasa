import { useEffect, useMemo, useState } from 'react';
import { CloudRain, Droplets, Wind, Thermometer, Sun, AlertTriangle, CheckCircle2, CloudSun, Mountain, LocateFixed, Loader2, MapPin } from 'lucide-react';
import { fetchWeather, weatherToRecommendations, weatherLabel, type WeatherData } from '@/lib/weather';
import { detectLocation } from '@/lib/location';
import { COUNTIES } from '@/lib/data';
import { WeatherIcon } from '@/components/ui';

export default function WeatherScreen() {
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [coords, setCoords] = useState<{ latitude: number; longitude: number } | null>(null);
  const [county, setCounty] = useState<string>('Nakuru');
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState<string | null>(null);

  const countyInfo = useMemo(() => COUNTIES.find((c) => c.name === county), [county]);

  // Default to county center coordinates
  useEffect(() => {
    if (!coords && countyInfo) {
      setCoords({ latitude: countyInfo.latitude, longitude: countyInfo.longitude });
    }
  }, [coords, countyInfo]);

  useEffect(() => {
    if (!coords) return;
    setLoading(true);
    setError(null);
    fetchWeather(coords.latitude, coords.longitude)
      .then((w) => setWeather(w))
      .catch((e) => setError(e instanceof Error ? e.message : 'Could not load weather data.'))
      .finally(() => setLoading(false));
  }, [coords]);

  async function useMyLocation() {
    setLocating(true);
    setLocMsg(null);
    try {
      const loc = await detectLocation();
      setCoords({ latitude: loc.latitude, longitude: loc.longitude });
      setCounty(loc.county.name);
      setLocMsg(`Located: ${loc.county.name}${loc.subCounty ? ', ' + loc.subCounty : ''} (±${Math.round(loc.accuracyMeters ?? 0)}m)`);
    } catch (e) {
      setLocMsg(e instanceof Error ? e.message : 'Could not detect location.');
    } finally {
      setLocating(false);
    }
  }

  function selectCounty(name: string) {
    const c = COUNTIES.find((c) => c.name === name);
    if (c) {
      setCounty(name);
      setCoords({ latitude: c.latitude, longitude: c.longitude });
    }
  }

  const recs = useMemo(() => (weather ? weatherToRecommendations(weather.daily) : []), [weather]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 size={32} className="animate-spin text-primary" />
        <p className="text-sm text-on-surface-variant">Loading live weather data…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <AlertTriangle size={32} className="text-error" />
        <p className="text-sm text-error font-medium">{error}</p>
        <button onClick={useMyLocation} className="mt-2 px-4 py-2 rounded-xl bg-primary text-on-primary text-sm font-semibold">
          Retry
        </button>
      </div>
    );
  }

  if (!weather) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="bg-gradient-to-r from-primary to-primary-container p-6 md:p-8 rounded-3xl text-on-primary shadow-md">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Weather & Climate</h1>
        <p className="text-on-primary/80 text-sm mt-1.5 font-medium">Live forecast from Open-Meteo · 14-day outlook with planting advisories</p>
        <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-white/15">
          <button
            onClick={useMyLocation}
            disabled={locating}
            className="flex items-center gap-1.5 text-xs text-on-primary/90 bg-white/15 hover:bg-white/25 transition-colors px-3.5 py-2 rounded-xl disabled:opacity-60 font-medium"
          >
            {locating ? <Loader2 size={14} className="animate-spin" /> : <LocateFixed size={14} />}
            {locating ? 'Detecting…' : 'Use my GPS'}
          </button>
          <div className="flex items-center gap-1.5 text-xs text-on-primary/90 bg-white/15 px-3.5 py-2 rounded-xl font-medium">
            <MapPin size={14} /> {county}
          </div>
        </div>
        {locMsg && <p className="text-xs text-on-primary/80 mt-2 font-medium">{locMsg}</p>}
      </header>

      {/* County Quick Selector */}
      <div className="flex flex-wrap gap-1.5">
        {COUNTIES.slice(0, 12).map((c) => (
          <button
            key={c.name}
            onClick={() => selectCounty(c.name)}
            className={`text-xs px-3 py-1.5 rounded-full transition-colors font-medium ${
              c.name === county
                ? 'bg-primary text-on-primary'
                : 'bg-surface-container-high text-on-surface-variant hover:bg-primary/10 hover:text-primary'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* Current Conditions */}
      <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/50">
        <div className="flex items-start justify-between mb-4">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-primary">Current Conditions</span>
            <h2 className="text-xl font-bold text-on-surface mt-1">{county}</h2>
            <p className="text-sm text-on-surface-variant">{weatherLabel(weather.current.weatherCode)}</p>
          </div>
          <div className="w-14 h-14 rounded-2xl bg-primary-container/20 flex items-center justify-center text-primary">
            <WeatherIcon code={weather.current.weatherCode} size={32} />
          </div>
        </div>

        <div className="flex items-baseline gap-2 mb-4">
          <span className="text-5xl font-extrabold text-on-surface">{weather.current.temp.toFixed(0)}°C</span>
          <span className="text-sm font-medium text-outline">Feels like {weather.current.feelsLike.toFixed(0)}°C</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          <Metric icon={Droplets} label="Humidity" value={`${weather.current.humidity.toFixed(0)}%`} />
          <Metric icon={Wind} label="Wind" value={`${weather.current.windSpeed.toFixed(0)} km/h`} />
          <Metric icon={CloudRain} label="Rain" value={`${weather.current.precipitation.toFixed(1)}mm`} />
        </div>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <Metric icon={Thermometer} label="Soil Temp" value={`${weather.current.soilTemperature.toFixed(0)}°C`} />
          <Metric icon={Sun} label="ET0" value={`${weather.current.evapotranspiration.toFixed(1)}mm`} />
          <Metric icon={Mountain} label="Elevation" value={weather.elevation != null ? `${weather.elevation.toFixed(0)}m` : '—'} />
        </div>
      </div>

      {/* 14-Day Forecast */}
      <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/50">
        <h3 className="text-sm font-bold uppercase tracking-wider text-primary mb-4">14-Day Forecast</h3>
        <div className="space-y-2">
          {weather.daily.map((d, i) => (
            <div
              key={d.date}
              className={`flex items-center gap-3 rounded-2xl p-3 transition-colors ${
                i === 0 ? 'bg-primary/10 border border-primary/20' : 'bg-surface-container-high hover:bg-surface-container-low'
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-primary-container/20 flex items-center justify-center text-primary shrink-0">
                <WeatherIcon code={d.weatherCode} size={22} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-on-surface">
                  {i === 0 ? 'Today' : new Date(d.date).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
                <p className="text-xs text-on-surface-variant">{weatherLabel(d.weatherCode)}</p>
              </div>
              <div className="text-right shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-on-surface">{d.tempMax.toFixed(0)}°</span>
                  <span className="text-xs text-outline">{d.tempMin.toFixed(0)}°</span>
                </div>
                <div className="flex items-center gap-1.5 justify-end mt-0.5">
                  <CloudRain size={12} className="text-primary" />
                  <span className="text-xs font-medium text-primary">{d.precipitation.toFixed(1)}mm</span>
                  <span className="text-xs text-outline">({d.precipitationProbability}%)</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Planting Recommendations */}
      {recs.length > 0 && (
        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/50">
          <h3 className="text-sm font-bold uppercase tracking-wider text-primary mb-4">Planting Advisory</h3>
          <div className="space-y-2.5">
            {recs.map((r, i) => (
              <div
                key={i}
                className={`flex items-start gap-3 rounded-2xl p-3.5 ${
                  r.tone === 'good'
                    ? 'bg-primary/10 border border-primary/20'
                    : r.tone === 'warning'
                    ? 'bg-tertiary/10 border border-tertiary/20'
                    : 'bg-error/10 border border-error/20'
                }`}
              >
                {r.tone === 'good' ? (
                  <CheckCircle2 size={18} className="text-primary shrink-0 mt-0.5" />
                ) : r.tone === 'warning' ? (
                  <CloudSun size={18} className="text-tertiary shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle size={18} className="text-error shrink-0 mt-0.5" />
                )}
                <p className="text-sm text-on-surface-variant leading-relaxed">{r.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Wind; label: string; value: string }) {
  return (
    <div className="bg-surface-container-high rounded-xl p-3 text-center">
      <Icon size={16} className="text-primary mx-auto mb-1" />
      <p className="text-[11px] text-on-surface-variant font-medium">{label}</p>
      <p className="text-sm font-bold text-on-surface mt-0.5">{value}</p>
    </div>
  );
}
