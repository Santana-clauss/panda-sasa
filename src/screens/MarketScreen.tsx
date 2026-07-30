import { useEffect, useMemo, useState } from 'react';
import {
  ShoppingBag, TrendingUp, TrendingDown, Minus, MapPin, Loader2, Sprout, Info,
  Phone, Clock, Navigation, Package, FlaskConical, Wrench, Droplet,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Season } from '@/lib/supabase';
import { COUNTIES, getCrop } from '@/lib/data';
import {
  fetchMarketOffers,
  fetchCropDemandTrends,
  type MarketOffer,
  type CropDemandTrend,
} from '@/lib/market';

function fmtDate(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function daysUntil(dateStr: string) {
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

type Tab = 'mine' | 'buyers' | 'products' | 'demand';

export default function MarketScreen() {
  const { profile, isGuest, detectedCounty } = useAuth();
  const countyName = profile?.county ?? detectedCounty ?? 'Nakuru';
  const county = COUNTIES.find((c) => c.name === countyName) ?? COUNTIES[0];

  const [tab, setTab] = useState<Tab>('mine');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [offers, setOffers] = useState<MarketOffer[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [demand, setDemand] = useState<CropDemandTrend[]>([]);
  const [demandLoading, setDemandLoading] = useState(true);

  useEffect(() => {
    if (isGuest) {
      setSeasons([]);
      return;
    }
    supabase
      .from('seasons')
      .select('*')
      .eq('status', 'active')
      .then(({ data, error }) => {
        if (error) console.warn('[MarketScreen] seasons query error:', error.message);
        setSeasons((data as Season[]) ?? []);
      });
  }, [isGuest]);

  const myCrops = useMemo(() => Array.from(new Set(seasons.map((s) => s.crop))), [seasons]);
  const myCropsKey = myCrops.join(',');
  const harvestByCrop = useMemo(() => {
    const map: Record<string, string | null> = {};
    seasons.forEach((s) => {
      map[s.crop] = s.expected_harvest ?? null;
    });
    return map;
  }, [seasons]);

  // Offers — "mine" is buyers matching your active crops, "buyers" is all
  // verified crop buyers, "products" is all agriculture product listings.
  // County only affects ordering (nearby first), never exclusion.
  useEffect(() => {
    if (tab === 'demand') return;
    let cancelled = false;
    setOffersLoading(true);

    const params =
      tab === 'mine'
        ? { county: county.name, crops: myCrops, type: 'buyer' as const }
        : tab === 'buyers'
        ? { county: county.name, type: 'buyer' as const }
        : { county: county.name, type: 'supplier' as const };

    fetchMarketOffers(params)
      .then((data) => {
        if (!cancelled) setOffers(data);
      })
      .catch((err) => {
        console.error('[MarketScreen] fetchMarketOffers failed:', err);
        if (!cancelled) setOffers([]);
      })
      .finally(() => {
        if (!cancelled) setOffersLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, county.name, myCropsKey]);

  // Market trends — power their own tab and the demand badges shown on offers
  useEffect(() => {
    let cancelled = false;
    setDemandLoading(true);
    fetchCropDemandTrends(county.name)
      .then((data) => {
        if (!cancelled) setDemand(data);
      })
      .catch((err) => {
        console.error('[MarketScreen] fetchCropDemandTrends failed:', err);
        if (!cancelled) setDemand([]);
      })
      .finally(() => {
        if (!cancelled) setDemandLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [county.name]);

  function demandFor(crop: string) {
    return demand.find((d) => d.crop.toLowerCase() === crop.toLowerCase());
  }

  return (
    <div className="space-y-6">
      <header className="bg-gradient-to-r from-primary to-primary-container p-6 md:p-8 rounded-3xl text-on-primary shadow-md">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Smart Companion Marketplace</h1>
            <p className="text-on-primary/80 text-sm mt-1.5 font-medium">
              Buyers, agriculture products, and real market prices — matched to your farm.
            </p>
          </div>
          <div className="rounded-3xl bg-white/15 px-4 py-2 text-xs font-semibold flex items-center gap-1.5">
            <MapPin size={14} /> {county.name}
          </div>
        </div>
      </header>

      <div className="bg-surface-container-high/60 p-1.5 rounded-2xl border border-outline-variant/40 max-w-2xl">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
          {([
            ['mine', 'My Crops'],
            ['buyers', 'All Buyers'],
            ['products', 'Agriculture Products'],
            ['demand', 'Market Trends'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`py-2.5 px-3 rounded-xl text-xs md:text-sm font-bold transition-all ${
                tab === k ? 'bg-primary text-on-primary shadow-sm' : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {tab !== 'demand' ? (
        <OffersPanel tab={tab} offers={offers} loading={offersLoading} myCrops={myCrops} demandFor={demandFor} />
      ) : (
        <DemandPanel demand={demand} loading={demandLoading} myCrops={myCrops} harvestByCrop={harvestByCrop} />
      )}
    </div>
  );
}

function DemandBadge({ trend }: { trend: CropDemandTrend | undefined }) {
  if (!trend) return null;
  const meta = {
    rising: { icon: TrendingUp, label: 'Rising demand', cls: 'bg-primary/10 text-primary' },
    high: { icon: TrendingUp, label: 'High demand', cls: 'bg-primary/10 text-primary' },
    stable: { icon: Minus, label: 'Stable demand', cls: 'bg-outline/10 text-outline' },
    falling: { icon: TrendingDown, label: 'Falling demand', cls: 'bg-error/10 text-error' },
  }[trend.demand];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full ${meta.cls}`}>
      <Icon size={12} /> {meta.label}
    </span>
  );
}

const GUIDANCE_META = {
  sell: { label: 'Good time to sell', cls: 'bg-primary/10 text-primary border-primary/30' },
  hold: { label: 'Maybe wait to sell', cls: 'bg-tertiary/10 text-tertiary border-tertiary/30' },
  watch: { label: 'Prices steady', cls: 'bg-outline/10 text-outline border-outline/30' },
  unknown: { label: 'Not enough info yet', cls: 'bg-outline/10 text-outline border-outline/30' },
} as const;

function GuidancePill({ trend }: { trend: CropDemandTrend }) {
  const meta = GUIDANCE_META[trend.guidance];
  return (
    <span className={`inline-block text-[11px] font-bold px-2.5 py-1 rounded-full border ${meta.cls}`}>
      {meta.label}
    </span>
  );
}

function DeadlinePill({ deadline }: { deadline: string }) {
  const days = daysUntil(deadline);
  if (days < 0) return null;
  const urgent = days <= 3;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-full ${
        urgent ? 'bg-error/10 text-error' : 'bg-outline/10 text-outline'
      }`}
    >
      <Clock size={11} /> {days === 0 ? 'Closes today' : `${days}d left`}
    </span>
  );
}

const SUPPLIER_CATEGORY_META: Record<string, { label: string; icon: typeof Package }> = {
  'seed supplier': { label: 'Seeds', icon: Sprout },
  fertilizer: { label: 'Fertilizer', icon: Package },
  agrochemical: { label: 'Agrochemical', icon: FlaskConical },
  equipment: { label: 'Equipment', icon: Wrench },
  irrigation: { label: 'Irrigation', icon: Droplet },
};

function CategoryBadge({ category }: { category: MarketOffer['category'] }) {
  if (category === 'buyer') return null;
  const meta = SUPPLIER_CATEGORY_META[category];
  if (!meta) return null;
  const Icon = meta.icon;
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full bg-tertiary/10 text-tertiary">
      <Icon size={12} /> {meta.label}
    </span>
  );
}

function OffersPanel({
  tab, offers, loading, myCrops, demandFor,
}: {
  tab: Tab;
  offers: MarketOffer[];
  loading: boolean;
  myCrops: string[];
  demandFor: (crop: string) => CropDemandTrend | undefined;
}) {
  if (loading) {
    return (
      <div className="py-10 flex flex-col items-center justify-center gap-3">
        <Loader2 size={22} className="text-primary animate-spin" />
        <p className="text-xs text-on-surface-variant">
          {tab === 'products' ? 'Loading agriculture products…' : 'Loading buyer leads…'}
        </p>
      </div>
    );
  }

  if (tab === 'mine' && myCrops.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-3xl p-6 text-center border border-outline-variant/50">
        <Sprout size={26} className="mx-auto text-primary mb-2" />
        <p className="text-sm font-medium text-on-surface">You don't have an active crop yet</p>
        <p className="text-xs text-on-surface-variant mt-1">
          Plan a season from the Advisor tab, or check All Buyers / Agriculture Products for options near you.
        </p>
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-3xl p-6 text-center border border-outline-variant/50">
        <ShoppingBag size={26} className="mx-auto text-outline mb-2" />
        <p className="text-sm text-on-surface-variant">
          {tab === 'mine' && 'No current buyer leads for your crops in this region.'}
          {tab === 'buyers' && 'No buyer leads available right now.'}
          {tab === 'products' && 'No agriculture products available right now.'}
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {offers.map((op) => {
        const isProduct = op.type === 'supplier';
        return (
          <div key={op.id} className="rounded-3xl border border-outline-variant/40 p-4 bg-surface-container-lowest">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm text-on-surface-variant">{isProduct ? 'Agriculture Product' : 'Buyer'}</p>
                <p className="font-semibold text-on-surface text-lg">{op.name}</p>
                <p className="text-xs text-on-surface-variant flex items-center gap-1 mt-0.5">
                  <Navigation size={11} /> {op.location}
                  {op.distanceKm != null && ` · ${op.distanceKm} km away`}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="text-[11px] font-semibold uppercase tracking-[0.2em] bg-primary/10 text-primary px-3 py-1 rounded-full">
                  {op.verified ? 'Verified' : 'New'}
                </span>
                {op.deadline && <DeadlinePill deadline={op.deadline} />}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-3 flex-wrap">
              <span className="text-sm font-semibold text-on-surface">{op.product}</span>
              <CategoryBadge category={op.category} />
              {!isProduct && <DemandBadge trend={demandFor(op.product)} />}
            </div>

            <p className="text-xs text-on-surface-variant mt-1.5">{op.description}</p>

            {op.price != null && (
              <div className="mt-2 flex items-baseline gap-1.5">
                <span className="text-lg font-bold text-on-surface">
                  {op.currency} {op.price.toLocaleString()}
                </span>
                {op.unit && <span className="text-xs text-on-surface-variant">per {op.unit}</span>}
              </div>
            )}

            {(op.needed || op.period) && (
              <div className="grid grid-cols-2 gap-3 mt-3 text-sm text-on-surface-variant">
                {op.needed && (
                  <div>
                    <p className="font-semibold text-on-surface">Needed</p>
                    <p>{op.needed}</p>
                  </div>
                )}
                {op.period && (
                  <div>
                    <p className="font-semibold text-on-surface">Period</p>
                    <p>{op.period}</p>
                  </div>
                )}
              </div>
            )}

            {op.tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {op.tags.map((tag) => (
                  <span key={tag} className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-outline/10 text-on-surface-variant">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-outline-variant/30">
              <div className="text-xs text-on-surface-variant">
                <p className="font-semibold text-on-surface">{op.contactPerson}</p>
                <p className="flex items-center gap-1"><Phone size={11} /> {op.contactPhone}</p>
              </div>
              <span className="text-[11px] text-on-surface-variant">Posted {fmtDate(op.postedAt)}</span>
            </div>

            <button className="mt-4 w-full rounded-2xl bg-primary text-on-primary py-3 text-sm font-semibold hover:bg-primary/90 transition-colors">
              {isProduct ? 'View Product' : 'View Offer'}
            </button>
          </div>
        );
      })}
    </div>
  );
}

function DemandPanel({
  demand, loading, myCrops, harvestByCrop,
}: {
  demand: CropDemandTrend[];
  loading: boolean;
  myCrops: string[];
  harvestByCrop: Record<string, string | null>;
}) {
  if (loading) {
    return (
      <div className="py-10 flex flex-col items-center justify-center gap-3">
        <Loader2 size={22} className="text-primary animate-spin" />
        <p className="text-xs text-on-surface-variant">Checking current market trends…</p>
      </div>
    );
  }

  if (demand.length === 0) {
    return (
      <div className="bg-surface-container-lowest rounded-3xl p-6 text-center border border-outline-variant/50">
        <p className="text-sm text-on-surface-variant">Market trend data is temporarily unavailable.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="bg-surface-container-high/40 rounded-2xl p-4 flex items-start gap-2.5 border border-outline-variant/30">
        <Info size={16} className="text-primary mt-0.5 shrink-0" />
        <p className="text-xs text-on-surface-variant leading-relaxed">
          These prices come from a Kenya market survey, checked about once a month — not live, but real. This is
          information to help you decide, not advice — always check with buyers near you too.
        </p>
      </div>

      {demand.map((d) => {
        const isMine = myCrops.some((c) => c.toLowerCase() === d.crop.toLowerCase());
        const harvest = harvestByCrop[d.crop] ? fmtDate(harvestByCrop[d.crop]) : null;
        return (
          <div
            key={d.crop}
            className={`rounded-3xl p-4 border ${isMine ? 'border-primary/40 bg-primary/5' : 'border-outline-variant/40 bg-surface-container-lowest'}`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-2xl shrink-0">{getCrop(d.crop)?.emoji ?? '🌾'}</span>
                <div className="min-w-0">
                  <p className="font-semibold text-on-surface truncate">{d.crop}</p>
                  {isMine && harvest && <p className="text-xs text-on-surface-variant">Your harvest expected {harvest}</p>}
                </div>
              </div>
              <DemandBadge trend={d} />
            </div>

            {d.currentPrice != null && (
              <div className="mt-3 flex items-baseline gap-2 flex-wrap">
                <span className="text-xl font-bold text-on-surface">
                  {d.currency} {d.currentPrice.toLocaleString()}
                </span>
                <span className="text-xs text-on-surface-variant">per {d.unit}</span>
              </div>
            )}

            <p className="text-sm text-on-surface mt-2 leading-relaxed">{d.explanation}</p>

            <div className="flex items-center justify-between gap-3 mt-3 pt-3 border-t border-outline-variant/30">
              <GuidancePill trend={d} />
              {d.asOf && <span className="text-[11px] text-on-surface-variant">Checked {fmtDate(d.asOf)}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}