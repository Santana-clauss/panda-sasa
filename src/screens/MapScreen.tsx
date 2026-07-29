import { useEffect, useMemo, useState } from 'react';
import { MapPin, CloudRain, Sprout, ChevronRight, X, Droplets, Loader2, Thermometer } from 'lucide-react';
import { COUNTIES, type County } from '@/lib/data';
import { recommendCrops, type CropRanking } from '@/lib/recommendations';
import { fetchClimateStats, type ClimateStats } from '@/lib/climate';

export default function MapScreen() {
  const [selected, setSelected] = useState<County | null>(null);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <header className="bg-gradient-to-r from-primary to-primary-container p-6 md:p-8 rounded-3xl text-on-primary shadow-md">
        <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Kenya Agro-Ecological Zones</h1>
        <p className="text-on-primary/80 text-sm mt-1.5 font-medium">Tap any county to explore live climate data, rainfall windows, and optimal crop varieties</p>
      </header>

      {/* Responsive Grid of Counties */}
      <div>
        <p className="text-sm font-semibold text-on-surface-variant mb-4 px-1">
          Showing {COUNTIES.length} Kenya Counties & Agricultural Zones
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {COUNTIES.map((c) => (
            <button
              key={c.name}
              onClick={() => setSelected(c)}
              className="w-full bg-surface-container-lowest rounded-3xl p-5 shadow-sm border border-outline-variant/50 flex items-center gap-4 text-left hover:border-primary hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-2xl bg-primary-container/20 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
                <MapPin size={22} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-on-surface text-base">{c.name}</p>
                <p className="text-xs text-on-surface-variant font-medium mt-0.5">{c.agroEcologicalZone}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10">{c.rainfallZone}</p>
                <p className="text-[11px] text-outline font-medium mt-1">{c.annualRainfallMm}mm/yr</p>
              </div>
              <ChevronRight size={18} className="text-outline group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      </div>

      {selected && <CountyDrawer county={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

function CountyDrawer({ county, onClose }: { county: County; onClose: () => void }) {
  const rankings = useMemo(() => recommendCrops(county.name), [county.name]);
  const [climate, setClimate] = useState<ClimateStats | null>(null);
  const [climateLoading, setClimateLoading] = useState(false);

  // Fetch live climate data for this county
  useEffect(() => {
    setClimateLoading(true);
    fetchClimateStats(county.latitude, county.longitude, county.name)
      .then(setClimate)
      .catch(() => setClimate(null))
      .finally(() => setClimateLoading(false));
  }, [county.name, county.latitude, county.longitude]);

  const isLive = climate?.source === 'Open-Meteo Climate Archive';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-surface-container-lowest w-full max-w-lg sm:max-w-xl md:max-w-2xl max-h-[85vh] overflow-y-auto rounded-t-3xl sm:rounded-3xl p-6 shadow-2xl animate-slide-up border border-outline-variant/40">
        <div className="w-10 h-1 bg-outline-variant rounded-full mx-auto mb-4" />
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-on-surface">{county.name}</h2>
            <p className="text-sm text-on-surface-variant">{county.region} Region</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-surface-container-high flex items-center justify-center">
            <X size={18} className="text-outline" />
          </button>
        </div>

        {/* Data source badge */}
        <div className="flex items-center gap-2 mb-4">
          {climateLoading ? (
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-outline/10 text-outline flex items-center gap-1">
              <Loader2 size={10} className="animate-spin" /> Loading live climate…
            </span>
          ) : isLive ? (
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
              🟢 Live Climate Data (5-year average)
            </span>
          ) : (
            <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-outline/10 text-outline">
              🟡 Estimated Climate Data
            </span>
          )}
        </div>

        {/* Zone info — with live data overlay */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <InfoBox icon={MapPin} label="Agro-Ecological Zone" value={county.agroEcologicalZone} />
          <InfoBox
            icon={CloudRain}
            label="Annual Rainfall"
            value={climate
              ? `${climate.rainfallZone} (${climate.annualRainfallMm}mm)`
              : `${county.rainfallZone} (${county.annualRainfallMm}mm)`}
            badge={isLive ? 'Live' : undefined}
          />
          <InfoBox
            icon={Droplets}
            label="Long Rains"
            value={climate
              ? `${climate.longRainsStart}–${climate.longRainsEnd}`
              : `${county.longRainsStart}–${county.longRainsEnd}`}
            badge={isLive ? 'Live' : undefined}
          />
          <InfoBox
            icon={Droplets}
            label="Short Rains"
            value={climate
              ? `${climate.shortRainsStart}–${climate.shortRainsEnd}`
              : `${county.shortRainsStart}–${county.shortRainsEnd}`}
            badge={isLive ? 'Live' : undefined}
          />
        </div>

        {/* Live temperature and elevation */}
        {climate && (climate.avgTempMin > 0 || climate.elevation != null) && (
          <div className="grid grid-cols-2 gap-2 mb-4">
            {climate.avgTempMin > 0 && (
              <InfoBox
                icon={Thermometer}
                label="Avg Temperature"
                value={`${climate.avgTempMin.toFixed(0)}–${climate.avgTempMax.toFixed(0)}°C`}
                badge={isLive ? 'Live' : undefined}
              />
            )}
            {climate.elevation != null && (
              <InfoBox
                icon={MapPin}
                label="Elevation"
                value={`${Math.round(climate.elevation)}m above sea level`}
                badge={isLive ? 'Live' : undefined}
              />
            )}
          </div>
        )}

        {/* Monthly rainfall chart (live data) */}
        {climate && isLive && (
          <div className="mb-4">
            <h3 className="text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
              <CloudRain size={15} className="text-primary" /> Monthly Rainfall Pattern
            </h3>
            <div className="flex items-end gap-1 h-24 bg-surface-container-high rounded-xl p-3">
              {climate.monthlyRainfall.map((mm, i) => {
                const maxMm = Math.max(...climate.monthlyRainfall, 1);
                const height = Math.max(4, (mm / maxMm) * 100);
                const months = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
                return (
                  <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                    <div
                      className="w-full bg-primary/70 rounded-t"
                      style={{ height: `${height}%` }}
                      title={`${months[i]}: ${mm.toFixed(0)}mm`}
                    />
                    <span className="text-[8px] text-outline">{months[i]}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Sub-counties */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-on-surface mb-2">Sub-Counties</h3>
          <div className="flex flex-wrap gap-1.5">
            {county.subCounties.map((s) => (
              <span key={s} className="text-xs bg-surface-container-high px-2.5 py-1 rounded-full text-on-surface-variant">
                {s}
              </span>
            ))}
          </div>
        </div>

        {/* Suitable crops */}
        <div>
          <h3 className="text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
            <Sprout size={15} className="text-primary" /> Suitable Crops
          </h3>
          <div className="space-y-2">
            {rankings.slice(0, 6).map((r) => (
              <div key={r.crop.name} className="bg-surface-container-high rounded-xl p-3 flex items-center gap-3">
                <span className="text-2xl">{r.crop.emoji}</span>
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-on-surface">{r.crop.name}</p>
                    <span className="text-xs font-bold text-primary">{r.score}%</span>
                  </div>
                  <p className="text-xs text-on-surface-variant line-clamp-1">{r.reasons[0]}</p>
                  <div className="h-1 bg-surface-container rounded-full mt-1 overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${r.score}%` }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recommended varieties for top crop */}
        {rankings[0] && (
          <div className="mt-4">
            <h3 className="text-sm font-semibold text-on-surface mb-2">
              {rankings[0].crop.name} Varieties
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {rankings[0].crop.varieties.map((v) => (
                <span key={v.name} className="text-xs bg-primary-container/15 text-primary px-2.5 py-1 rounded-full">
                  {v.name} · {v.maturityDays}d
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InfoBox({ icon: Icon, label, value, badge }: { icon: typeof MapPin; label: string; value: string; badge?: string }) {
  return (
    <div className="bg-surface-container-high rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-outline mb-1">
        <Icon size={13} />
        <span className="text-[11px]">{label}</span>
        {badge && (
          <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary ml-auto">
            {badge}
          </span>
        )}
      </div>
      <p className="text-sm font-semibold text-on-surface">{value}</p>
    </div>
  );
}
