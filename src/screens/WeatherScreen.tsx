import { useEffect, useState } from 'react';
import { CloudRain, Droplets, Wind, Thermometer, Sun, AlertTriangle, CheckCircle2, CloudSun, Mountain, Sprout } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { COUNTIES } from '@/lib/data';
import { fetchWeather, weatherToRecommendations, weatherLabel, type WeatherData, type WeatherRecommendation } from '@/lib/weather';
import { WeatherIcon } from '@/components/ui';

export default function WeatherScreen() {
  const { profile, detectedCounty, detectedCoords } = useAuth();
  const countyName = profile?.county ?? detectedCounty ?? 'Nakuru';
  const county = COUNTIES.find((c) => c.name === countyName) ?? COUNTIES[0];
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [recs, setRecs] = useState<WeatherRecommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Use exact GPS coordinates when available; fall back to county center.
  const coords = detectedCoords ?? { latitude: county.latitude, longitude: county.longitude };

  useEffect(() => {
    setLoading(true);
    setError(null);
    fetchWeather(coords.latitude, coords.longitude)
      .then((w) => {
        setWeather(w);
        setRecs(weatherToRecommendations(w.daily));
        setLoading(false);
      })
      .catch((e) => {
        setError(e.message ?? 'Failed to load weather');
        setLoading(false);
      });
  }, [coords.latitude, coords.longitude]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-on-surface-variant">Loading weather for {countyName}…</p>
      </div>
    );
  }

  if (error || !weather) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center">
        <AlertTriangle size={32} className="text-error mb-2" />
        <p className="text-on-surface font-medium">Couldn't load weather</p>
        <p className="text-sm text-outline">{error ?? 'Unknown error'}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <header className="bg-gradient-to-r from-primary to-primary-container p-6 md:p-8 rounded-3xl text-on-primary shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Weather & Climate Advisor</h1>
            <p className="text-on-primary/80 text-sm mt-1.5 flex items-center gap-1.5 font-medium">
              <CloudRain size={16} /> {countyName} · {county.agroEcologicalZone} Zone
            </p>
          </div>
          <div className="bg-white/15 px-4 py-2 rounded-2xl text-xs font-semibold backdrop-blur-md self-start sm:self-auto">
            Updated Hourly
          </div>
        </div>
      </header>

      {/* Main Grid: Current Conditions & Forecast / Recommendations */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Current Weather Overview & Recommendations */}
        <div className="lg:col-span-5 space-y-6">
          {/* Current Weather Card */}
          <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/50">
            <h2 className="text-xs font-bold uppercase tracking-wider text-primary mb-3">Current Conditions</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-5xl font-extrabold text-on-surface">{weather.current.temp.toFixed(0)}°C</p>
                <p className="text-base font-semibold text-on-surface-variant mt-1">{weatherLabel(weather.current.weatherCode)}</p>
                <p className="text-xs text-outline font-medium mt-0.5">Feels like {weather.current.feelsLike.toFixed(0)}°C</p>
              </div>
              <div className="p-3 bg-primary-container/20 rounded-3xl">
                <WeatherIcon code={weather.current.weatherCode} size={64} />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5 mt-6">
              <Metric icon={Droplets} label="Humidity" value={`${weather.current.humidity.toFixed(0)}%`} />
              <Metric icon={Wind} label="Wind" value={`${weather.current.windSpeed.toFixed(0)} km/h`} />
              <Metric icon={CloudRain} label="Rain" value={`${weather.current.precipitation.toFixed(1)}mm`} />
            </div>
            <div className="grid grid-cols-3 gap-2.5 mt-2.5">
              <Metric icon={Thermometer} label="Soil Temp" value={`${weather.current.soilTemperature.toFixed(0)}°C`} />
              <Metric icon={Sun} label="ET0" value={`${weather.current.evapotranspiration.toFixed(1)}mm`} />
              <Metric icon={Mountain} label="Elevation" value={weather.elevation != null ? `${weather.elevation.toFixed(0)}m` : '—'} />
            </div>
          </div>

          {/* Farming Recommendations */}
          <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/50 space-y-3">
            <h2 className="text-lg font-bold text-on-surface">Farming Recommendations</h2>
            <div className="space-y-2.5">
              {recs.map((r, i) => (
                <div
                  key={i}
                  className={`rounded-2xl p-4 flex items-start gap-3 border border-outline-variant/30 ${
                    r.tone === 'good' ? 'bg-primary-container/15' : r.tone === 'warning' ? 'bg-tertiary-fixed/40' : 'bg-error-container/40'
                  }`}
                >
                  {r.tone === 'good' ? (
                    <CheckCircle2 size={20} className="text-primary shrink-0 mt-0.5" />
                  ) : r.tone === 'warning' ? (
                    <CloudSun size={20} className="text-tertiary shrink-0 mt-0.5" />
                  ) : (
                    <AlertTriangle size={20} className="text-error shrink-0 mt-0.5" />
                  )}
                  <p className="text-sm font-medium text-on-surface">{r.text}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Rainfall Zone Info Card */}
          <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/50">
            <h3 className="font-bold text-on-surface mb-2 flex items-center gap-2">
              <Thermometer size={18} className="text-primary" /> Rainfall Zone Profile
            </h3>
            <p className="text-sm text-on-surface-variant leading-relaxed">
              <span className="font-bold text-on-surface">{countyName}</span> is classified in a <span className="font-semibold text-primary">{county.rainfallZone}</span> rainfall zone receiving approximately <span className="font-semibold">{county.annualRainfallMm}mm</span> annually.
            </p>
            <div className="mt-3 p-3 rounded-2xl bg-surface-container-low text-xs text-outline space-y-1 font-medium">
              <p>🌱 Long rains window: <span className="text-on-surface font-semibold">{county.longRainsStart} – {county.longRainsEnd}</span></p>
              <p>🌾 Short rains window: <span className="text-on-surface font-semibold">{county.shortRainsStart} – {county.shortRainsEnd}</span></p>
            </div>
          </div>
        </div>

        {/* Right Column: 14-Day Forecast */}
        <div className="lg:col-span-7 bg-surface-container-lowest rounded-3xl p-6 shadow-sm border border-outline-variant/50 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-on-surface">14-Day Forecast</h2>
              <span className="text-xs text-outline font-medium">High / Low Temperature</span>
            </div>

            <div className="divide-y divide-outline-variant/40">
              {weather.daily.map((d, i) => {
                const date = new Date(d.date);
                const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en', { weekday: 'short' });
                return (
                  <div key={d.date} className="flex items-center gap-4 py-3.5 px-2 hover:bg-surface-container-low/50 rounded-2xl transition-colors">
                    <div className="w-20">
                      <p className="text-sm font-bold text-on-surface">{dayName}</p>
                      <p className="text-xs text-outline font-medium">{date.toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p>
                    </div>
                    <WeatherIcon code={d.weatherCode} size={26} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-on-surface-variant">{weatherLabel(d.weatherCode)}</p>
                      <p className="text-xs text-outline font-medium flex items-center gap-1 mt-0.5">
                        <Droplets size={12} className="text-primary" /> {d.precipitation.toFixed(1)}mm · {d.precipitationProbability.toFixed(0)}% chance
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-base font-bold text-on-surface">{d.tempMax.toFixed(0)}°C</p>
                      <p className="text-xs text-outline font-medium">{d.tempMin.toFixed(0)}°C</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Droplets; label: string; value: string }) {
  return (
    <div className="bg-surface-container-high/60 rounded-2xl p-3 text-center border border-outline-variant/30">
      <Icon size={18} className="mx-auto text-primary mb-1" />
      <p className="text-[11px] text-outline font-medium">{label}</p>
      <p className="text-sm font-bold text-on-surface mt-0.5">{value}</p>
    </div>
  );
}

