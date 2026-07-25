import { useEffect, useMemo, useState } from 'react';
import {
  Sprout, MapPin, Calendar, ChevronDown, ChevronRight, Check, Clock,
  TrendingUp, Info, Plus, ListChecks, Wheat, AlertCircle, LocateFixed, Loader2,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Season, type Activity } from '@/lib/supabase';
import { COUNTIES, CROPS, getCrop, type CropInfo } from '@/lib/data';
import {
  analyzePlanting, recommendCrops, recommendVariety, calcGrowthStatus,
  generateActivities, recommendPlantingDate, type PlantingDecision, type CropRanking,
} from '@/lib/recommendations';
import { fetchWeather } from '@/lib/weather';
import { detectLocation } from '@/lib/location';

type View = 'advisor' | 'crops' | 'seasons' | 'detail';

export default function AdvisorScreen() {
  const { profile, isGuest, detectedCounty } = useAuth();
  const [view, setView] = useState<View>('advisor');
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState<string | null>(null);

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

  if (view === 'detail' && selectedSeasonId) {
    const season = seasons.find((s) => s.id === selectedSeasonId);
    if (season) {
      return <SeasonDetail season={season} onBack={() => setView('seasons')} onUpdated={loadSeasons} />;
    }
  }

  return (
    <div className="pb-24">
      <header className="bg-gradient-to-b from-primary to-primary-container px-5 pt-12 pb-6 rounded-b-3xl">
        <h1 className="text-on-primary text-2xl font-bold">Smart Planting Advisor</h1>
        <p className="text-on-primary/80 text-sm mt-1">Get explainable planting recommendations</p>
      </header>

      {/* Tab switcher */}
      <div className="px-5 mt-4">
        <div className="flex bg-surface-container-high rounded-full p-1">
          {([
            ['advisor', 'Plant Now'],
            ['crops', 'Crop Picks'],
            ['seasons', 'My Seasons'],
          ] as const).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setView(k)}
              className={`flex-1 py-2 rounded-full text-sm font-semibold transition-all ${
                view === k ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="px-5 mt-5">
        {view === 'advisor' && <PlantingForm county={county} onSaved={loadSeasons} />}
        {view === 'crops' && <CropPicks county={county} />}
        {view === 'seasons' && (
          <SeasonsList
            seasons={seasons}
            isGuest={isGuest}
            onOpen={(id) => {
              setSelectedSeasonId(id);
              setView('detail');
            }}
            onNew={() => setView('advisor')}
          />
        )}
      </div>
    </div>
  );
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

  const countyInfo = useMemo(() => COUNTIES.find((c) => c.name === selectedCounty), [selectedCounty]);
  const cropInfo = useMemo(() => getCrop(crop), [crop]);

  // Recommended planting date is derived from the selected county (KALRO calendar).
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
    if (countyInfo) {
      try {
        const w = await fetchWeather(countyInfo.latitude, countyInfo.longitude);
        rainfallForecast = w.daily.slice(0, 14).reduce((s, d) => s + d.precipitation, 0);
      } catch {
        // ignore weather failure
      }
    }
    const decision = analyzePlanting({
      county: selectedCounty,
      subCounty,
      crop,
      plantingDate: dateRec.startDate,
      variety: variety || undefined,
      rainfallForecast,
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
    // generate activities
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
    setSaveMsg('Season saved! Track it in My Seasons.');
    onSaved();
  }

  return (
    <div className="space-y-4">
      <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm space-y-4">
        <h3 className="font-semibold text-on-surface flex items-center gap-2">
          <Sprout size={18} className="text-primary" /> Planting Details
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

        {/* Recommended planting window (read-only, derived from KALRO calendar) */}
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
        <ResultCard decision={result} crop={crop} onSave={saveSeason} saveMsg={saveMsg} />
      )}
    </div>
  );
}

function ResultCard({
  decision, crop, onSave, saveMsg,
}: {
  decision: PlantingDecision;
  crop: string;
  onSave: () => void;
  saveMsg: string | null;
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

      <button
        onClick={onSave}
        className="w-full bg-primary-container text-on-primary font-semibold py-3 rounded-full hover:bg-primary transition-colors"
      >
        Save as My Season
      </button>
      {saveMsg && (
        <p className={`text-sm text-center ${saveMsg.startsWith('Error') ? 'text-error' : 'text-primary'}`}>{saveMsg}</p>
      )}
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
        <p className="text-xs text-outline mt-0.5">Use the advisor to plan and save your first crop</p>
      </button>
    );
  }
  return (
    <div className="space-y-3">
      {seasons.map((s) => {
        const growth = calcGrowthStatus(s.planting_date, s.crop, s.variety ?? undefined);
        const cropInfo = getCrop(s.crop);
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
                    Day {growth.daysAfterPlanting} · {growth.currentStage} · {growth.remainingDays}d left
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

/* ---------- Season Detail (My Season + Weekly Activities) ---------- */

function SeasonDetail({ season, onBack, onUpdated }: { season: Season; onBack: () => void; onUpdated: () => void }) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const growth = calcGrowthStatus(season.planting_date, season.crop, season.variety ?? undefined);
  const cropInfo = getCrop(season.crop);

  async function loadActivities() {
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('season_id', season.id)
      .order('week_number', { ascending: true });
    setActivities((data as Activity[]) ?? []);
  }

  useEffect(() => {
    loadActivities();
  }, [season.id]);

  async function toggleActivity(act: Activity) {
    const completed = !act.completed;
    await supabase
      .from('activities')
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq('id', act.id);
    loadActivities();
  }

  async function deleteSeason() {
    if (!confirm('Delete this season and all its activities?')) return;
    await supabase.from('seasons').delete().eq('id', season.id);
    onUpdated();
    onBack();
  }

  return (
    <div className="pb-24">
      <header className="bg-gradient-to-b from-primary to-primary-container px-5 pt-12 pb-6 rounded-b-3xl">
        <button onClick={onBack} className="text-on-primary/80 text-sm mb-3 flex items-center gap-1">
          <ChevronDown size={16} className="rotate-90" /> Back
        </button>
        <div className="flex items-center gap-3">
          <span className="text-4xl">{cropInfo?.emoji ?? '🌱'}</span>
          <div>
            <h1 className="text-on-primary text-xl font-bold">{season.crop}</h1>
            <p className="text-on-primary/80 text-sm">{season.variety ?? 'Standard variety'}</p>
          </div>
        </div>
      </header>

      <div className="px-5 mt-5 space-y-4">
        {/* Growth status */}
        {growth && (
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-on-surface mb-3">Growth Tracker</h3>
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-2xl font-bold text-primary">{growth.currentStage}</p>
                <p className="text-xs text-on-surface-variant">{growth.stageDescription}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-on-surface">{growth.daysAfterPlanting}</p>
                <p className="text-xs text-outline">days after planting</p>
              </div>
            </div>
            <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden mb-2">
              <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${growth.progressPercent}%` }} />
            </div>
            <div className="flex items-center justify-between text-xs text-on-surface-variant">
              <span>Planted: {season.planting_date}</span>
              <span>{growth.progressPercent.toFixed(0)}% complete</span>
            </div>
            <div className="flex items-center justify-between text-xs text-on-surface-variant mt-1">
              <span className="flex items-center gap-1"><Clock size={12} /> {growth.remainingDays} days to harvest</span>
              <span>Harvest: {growth.harvestDate}</span>
            </div>
          </div>
        )}

        {/* Growth stages timeline */}
        {cropInfo && (
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
            <h3 className="font-semibold text-on-surface mb-3">Growth Stages</h3>
            <div className="space-y-2">
              {cropInfo.stages.map((s) => {
                const isCurrent = growth && growth.daysAfterPlanting >= s.startDay && growth.daysAfterPlanting <= s.endDay;
                const isPast = growth && growth.daysAfterPlanting > s.endDay;
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
        )}

        {/* Weekly activities */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
          <h3 className="font-semibold text-on-surface mb-3 flex items-center gap-2">
            <ListChecks size={18} className="text-primary" /> Weekly Activities
          </h3>
          {activities.length === 0 ? (
            <p className="text-sm text-outline">No activities generated.</p>
          ) : (
            <div className="space-y-2">
              {activities.map((a) => {
                const due = new Date(a.due_date ?? '');
                const overdue = !a.completed && due < new Date();
                return (
                  <button
                    key={a.id}
                    onClick={() => toggleActivity(a)}
                    className={`w-full flex items-start gap-3 p-3 rounded-xl text-left transition-colors ${
                      a.completed ? 'bg-primary-container/10' : 'bg-surface-container-high'
                    }`}
                  >
                    <div className={`w-5 h-5 rounded-full border-2 shrink-0 mt-0.5 flex items-center justify-center ${
                      a.completed ? 'bg-primary border-primary' : overdue ? 'border-error' : 'border-outline'
                    }`}>
                      {a.completed && <Check size={12} className="text-on-primary" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${a.completed ? 'text-outline line-through' : 'text-on-surface'}`}>
                        Week {a.week_number}: {a.title}
                      </p>
                      <p className="text-xs text-on-surface-variant">{a.description}</p>
                      <p className={`text-[11px] mt-0.5 ${overdue ? 'text-error' : 'text-outline'}`}>
                        Due {a.due_date} · {a.category}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          onClick={deleteSeason}
          className="w-full text-error text-sm font-medium py-3 rounded-full border border-error/30 hover:bg-error-container/30 transition-colors"
        >
          End / Delete Season
        </button>
      </div>
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
