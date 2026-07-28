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
    <div className="pb-24">
      <header className="bg-gradient-to-b from-primary to-primary-container px-5 pt-12 pb-20 rounded-b-3xl">
        <h1 className="text-on-primary text-2xl font-bold">Weather</h1>
        <p className="text-on-primary/80 text-sm mt-1 flex items-center gap-1">
          <CloudRain size={14} /> {countyName} · {county.agroEcologicalZone}
        </p>
      </header>

      {/* Current conditions */}
      <div className="px-5 -mt-12">
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-md">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-4xl font-bold text-on-surface">{weather.current.temp.toFixed(0)}°C</p>
              <p className="text-sm text-on-surface-variant">{weatherLabel(weather.current.weatherCode)}</p>
              <p className="text-xs text-outline mt-0.5">Feels like {weather.current.feelsLike.toFixed(0)}°C</p>
            </div>
            <WeatherIcon code={weather.current.weatherCode} size={56} />
          </div>
          <div className="grid grid-cols-3 gap-2 mt-4">
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
      </div>

      {/* Recommendations */}
      <section className="px-5 mt-5">
        <h2 className="text-lg font-bold text-on-surface mb-3">Farming Recommendations</h2>
        <div className="space-y-2.5">
          {recs.map((r, i) => (
            <div
              key={i}
              className={`rounded-2xl p-4 flex items-start gap-3 ${
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
              <p className="text-sm text-on-surface">{r.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 14-day forecast */}
      <section className="px-5 mt-5">
        <h2 className="text-lg font-bold text-on-surface mb-3">14-Day Forecast</h2>
        <div className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
          {weather.daily.map((d, i) => {
            const date = new Date(d.date);
            const dayName = i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : date.toLocaleDateString('en', { weekday: 'short' });
            return (
              <div key={d.date} className={`flex items-center gap-3 px-4 py-3 ${i !== weather.daily.length - 1 ? 'border-b border-outline-variant/40' : ''}`}>
                <div className="w-16">
                  <p className="text-sm font-medium text-on-surface">{dayName}</p>
                  <p className="text-xs text-outline">{date.toLocaleDateString('en', { month: 'short', day: 'numeric' })}</p>
                </div>
                <WeatherIcon code={d.weatherCode} size={22} />
                <div className="flex-1">
                  <p className="text-xs text-on-surface-variant">{weatherLabel(d.weatherCode)}</p>
                  <p className="text-xs text-outline">
                    <Droplets size={10} className="inline" /> {d.precipitation.toFixed(1)}mm · {d.precipitationProbability.toFixed(0)}%
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-on-surface">{d.tempMax.toFixed(0)}°</p>
                  <p className="text-xs text-outline">{d.tempMin.toFixed(0)}°</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Rainfall zone info */}
      <section className="px-5 mt-5">
        <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
          <h3 className="font-semibold text-on-surface mb-2 flex items-center gap-2">
            <Thermometer size={16} className="text-primary" /> Rainfall Zone
          </h3>
          <p className="text-sm text-on-surface-variant">
            {countyName} is in a <span className="font-semibold">{county.rainfallZone}</span> rainfall zone with ~{county.annualRainfallMm}mm annually.
          </p>
          <p className="text-xs text-outline mt-1">
            Long rains: {county.longRainsStart}–{county.longRainsEnd} · Short rains: {county.shortRainsStart}–{county.shortRainsEnd}
          </p>
        </div>
      </section>
    </div>
  );
}

function Metric({ icon: Icon, label, value }: { icon: typeof Droplets; label: string; value: string }) {
  return (
    <div className="bg-surface-container-high rounded-xl p-2.5 text-center">
      <Icon size={16} className="mx-auto text-outline mb-1" />
      <p className="text-xs text-outline">{label}</p>
      <p className="text-sm font-semibold text-on-surface">{value}</p>
    </div>
  );
}
