import { useEffect, useMemo, useState } from 'react';
import {
  Sprout, MapPin, Calendar, ChevronDown, ChevronRight, Check, Clock,
  TrendingUp, Info, Plus, ListChecks, Wheat, AlertCircle, LocateFixed, Loader2,
  CircleDot, Leaf, Droplets, Bug, Scissors, Package, Eye, Layers, Mountain,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Season, type Activity } from '@/lib/supabase';
import { COUNTIES, CROPS, getCrop, type CropInfo } from '@/lib/data';
import {
  analyzePlanting, recommendCrops, calcGrowthStatus,
  generateActivities, recommendPlantingDate, type PlantingDecision, type CropRanking,
} from '@/lib/recommendations';
import { fetchWeather } from '@/lib/weather';
import { detectLocation } from '@/lib/location';
import { fetchSoilData, soilRecommendationsForCrop, type SoilData, type SoilRecommendation } from '@/lib/soil';

type View = 'guidance' | 'plan' | 'crops' | 'seasons';

export default function AdvisorScreen() {
  const { profile, isGuest, detectedCounty } = useAuth();
  const [view, setView] = useState<View>('guidance');
  const [seasons, setSeasons] = useState<Season[]>([]);

  const county = profile?.county ?? detectedCounty ?? 'Nakuru';

  async function loadSeasons() {
    if (isGuest) {
      setSeasons([]);
      return;
    }
    const { data } = await supabase
      .from('seasons')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });
    setSeasons((data as Season[]) ?? []);
  }

  useEffect(() => {
    loadSeasons();
  }, [isGuest]);

  // Auto-switch: if there's an active season, show guidance; otherwise show plan.
  useEffect(() => {
    if (seasons.length > 0 && view === 'plan') {
      setView('guidance');
    }
    if (seasons.length === 0 && view === 'guidance') {
      setView('plan');
    }
  }, [seasons.length]);

  return (
    <div className="pb-24">
      <header className="bg-gradient-to-b from-primary to-primary-container px-5 pt-12 pb-6 rounded-b-3xl">
        <h1 className="text-on-primary text-2xl font-bold">Smart Farm Guidance</h1>
        <p className="text-on-primary/80 text-sm mt-1">
          {seasons.length > 0
            ? 'Your seasonal guide — week by week'
            : 'Plan your planting, then get ongoing guidance'}
        </p>
      </header>

      {/* Tab switcher */}
      <div className="px-5 mt-4">
        <div className="flex bg-surface-container-high rounded-full p-1">
          {([
            ['guidance', 'Guidance'],
            ['plan', 'Plan'],
            ['crops', 'Crop Picks'],
            ['seasons', 'My Seasons'],
          ] as const).map(([k, label]) => {
            const disabled = k === 'guidance' && seasons.length === 0;
            return (
              <button
                key={k}
                onClick={() => !disabled && setView(k)}
                disabled={disabled}
                className={`flex-1 py-2 rounded-full text-xs font-semibold transition-all ${
                  view === k ? 'bg-primary text-on-primary shadow' : disabled ? 'text-outline/40' : 'text-on-surface-variant'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-5 mt-5">
        {view === 'guidance' && seasons.length > 0 && (
          <GuidanceTimeline seasons={seasons} onUpdated={loadSeasons} />
        )}
        {view === 'plan' && <PlantingForm county={county} onSaved={loadSeasons} />}
        {view === 'crops' && <CropPicks county={county} />}
        {view === 'seasons' && (
          <SeasonsList
            seasons={seasons}
            isGuest={isGuest}
            onOpen={(id) => {
              setView('guidance');
            }}
            onNew={() => setView('plan')}
          />
        )}
      </div>
    </div>
  );
}

/* ---------- Guidance Timeline (the core seasonal guide) ---------- */

const CATEGORY_META: Record<string, { icon: typeof Leaf; color: string; bg: string }> = {
  monitoring: { icon: Eye, color: 'text-primary', bg: 'bg-primary-container/15' },
  weeding: { icon: Sprout, color: 'text-tertiary', bg: 'bg-tertiary-fixed/40' },
  fertilizer: { icon: Droplets, color: 'text-primary', bg: 'bg-primary-container/15' },
  pest: { icon: Bug, color: 'text-error', bg: 'bg-error-container/40' },
  harvest: { icon: Package, color: 'text-tertiary', bg: 'bg-tertiary-fixed/40' },
};

function GuidanceTimeline({ seasons, onUpdated }: { seasons: Season[]; onUpdated: () => void }) {
  const [activeSeasonId, setActiveSeasonId] = useState(seasons[0]?.id ?? '');
  const [activities, setActivities] = useState<Activity[]>([]);
  const [soilData, setSoilData] = useState<SoilData | null>(null);

  const season = seasons.find((s) => s.id === activeSeasonId) ?? seasons[0];
  const cropInfo = getCrop(season?.crop ?? '');
  const growth = season ? calcGrowthStatus(season.planting_date, season.crop, season.variety ?? undefined) : null;

  async function loadActivities() {
    if (!season) return;
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('season_id', season.id)
      .order('week_number', { ascending: true });
    setActivities((data as Activity[]) ?? []);
  }

  useEffect(() => {
    loadActivities();
  }, [season?.id]);

  // Fetch soil data for the season's county
  useEffect(() => {
    if (!season) return;
    const countyInfo = COUNTIES.find((c) => c.name === season.county);
    if (!countyInfo) return;
    fetchSoilData(countyInfo.latitude, countyInfo.longitude).then(setSoilData).catch(() => {});
  }, [season?.id]);

  async function toggleActivity(act: Activity) {
    const completed = !act.completed;
    await supabase
      .from('activities')
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq('id', act.id);
    loadActivities();
  }

  if (!season || !growth || !cropInfo) return null;

  // Determine current week number
  const currentWeek = Math.floor(growth.daysAfterPlanting / 7) + 1;
  const totalWeeks = Math.ceil((cropInfo.maturityDays) / 7);

  // Find current and next activities
  const currentActivity = activities.find((a) => a.week_number === currentWeek);
  const upcomingActivities = activities.filter((a) => a.week_number > currentWeek && !a.completed);
  const pastActivities = activities.filter((a) => a.week_number < currentWeek);
  const completedCount = activities.filter((a) => a.completed).length;

  return (
    <div className="space-y-4">
      {/* Season selector if multiple */}
      {seasons.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {seasons.map((s) => {
            const ci = getCrop(s.crop);
            return (
              <button
                key={s.id}
                onClick={() => setActiveSeasonId(s.id)}
                className={`shrink-0 flex items-center gap-2 px-3 py-2 rounded-full text-sm font-medium transition-colors ${
                  s.id === season.id ? 'bg-primary text-on-primary' : 'bg-surface-container-high text-on-surface-variant'
                }`}
              >
                <span>{ci?.emoji ?? '🌱'}</span>
                {s.crop}
              </button>
            );
          })}
        </div>
      )}

      {/* Hero: current growth stage */}
      <div className="bg-gradient-to-br from-primary to-primary-container rounded-2xl p-5 text-on-primary shadow-md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-4xl">{cropInfo.emoji}</span>
            <div>
              <p className="font-bold text-lg">{season.crop}</p>
              <p className="text-xs text-on-primary/80">{season.variety ?? 'Standard variety'}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-bold">{growth.daysAfterPlanting}</p>
            <p className="text-xs text-on-primary/70">days planted</p>
          </div>
        </div>
        <div className="bg-white/15 rounded-xl px-3 py-2.5">
          <p className="text-sm font-semibold">Current Stage: {growth.currentStage}</p>
          <p className="text-xs text-on-primary/80 mt-0.5">{growth.stageDescription}</p>
        </div>
        <div className="flex items-center justify-between mt-3 text-xs">
          <span>Week {currentWeek} of {totalWeeks}</span>
          <span className="flex items-center gap-1"><Clock size={12} /> {growth.remainingDays}d to harvest</span>
        </div>
        <div className="h-2 bg-white/20 rounded-full overflow-hidden mt-1.5">
          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${growth.progressPercent}%` }} />
        </div>
      </div>

      {/* This Week's Task (hero card) */}
      {currentActivity && (
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CircleDot size={16} className="text-primary animate-pulse" />
            <h3 className="font-semibold text-on-surface">This Week's Task</h3>
            <span className="ml-auto text-xs text-outline">Week {currentActivity.week_number}</span>
          </div>
          <div className={`rounded-xl p-4 ${currentActivity.completed ? 'bg-primary-container/10' : CATEGORY_META[currentActivity.category ?? '']?.bg ?? 'bg-surface-container-high'}`}>
            <div className="flex items-start gap-3">
              {(() => {
                const Meta = CATEGORY_META[currentActivity.category ?? ''];
                const Icon = Meta?.icon ?? Leaf;
                return <Icon size={22} className={`${Meta?.color ?? 'text-primary'} shrink-0 mt-0.5`} />;
              })()}
              <div className="flex-1">
                <p className="font-semibold text-on-surface">{currentActivity.title}</p>
                <p className="text-sm text-on-surface-variant mt-0.5">{currentActivity.description}</p>
                <div className="flex items-center justify-between mt-3">
                  <span className={`text-xs ${currentActivity.completed ? 'text-primary' : 'text-outline'}`}>
                    {currentActivity.completed ? 'Completed' : `Due ${currentActivity.due_date}`}
                  </span>
                  <button
                    onClick={() => toggleActivity(currentActivity)}
                    className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      currentActivity.completed
                        ? 'bg-surface-container-high text-on-surface-variant'
                        : 'bg-primary text-on-primary'
                    }`}
                  >
                    {currentActivity.completed ? <><Check size={13} /> Done</> : 'Mark Done'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stage context */}
      <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
          <Info size={14} className="text-primary" /> Stage Guidance
        </h3>
        <p className="text-xs text-on-surface-variant leading-relaxed">
          Your {season.crop} is in the <span className="font-semibold text-on-surface">{growth.currentStage}</span> stage
          (day {growth.daysAfterPlanting} of {cropInfo.varieties.find(v => v.name === season.variety)?.maturityDays ?? cropInfo.maturityDays}).
          {stageGuidance(cropInfo, growth.currentStage)}
        </p>
      </div>

      {/* Soil context from ISRIC SoilGrids */}
      {soilData && <SoilCard soil={soilData} crop={season.crop} />}

      {/* Full week-by-week timeline */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
          <ListChecks size={18} className="text-primary" /> Season Timeline
        </h3>
        <div className="space-y-1">
          {activities.map((a, i) => {
            const isCurrent = a.week_number === currentWeek;
            const isPast = a.week_number < currentWeek;
            const isFuture = a.week_number > currentWeek;
            const Meta = CATEGORY_META[a.category ?? ''];
            const Icon = Meta?.icon ?? Leaf;
            const due = new Date(a.due_date ?? '');
            const overdue = !a.completed && due < new Date();

            return (
              <div key={a.id} className="relative">
                {/* Vertical line */}
                {i < activities.length - 1 && (
                  <div className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-outline-variant/50" />
                )}
                <button
                  onClick={() => toggleActivity(a)}
                  className={`relative w-full flex items-start gap-3 p-2.5 rounded-xl text-left transition-colors ${
                    isCurrent ? 'bg-primary-container/15 ring-1 ring-primary/20' : ''
                  } ${a.completed ? 'opacity-60' : ''}`}
                >
                  {/* Timeline dot */}
                  <div className={`w-8 h-8 rounded-full shrink-0 flex items-center justify-center z-10 ${
                    a.completed ? 'bg-primary' : isCurrent ? 'bg-primary ring-4 ring-primary/20' : isPast ? 'bg-error' : 'bg-surface-container-high border border-outline-variant'
                  }`}>
                    {a.completed ? <Check size={14} className="text-on-primary" /> : <Icon size={14} className={isCurrent ? 'text-on-primary' : isPast ? 'text-on-error' : 'text-outline'} />}
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-sm font-medium ${a.completed ? 'text-outline line-through' : 'text-on-surface'}`}>
                        Week {a.week_number}: {a.title}
                      </p>
                      {isCurrent && !a.completed && (
                        <span className="text-[10px] font-bold text-primary bg-primary-container/20 px-1.5 py-0.5 rounded-full shrink-0">NOW</span>
                      )}
                    </div>
                    <p className="text-xs text-on-surface-variant mt-0.5">{a.description}</p>
                    <p className={`text-[11px] mt-0.5 ${overdue ? 'text-error' : 'text-outline'}`}>
                      {a.due_date} · {a.category}
                      {a.completed && ' · ✓ done'}
                    </p>
                  </div>
                </button>
              </div>
            );
          })}
        </div>
        {/* Progress summary */}
        <div className="mt-3 pt-3 border-t border-outline-variant/40 flex items-center justify-between text-xs text-on-surface-variant">
          <span>{completedCount} of {activities.length} tasks done</span>
          <span>{((completedCount / activities.length) * 100).toFixed(0)}% complete</span>
        </div>
      </div>

      {/* Growth stages reference */}
      <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
        <h3 className="font-semibold text-on-surface mb-3">Growth Stages</h3>
        <div className="space-y-2">
          {cropInfo.stages.map((s) => {
            const isCurrent = growth.daysAfterPlanting >= s.startDay && growth.daysAfterPlanting <= s.endDay;
            const isPast = growth.daysAfterPlanting > s.endDay;
            return (
              <div key={s.name} className={`flex items-start gap-3 p-2 rounded-lg ${isCurrent ? 'bg-primary-container/15' : ''}`}>
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${isPast ? 'bg-primary' : isCurrent ? 'bg-primary ring-4 ring-primary/20' : 'bg-outline-variant'}`} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${isCurrent ? 'text-primary' : 'text-on-surface'}`}>{s.name}</p>
                  <p className="text-xs text-on-surface-variant">Day {s.startDay}–{s.endDay}</p>
                  <p className="text-xs text-outline mt-0.5">{s.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Stage-specific guidance text
function stageGuidance(crop: CropInfo, stageName: string): string {
  const stage = crop.stages.find((s) => s.name === stageName);
  if (!stage) return '';
  const guidance: Record<string, string> = {
    Germination: ' Ensure soil moisture is adequate for uniform emergence. Replant any gaps within the first week.',
    Seedling: ' Watch for pest damage on young plants. Keep the field weed-free to reduce competition.',
    Vegetative: ' This is the rapid growth phase — top-dress fertilizer now and monitor for weeds and pests.',
    Tasseling: ' Critical period for moisture. Ensure adequate water and watch for stem lodging.',
    Silking: ' Pollination is happening — avoid pesticide sprays that could harm pollinators.',
    'Grain filling': ' Kernels are developing — protect from birds and pests. Avoid water stress.',
    'Physiological maturity': ' Black layer is forming. Prepare harvesting equipment and drying facilities.',
    Flowering: ' Avoid spraying during peak flowering to protect pollinators. Monitor for disease.',
    'Pod fill': ' Pods are filling — ensure adequate moisture and scout for pod borers.',
    Maturity: ' Ready to harvest. Plan harvesting, drying, and storage.',
    'Tuber initiation': ' Tubers are starting to form — hill up soil and maintain moisture.',
    'Tuber bulking': ' Tubers are enlarging — maintain consistent moisture and scout for weevils.',
    Establishment: ' Ensure good soil contact and moisture. Replace any failed plants within 2 weeks.',
    'Vine growth': ' Vines are spreading — manage weeds and monitor for diseases.',
  };
  return guidance[stageName] ?? '';
}

/* ---------- Planting Form + Result ---------- */

function PlantingForm({ county, onSaved }: { county: string; onSaved: () => void }) {
  const [selectedCounty, setSelectedCounty] = useState(county);
  const [subCounty, setSubCounty] = useState('');
  const [crop, setCrop] = useState('Maize');
  const [variety, setVariety] = useState('');
  const [result, setResult] = useState<PlantingDecision | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [locMsg, setLocMsg] = useState<string | null>(null);
  const [soilData, setSoilData] = useState<SoilData | null>(null);
  const [soilLoading, setSoilLoading] = useState(false);

  const countyInfo = useMemo(() => COUNTIES.find((c) => c.name === selectedCounty), [selectedCounty]);
  const cropInfo = useMemo(() => getCrop(crop), [crop]);

  const dateRec = useMemo(() => recommendPlantingDate(selectedCounty), [selectedCounty]);

  async function useMyLocation() {
    setLocating(true);
    setLocMsg(null);
    try {
      const loc = await detectLocation();
      setSelectedCounty(loc.county.name);
      setLocMsg(`Located: ${loc.county.name} (±${Math.round(loc.accuracyMeters ?? 0)}m)`);
    } catch (e) {
      setLocMsg(e instanceof Error ? e.message : 'Could not detect location.');
    } finally {
      setLocating(false);
    }
  }

  async function analyze() {
    setAnalyzing(true);
    setSaveMsg(null);
    let rainfallForecast: number | undefined;
    let soil: SoilData | undefined;
    if (countyInfo) {
      try {
        const [w, s] = await Promise.all([
          fetchWeather(countyInfo.latitude, countyInfo.longitude),
          fetchSoilData(countyInfo.latitude, countyInfo.longitude),
        ]);
        rainfallForecast = w.daily.slice(0, 14).reduce((sum, d) => sum + d.precipitation, 0);
        soil = s;
        setSoilData(s);
      } catch {
        // ignore fetch failure
      }
    }
    const decision = analyzePlanting({
      county: selectedCounty,
      subCounty,
      crop,
      plantingDate: dateRec.startDate,
      variety: variety || undefined,
      rainfallForecast,
      soil,
    });
    setResult(decision);
    setAnalyzing(false);
  }

  async function saveSeason() {
    if (!result) return;
    setSaveMsg(null);
    const { data, error } = await supabase
      .from('seasons')
      .insert({
        crop,
        variety: result.recommendedVariety,
        county: selectedCounty,
        sub_county: subCounty || null,
        planting_date: dateRec.startDate,
        expected_harvest: result.estimatedHarvestDate,
        status: 'active',
      })
      .select()
      .single();
    if (error) {
      setSaveMsg(`Error: ${error.message}`);
      return;
    }
    const acts = generateActivities(dateRec.startDate, crop);
    if (data && acts.length) {
      await supabase.from('activities').insert(
        acts.map((a) => ({
          season_id: data.id,
          week_number: a.week,
          title: a.title,
          description: a.description,
          category: a.category,
          due_date: a.dueDate,
        }))
      );
    }
    setSaveMsg('Season saved! Your guidance timeline is ready.');
    onSaved();
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-on-surface flex items-center gap-2">
          <Sprout size={18} className="text-primary" /> Plan Your Planting
        </h3>

        <div>
          <SelectField icon={MapPin} label="County" value={selectedCounty} onChange={setSelectedCounty} options={COUNTIES.map((c) => c.name)} />
          <button
            onClick={useMyLocation}
            disabled={locating}
            className="mt-2 flex items-center gap-1.5 text-sm text-primary font-medium hover:text-primary-container disabled:opacity-60"
          >
            {locating ? <Loader2 size={15} className="animate-spin" /> : <LocateFixed size={15} />}
            {locating ? 'Detecting…' : 'Use my current location'}
          </button>
          {locMsg && <p className="text-xs text-outline mt-1.5">{locMsg}</p>}
        </div>
        {countyInfo && (
          <SelectField
            icon={MapPin}
            label="Sub-county"
            value={subCounty}
            onChange={setSubCounty}
            options={['', ...countyInfo.subCounties]}
            placeholder="Select sub-county"
          />
        )}

        <SelectField icon={Wheat} label="Crop" value={crop} onChange={(v) => { setCrop(v); setVariety(''); }} options={CROPS.map((c) => c.name)} />

        {cropInfo && (
          <SelectField
            icon={Sprout}
            label="Variety (optional)"
            value={variety}
            onChange={setVariety}
            options={['', ...cropInfo.varieties.map((v) => v.name)]}
            placeholder="Let advisor recommend"
          />
        )}

        {/* Recommended planting window */}
        <div>
          <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">Recommended Planting Window</label>
          <div className="bg-primary-container/15 rounded-xl px-4 py-3.5 border border-primary/20">
            <div className="flex items-center gap-3 mb-2">
              <Calendar size={18} className="text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-on-surface">
                  {new Date(dateRec.startDate).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                  {' – '}
                  {new Date(dateRec.endDate).toLocaleDateString('en', { weekday: 'short', month: 'short', day: 'numeric' })}
                </p>
              </div>
              <span className="text-xs font-bold text-primary bg-primary-container/20 px-2 py-1 rounded-full shrink-0">
                {dateRec.season === 'LR' ? 'Long Rains' : 'Short Rains'}
              </span>
            </div>
            <p className="text-xs text-on-surface-variant">{dateRec.reason}</p>
          </div>
        </div>

        <button
          onClick={analyze}
          disabled={analyzing}
          className="w-full bg-primary text-on-primary font-semibold py-3 rounded-full hover:bg-primary-container transition-colors disabled:opacity-60"
        >
          {analyzing ? 'Analyzing rainfall & calendar…' : 'Analyze & Recommend'}
        </button>
      </div>

      {result && (
        <ResultCard decision={result} crop={crop} onSave={saveSeason} saveMsg={saveMsg} soilData={soilData} />
      )}
    </div>
  );
}

function ResultCard({
  decision, crop, onSave, saveMsg, soilData,
}: {
  decision: PlantingDecision;
  crop: string;
  onSave: () => void;
  saveMsg: string | null;
  soilData: SoilData | null;
}) {
  const verdictColor =
    decision.verdict === 'Plant Now'
      ? 'bg-primary text-on-primary'
      : decision.verdict === 'Wait'
      ? 'bg-tertiary text-on-tertiary'
      : 'bg-error text-on-error';

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <span className={`px-4 py-1.5 rounded-full text-sm font-bold ${verdictColor}`}>
          {decision.verdict}
        </span>
        <span className="text-xs text-outline">Confidence {decision.confidence}%</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <InfoTile icon={Calendar} label="Planting Window" value={decision.plantingWindow.label} />
        <InfoTile icon={Sprout} label="Recommended Variety" value={decision.recommendedVariety || '—'} />
        <InfoTile icon={Clock} label="Harvest Date" value={decision.estimatedHarvestDate || '—'} />
        <InfoTile icon={TrendingUp} label="Days to Harvest" value={decision.daysToHarvest > 0 ? `${decision.daysToHarvest} days` : 'Ready'} />
      </div>

      <div>
        <h4 className="text-sm font-semibold text-on-surface mb-2 flex items-center gap-1.5">
          <Info size={15} className="text-primary" /> Why this recommendation
        </h4>
        <ul className="space-y-1.5">
          {decision.explanation.map((e, i) => (
            <li key={i} className="text-xs text-on-surface-variant flex gap-2">
              <span className="text-primary shrink-0">•</span> {e}
            </li>
          ))}
        </ul>
      </div>

      {/* Soil analysis from ISRIC SoilGrids */}
      {soilData && <SoilCard soil={soilData} crop={crop} />}

      <button
        onClick={onSave}
        className="w-full bg-primary-container text-on-primary font-semibold py-3 rounded-full hover:bg-primary transition-colors"
      >
        Save & Start Guidance
      </button>
      {saveMsg && (
        <p className={`text-sm text-center ${saveMsg.startsWith('Error') ? 'text-error' : 'text-primary'}`}>{saveMsg}</p>
      )}
    </div>
  );
}

/* ---------- Soil Card (ISRIC SoilGrids data) ---------- */

function SoilCard({ soil, crop }: { soil: SoilData; crop: string }) {
  const [expanded, setExpanded] = useState(false);
  const recs = useMemo(() => soilRecommendationsForCrop(soil, crop), [soil, crop]);

  const phColor = soil.ph < 5.5 ? 'text-error' : soil.ph > 7.5 ? 'text-error' : 'text-primary';
  const phLabel = soil.ph < 5.5 ? 'Acidic' : soil.ph > 7.5 ? 'Alkaline' : 'Optimal';

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-on-surface flex items-center gap-1.5">
          <Layers size={15} className="text-primary" /> Soil Analysis
        </h4>
        <span className="text-[10px] text-outline bg-surface-container-high px-2 py-0.5 rounded-full">{soil.source}</span>
      </div>

      {/* Soil type + drainage summary */}
      <div className="flex items-center gap-3 bg-surface-container-high rounded-xl p-3">
        <div className="w-10 h-10 rounded-full bg-primary-container/20 flex items-center justify-center shrink-0">
          <Mountain size={20} className="text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-on-surface">{soil.soilType}</p>
          <p className="text-xs text-on-surface-variant">{soil.drainage}</p>
        </div>
      </div>

      {/* Key metrics grid */}
      <div className="grid grid-cols-3 gap-2">
        <SoilMetric label="pH" value={soil.ph.toFixed(1)} tone={phColor} sub={phLabel} />
        <SoilMetric label="Org. Carbon" value={`${soil.organicCarbon.toFixed(1)}`} unit="g/kg" />
        <SoilMetric label="Nitrogen" value={soil.nitrogen.toFixed(1)} unit="cg/kg" />
        <SoilMetric label="Phosphorus" value={soil.phosphorus.toFixed(1)} unit="mg/kg" />
        <SoilMetric label="Potassium" value={soil.potassium.toFixed(2)} unit="cmolc/kg" />
        <SoilMetric label="Water Cap." value={`${soil.waterHoldingCapacity}`} unit="mm/m" />
      </div>

      {/* Texture breakdown */}
      <div className="flex items-center gap-2 text-xs text-on-surface-variant">
        <span className="font-medium">Texture:</span>
        <span>Clay {soil.clayContent}%</span>
        <span>Sand {soil.sandContent}%</span>
        <span>Silt {soil.siltContent}%</span>
      </div>

      {/* Toggle detailed view */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="text-xs text-primary font-medium flex items-center gap-1"
      >
        {expanded ? 'Hide' : 'Show'} soil recommendations
        {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
      </button>

      {expanded && recs.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {recs.map((r, i) => (
            <div key={i} className="flex items-start gap-2 text-xs">
              <span className={`shrink-0 mt-0.5 ${r.tone === 'good' ? 'text-primary' : r.tone === 'critical' ? 'text-error' : 'text-tertiary'}`}>
                {r.tone === 'good' ? '✓' : r.tone === 'critical' ? '!' : '•'}
              </span>
              <span className="text-on-surface-variant">{r.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SoilMetric({ label, value, unit, tone, sub }: { label: string; value: string; unit?: string; tone?: string; sub?: string }) {
  return (
    <div className="bg-surface-container-high rounded-lg p-2 text-center">
      <p className="text-[10px] text-outline">{label}</p>
      <p className={`text-sm font-semibold ${tone ?? 'text-on-surface'}`}>{value}</p>
      {unit && <p className="text-[9px] text-outline">{unit}</p>}
      {sub && <p className={`text-[9px] ${tone ?? 'text-outline'}`}>{sub}</p>}
    </div>
  );
}

function InfoTile({ icon: Icon, label, value }: { icon: typeof Calendar; label: string; value: string }) {
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

/* ---------- Crop Picks ---------- */

function CropPicks({ county }: { county: string }) {
  const rankings = useMemo(() => recommendCrops(county), [county]);
  const [openCrop, setOpenCrop] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      <p className="text-sm text-on-surface-variant">
        Top crops for <span className="font-semibold text-on-surface">{county}</span>, ranked by rainfall, agro-ecological zone, and season suitability.
      </p>
      {rankings.map((r) => {
        const open = openCrop === r.crop.name;
        return (
          <div key={r.crop.name} className="bg-surface-container-lowest rounded-2xl shadow-sm overflow-hidden">
            <button
              onClick={() => setOpenCrop(open ? null : r.crop.name)}
              className="w-full p-4 flex items-center gap-4 text-left"
            >
              <span className="text-3xl">{r.crop.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-on-surface">{r.crop.name}</p>
                  <span className="text-sm font-bold text-primary">{r.score}%</span>
                </div>
                <div className="h-1.5 bg-surface-container-high rounded-full mt-1.5 overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${r.score}%` }} />
                </div>
              </div>
              {open ? <ChevronDown size={18} className="text-outline" /> : <ChevronRight size={18} className="text-outline" />}
            </button>
            {open && (
              <div className="px-4 pb-4 space-y-2">
                <div>
                  <p className="text-xs font-semibold text-on-surface mb-1">Why</p>
                  <ul className="space-y-1">
                    {r.reasons.map((rs, i) => (
                      <li key={i} className="text-xs text-on-surface-variant flex gap-2">
                        <span className="text-primary">•</span> {rs}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-semibold text-on-surface mb-1">Varieties</p>
                  <div className="flex flex-wrap gap-1.5">
                    {r.crop.varieties.map((v) => (
                      <span key={v.name} className="text-xs bg-surface-container-high px-2 py-1 rounded-full text-on-surface-variant">
                        {v.name} · {v.maturityDays}d
                      </span>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold text-on-surface mb-1">Maturity</p>
                  <p className="text-xs text-on-surface-variant">{r.crop.maturityDays} days · {r.crop.stages.length} growth stages</p>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ---------- Seasons List ---------- */

function SeasonsList({
  seasons, isGuest, onOpen, onNew,
}: {
  seasons: Season[];
  isGuest: boolean;
  onOpen: (id: string) => void;
  onNew: () => void;
}) {
  if (isGuest) {
    return (
      <div className="bg-surface-container-lowest rounded-2xl p-6 text-center">
        <AlertCircle size={28} className="mx-auto text-outline mb-2" />
        <p className="text-sm text-on-surface-variant">Sign in to save and track your seasons across devices.</p>
      </div>
    );
  }
  if (seasons.length === 0) {
    return (
      <button onClick={onNew} className="w-full bg-surface-container-lowest rounded-2xl p-6 border-2 border-dashed border-outline-variant text-center">
        <Plus size={28} className="mx-auto text-primary mb-2" />
        <p className="text-sm font-medium text-on-surface">No active seasons yet</p>
        <p className="text-xs text-outline mt-0.5">Use the Plan tab to plan and save your first crop</p>
      </button>
    );
  }
  return (
    <div className="space-y-3">
      {seasons.map((s) => {
        const growth = calcGrowthStatus(s.planting_date, s.crop, s.variety ?? undefined);
        const cropInfo = getCrop(s.crop);
        const currentWeek = growth ? Math.floor(growth.daysAfterPlanting / 7) + 1 : 0;
        return (
          <button
            key={s.id}
            onClick={() => onOpen(s.id)}
            className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex items-center gap-4 text-left hover:shadow-md transition-shadow"
          >
            <span className="text-3xl">{cropInfo?.emoji ?? '🌱'}</span>
            <div className="flex-1">
              <p className="font-semibold text-on-surface">{s.crop}</p>
              <p className="text-xs text-outline">{s.variety ?? 'Standard'} · {s.county}</p>
              {growth && (
                <>
                  <div className="h-1.5 bg-surface-container-high rounded-full mt-2 overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${growth.progressPercent}%` }} />
                  </div>
                  <p className="text-xs text-on-surface-variant mt-1">
                    Week {currentWeek} · {growth.currentStage} · {growth.remainingDays}d to harvest
                  </p>
                </>
              )}
            </div>
            <ChevronRight size={18} className="text-outline" />
          </button>
        );
      })}
    </div>
  );
}

/* ---------- Form fields ---------- */

function SelectField({
  icon: Icon, label, value, onChange, options, placeholder,
}: {
  icon: typeof MapPin;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">{label}</label>
      <div className="flex items-center gap-3 bg-surface-container-high rounded-xl px-4 py-3">
        <Icon size={18} className="text-outline" />
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent outline-none text-on-surface text-sm"
        >
          {placeholder && <option value="">{placeholder}</option>}
          {options.filter((o) => o !== '').map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      </div>
    </div>
  );
}
