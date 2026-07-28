import { useEffect, useState } from 'react';
import {
  User as UserIcon, MapPin, Globe, LogOut, Shield, Database, ChevronRight,
  Sprout, Droplets, AlertTriangle, CheckCircle2, Info, WifiOff, HardDrive,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { supabase, type Profile, type StorageAssessment } from '@/lib/supabase';
import { COUNTIES, CROPS } from '@/lib/data';
import { calculateStorageRisk, type StorageRiskInput, type StorageRiskResult } from '@/lib/recommendations';

export default function ProfileScreen() {
  const { profile, isGuest, signOut, refreshProfile } = useAuth();
  const [editing, setEditing] = useState(false);
  const [view, setView] = useState<'profile' | 'storage' | 'history' | 'offline'>('profile');
  const [assessments, setAssessments] = useState<StorageAssessment[]>([]);

  async function loadAssessments() {
    if (isGuest) return;
    const { data } = await supabase
      .from('storage_assessments')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    setAssessments((data as StorageAssessment[]) ?? []);
  }

  useEffect(() => {
    loadAssessments();
  }, [isGuest]);

  if (view === 'storage') {
    return <StorageCalculator onBack={() => setView('profile')} onSaved={loadAssessments} />;
  }
  if (view === 'history') {
    return <StorageHistory assessments={assessments} onBack={() => setView('profile')} />;
  }
  if (view === 'offline') {
    return <OfflineInfo onBack={() => setView('profile')} />;
  }

  return (
    <div className="pb-24">
      <header className="bg-gradient-to-b from-primary to-primary-container px-5 pt-12 pb-6 rounded-b-3xl">
        <h1 className="text-on-primary text-2xl font-bold">Profile</h1>
      </header>

      <div className="px-5 mt-5 space-y-4">
        {/* Profile card */}
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-14 h-14 rounded-full bg-primary-container/15 flex items-center justify-center">
              <UserIcon size={26} className="text-primary" />
            </div>
            <div>
              <p className="font-semibold text-on-surface text-lg">
                {profile?.name ?? (isGuest ? 'Guest Farmer' : 'Farmer')}
              </p>
              <p className="text-xs text-outline">{isGuest ? 'Guest mode — data not saved' : 'Registered farmer'}</p>
            </div>
          </div>

          {!isGuest && (
            <>
              <ProfileRow icon={MapPin} label="County" value={profile?.county ?? 'Nakuru'} />
              <ProfileRow icon={MapPin} label="Sub-county" value={profile?.sub_county ?? '—'} />
              <ProfileRow icon={Globe} label="Language" value={langName(profile?.preferred_language ?? 'en')} />
            </>
          )}

          {!isGuest && !editing && (
            <button
              onClick={() => setEditing(true)}
              className="w-full mt-3 border border-outline text-on-surface text-sm font-medium py-2.5 rounded-full hover:bg-surface-container-high transition-colors"
            >
              Edit Profile
            </button>
          )}
        </div>

        {editing && profile && (
          <EditProfileForm
            profile={profile}
            onClose={() => setEditing(false)}
            onSaved={async () => {
              await refreshProfile();
              setEditing(false);
            }}
          />
        )}

        {/* Tools */}
        <div className="space-y-2">
          <h2 className="text-sm font-semibold text-on-surface-variant px-1">Tools</h2>
          <ToolButton
            icon={Shield}
            title="Storage Risk Calculator"
            subtitle="Assess spoilage and aflatoxin risk"
            onClick={() => setView('storage')}
          />
          <ToolButton
            icon={Database}
            title="Storage History"
            subtitle="Past risk assessments"
            onClick={() => setView('history')}
          />
          <ToolButton
            icon={WifiOff}
            title="Offline Support"
            subtitle="View saved data without internet"
            onClick={() => setView('offline')}
          />
        </div>

        {/* About */}
        <div className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-on-surface mb-1.5 flex items-center gap-2">
            <Info size={15} className="text-primary" /> About Panda Sasa
          </h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            An agricultural decision-support tool for Kenyan farmers. Recommendations are based on KALRO crop calendars, agro-ecological zones, and Open-Meteo rainfall forecasts.
          </p>
        </div>

        {/* Sign out */}
        {!isGuest && (
          <button
            onClick={signOut}
            className="w-full flex items-center justify-center gap-2 text-error text-sm font-medium py-3 rounded-full border border-error/30 hover:bg-error-container/30 transition-colors"
          >
            <LogOut size={16} /> Sign Out
          </button>
        )}
      </div>
    </div>
  );
}

function ProfileRow({ icon: Icon, label, value }: { icon: typeof MapPin; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-t border-outline-variant/40">
      <div className="flex items-center gap-2 text-on-surface-variant">
        <Icon size={15} />
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-medium text-on-surface">{value}</span>
    </div>
  );
}

function ToolButton({
  icon: Icon, title, subtitle, onClick,
}: {
  icon: typeof Shield;
  title: string;
  subtitle: string;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full bg-surface-container-lowest rounded-2xl p-4 shadow-sm flex items-center gap-3 text-left hover:shadow-md transition-shadow"
    >
      <div className="w-10 h-10 rounded-full bg-primary-container/15 flex items-center justify-center shrink-0">
        <Icon size={18} className="text-primary" />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium text-on-surface">{title}</p>
        <p className="text-xs text-outline">{subtitle}</p>
      </div>
      <ChevronRight size={18} className="text-outline" />
    </button>
  );
}

function EditProfileForm({ profile, onClose, onSaved }: {
  profile: Profile;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(profile.name ?? '');
  const [county, setCounty] = useState(profile.county);
  const [subCounty, setSubCounty] = useState(profile.sub_county);
  const [lang, setLang] = useState(profile.preferred_language);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    const { error } = await supabase
      .from('profiles')
      .update({ name, county, sub_county: subCounty, preferred_language: lang, updated_at: new Date().toISOString() })
      .eq('user_id', profile.user_id);
    setSaving(false);
    if (error) setErr(error.message);
    else onSaved();
  }

  return (
    <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm space-y-3">
      <h3 className="font-semibold text-on-surface">Edit Profile</h3>
      <FormField label="Name">
        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full bg-surface-container-high rounded-xl px-4 py-3 text-sm outline-none" />
      </FormField>
      <FormField label="County">
        <select value={county} onChange={(e) => setCounty(e.target.value)} className="w-full bg-surface-container-high rounded-xl px-4 py-3 text-sm outline-none">
          {COUNTIES.map((c) => <option key={c.name} value={c.name}>{c.name}</option>)}
        </select>
      </FormField>
      <FormField label="Sub-county">
        <select value={subCounty} onChange={(e) => setSubCounty(e.target.value)} className="w-full bg-surface-container-high rounded-xl px-4 py-3 text-sm outline-none">
          {(COUNTIES.find((c) => c.name === county)?.subCounties ?? []).map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </FormField>
      <FormField label="Preferred Language">
        <select value={lang} onChange={(e) => setLang(e.target.value)} className="w-full bg-surface-container-high rounded-xl px-4 py-3 text-sm outline-none">
          <option value="en">English</option>
          <option value="sw">Kiswahili</option>
          <option value="ki">Kikuyu</option>
          <option value="lu">Luo</option>
          <option value="ka">Kalenjin</option>
        </select>
      </FormField>
      {err && <p className="text-xs text-error">{err}</p>}
      <div className="flex gap-2">
        <button onClick={onClose} className="flex-1 border border-outline text-on-surface py-2.5 rounded-full text-sm font-medium">Cancel</button>
        <button onClick={save} disabled={saving} className="flex-1 bg-primary text-on-primary py-2.5 rounded-full text-sm font-semibold disabled:opacity-60">
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}

function langName(code: string): string {
  const m: Record<string, string> = { en: 'English', sw: 'Kiswahili', ki: 'Kikuyu', lu: 'Luo', ka: 'Kalenjin' };
  return m[code] ?? code;
}

/* ---------- Storage Risk Calculator ---------- */

function StorageCalculator({ onBack, onSaved }: { onBack: () => void; onSaved: () => void }) {
  const [crop, setCrop] = useState('Maize');
  const [dryness, setDryness] = useState<StorageRiskInput['drynessLevel']>('fully-dry');
  const [method, setMethod] = useState<StorageRiskInput['storageMethod']>('hermetic-bag');
  const [moisture, setMoisture] = useState<StorageRiskInput['moistureCondition']>('low');
  const [result, setResult] = useState<StorageRiskResult | null>(null);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  function assess() {
    setResult(calculateStorageRisk({ crop, drynessLevel: dryness, storageMethod: method, moistureCondition: moisture }));
    setSaveMsg(null);
  }

  async function saveResult() {
    if (!result) return;
    const { error } = await supabase.from('storage_assessments').insert({
      crop,
      dryness_level: dryness,
      storage_method: method,
      moisture_condition: moisture,
      risk_score: result.riskScore,
      risk_level: result.riskLevel,
      aflatoxin_risk: result.aflatoxinRisk,
      spoilage_risk: result.spoilageRisk,
      advice: result.advice,
    });
    if (error) setSaveMsg(`Error: ${error.message}`);
    else {
      setSaveMsg('Assessment saved to your history.');
      onSaved();
    }
  }

  return (
    <div className="pb-24">
      <header className="bg-gradient-to-b from-primary to-primary-container px-5 pt-12 pb-6 rounded-b-3xl">
        <button onClick={onBack} className="text-on-primary/80 text-sm mb-2 flex items-center gap-1">
          <ChevronRight size={16} className="rotate-180" /> Back
        </button>
        <h1 className="text-on-primary text-xl font-bold">Storage Risk Calculator</h1>
        <p className="text-on-primary/80 text-sm mt-1">Assess spoilage and aflatoxin risk</p>
      </header>

      <div className="px-5 mt-5 space-y-4">
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm space-y-4">
          <FormField label="Crop">
            <select value={crop} onChange={(e) => setCrop(e.target.value)} className="w-full bg-surface-container-high rounded-xl px-4 py-3 text-sm outline-none">
              {CROPS.map((c) => <option key={c.name} value={c.name}>{c.emoji} {c.name}</option>)}
            </select>
          </FormField>
          <FormField label="How dry is the crop?">
            <select value={dryness} onChange={(e) => setDryness(e.target.value as StorageRiskInput['drynessLevel'])} className="w-full bg-surface-container-high rounded-xl px-4 py-3 text-sm outline-none">
              <option value="fully-dry">Fully dry (snaps when bent)</option>
              <option value="mostly-dry">Mostly dry</option>
              <option value="slightly-damp">Slightly damp</option>
              <option value="wet">Wet / freshly harvested</option>
            </select>
          </FormField>
          <FormField label="Storage method">
            <select value={method} onChange={(e) => setMethod(e.target.value as StorageRiskInput['storageMethod'])} className="w-full bg-surface-container-high rounded-xl px-4 py-3 text-sm outline-none">
              <option value="hermetic-bag">Hermetic bag (PICS)</option>
              <option value="woven-sack">Woven sack</option>
              <option value="granary">Traditional granary</option>
              <option value="floor">On the floor</option>
              <option value="plastic-bag">Plastic bag</option>
            </select>
          </FormField>
          <FormField label="Storage area moisture">
            <select value={moisture} onChange={(e) => setMoisture(e.target.value as StorageRiskInput['moistureCondition'])} className="w-full bg-surface-container-high rounded-xl px-4 py-3 text-sm outline-none">
              <option value="low">Dry / well-ventilated</option>
              <option value="moderate">Moderate humidity</option>
              <option value="high">Humid / damp</option>
            </select>
          </FormField>
          <button onClick={assess} className="w-full bg-primary text-on-primary font-semibold py-3 rounded-full">
            Calculate Risk
          </button>
        </div>

        {result && (
          <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-outline">Risk Level</p>
                <p className={`text-2xl font-bold ${
                  result.riskLevel === 'Low' ? 'text-primary' :
                  result.riskLevel === 'Moderate' ? 'text-tertiary' :
                  result.riskLevel === 'High' ? 'text-error' : 'text-error'
                }`}>{result.riskLevel}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-outline">Risk Score</p>
                <p className="text-2xl font-bold text-on-surface">{result.riskScore}/100</p>
              </div>
            </div>
            <div className="h-2.5 bg-surface-container-high rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${
                result.riskLevel === 'Low' ? 'bg-primary' :
                result.riskLevel === 'Moderate' ? 'bg-tertiary' : 'bg-error'
              }`} style={{ width: `${result.riskScore}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <RiskPill label="Aflatoxin Risk" value={result.aflatoxinRisk} />
              <RiskPill label="Spoilage Risk" value={result.spoilageRisk} />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-on-surface mb-1.5 flex items-center gap-1.5">
                <CheckCircle2 size={15} className="text-primary" /> Recommendations
              </h4>
              <p className="text-xs text-on-surface-variant leading-relaxed">{result.advice}</p>
            </div>
            <button onClick={saveResult} className="w-full bg-primary-container text-on-primary font-semibold py-2.5 rounded-full text-sm">
              Save Assessment
            </button>
            {saveMsg && <p className={`text-xs text-center ${saveMsg.startsWith('Error') ? 'text-error' : 'text-primary'}`}>{saveMsg}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

function RiskPill({ label, value }: { label: string; value: string }) {
  const color = value === 'Low' ? 'text-primary' : value === 'Moderate' ? 'text-tertiary' : 'text-error';
  return (
    <div className="bg-surface-container-high rounded-xl p-3">
      <p className="text-[11px] text-outline">{label}</p>
      <p className={`text-sm font-semibold ${color}`}>{value}</p>
    </div>
  );
}

/* ---------- Storage History ---------- */

function StorageHistory({ assessments, onBack }: { assessments: StorageAssessment[]; onBack: () => void }) {
  return (
    <div className="pb-24">
      <header className="bg-gradient-to-b from-primary to-primary-container px-5 pt-12 pb-6 rounded-b-3xl">
        <button onClick={onBack} className="text-on-primary/80 text-sm mb-2 flex items-center gap-1">
          <ChevronRight size={16} className="rotate-180" /> Back
        </button>
        <h1 className="text-on-primary text-xl font-bold">Storage History</h1>
      </header>
      <div className="px-5 mt-5 space-y-2">
        {assessments.length === 0 ? (
          <div className="bg-surface-container-lowest rounded-2xl p-6 text-center">
            <AlertTriangle size={26} className="mx-auto text-outline mb-2" />
            <p className="text-sm text-on-surface-variant">No assessments yet. Run the calculator to build a history.</p>
          </div>
        ) : (
          assessments.map((a) => (
            <div key={a.id} className="bg-surface-container-lowest rounded-2xl p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="font-semibold text-on-surface">{a.crop}</p>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  a.risk_level === 'Low' ? 'bg-primary-container/15 text-primary' :
                  a.risk_level === 'Moderate' ? 'bg-tertiary-fixed/40 text-tertiary' : 'bg-error-container/40 text-error'
                }`}>{a.risk_level} · {a.risk_score}/100</span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Aflatoxin: {a.aflatoxin_risk} · Spoilage: {a.spoilage_risk}
              </p>
              <p className="text-xs text-outline mt-1">
                {new Date(a.created_at).toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' })}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/* ---------- Offline Info ---------- */

function OfflineInfo({ onBack }: { onBack: () => void }) {
  return (
    <div className="pb-24">
      <header className="bg-gradient-to-b from-primary to-primary-container px-5 pt-12 pb-6 rounded-b-3xl">
        <button onClick={onBack} className="text-on-primary/80 text-sm mb-2 flex items-center gap-1">
          <ChevronRight size={16} className="rotate-180" /> Back
        </button>
        <h1 className="text-on-primary text-xl font-bold">Offline Support</h1>
      </header>
      <div className="px-5 mt-5 space-y-3">
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
          <WifiOff size={24} className="text-primary mb-2" />
          <h3 className="font-semibold text-on-surface mb-1">Works Without Internet</h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            Panda Sasa caches your seasons, activities, and crop calendars on your device. You can track growth stages and view saved crop info even when offline.
          </p>
        </div>
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
          <HardDrive size={24} className="text-primary mb-2" />
          <h3 className="font-semibold text-on-surface mb-1">Auto-Sync</h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            When your connection returns, any changes you made offline are synced to your account automatically. Your data is never lost.
          </p>
        </div>
        <div className="bg-surface-container-lowest rounded-2xl p-5 shadow-sm">
          <Sprout size={24} className="text-primary mb-2" />
          <h3 className="font-semibold text-on-surface mb-1">Built-in Crop Calendars</h3>
          <p className="text-xs text-on-surface-variant leading-relaxed">
            KALRO-based crop calendars for {CROPS.length} crops are bundled with the app, so variety recommendations and growth stage info are always available.
          </p>
        </div>
      </div>
    </div>
  );
}
