import { useMemo, useState } from 'react';
import { MapPin, CloudRain, Sprout, ChevronRight, X, Droplets } from 'lucide-react';
import { COUNTIES, type County } from '@/lib/data';
import { recommendCrops, type CropRanking } from '@/lib/recommendations';

export default function MapScreen() {
  const [selected, setSelected] = useState<County | null>(null);

  return (
    <div className="pb-24">
      <header className="bg-gradient-to-b from-primary to-primary-container px-5 pt-12 pb-6 rounded-b-3xl">
        <h1 className="text-on-primary text-2xl font-bold">Farming Zones</h1>
        <p className="text-on-primary/80 text-sm mt-1">Tap a county to see suitable crops and planting windows</p>
      </header>

      <div className="px-5 mt-5">
        <p className="text-sm text-on-surface-variant mb-3">
          Explore {COUNTIES.length} counties across Kenya. Each shows its agro-ecological zone, rainfall, and recommended crops.
        </p>
        <div className="grid grid-cols-1 gap-2">
          {COUNTIES.map((c) => (
            <button
              key={c.name}
              onClick={() => setSelected(c)}
              className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:shadow-md transition-shadow"
            >
              <div className="w-10 h-10 rounded-full bg-primary-container/15 flex items-center justify-center shrink-0">
                <MapPin size={18} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-on-surface">{c.name}</p>
                <p className="text-xs text-on-surface-variant">{c.agroEcologicalZone}</p>
              </div>
              <div className="text-right">
                <p className="text-xs font-medium text-primary">{c.rainfallZone}</p>
                <p className="text-[11px] text-outline">{c.annualRainfallMm}mm/yr</p>
              </div>
              <ChevronRight size={18} className="text-outline" />
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
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-surface-container-lowest w-full max-w-md max-h-[85vh] overflow-y-auto rounded-t-3xl p-5 pb-8 animate-slide-up">
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

        {/* Zone info */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          <InfoBox icon={MapPin} label="Agro-Ecological Zone" value={county.agroEcologicalZone} />
          <InfoBox icon={CloudRain} label="Rainfall Zone" value={`${county.rainfallZone} (${county.annualRainfallMm}mm)`} />
          <InfoBox icon={Droplets} label="Long Rains" value={`${county.longRainsStart}–${county.longRainsEnd}`} />
          <InfoBox icon={Droplets} label="Short Rains" value={`${county.shortRainsStart}–${county.shortRainsEnd}`} />
        </div>

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

function InfoBox({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="bg-surface-container-high rounded-xl p-3">
      <div className="flex items-center gap-1.5 text-outline mb-1">
        <Icon size={13} />
        <span className="text-[11px]">{label}</span>
      </div>
      <p className="text-sm font-semibold text-on-surface">{value}</p>
    </div>
  );
}
