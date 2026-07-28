import { useState } from 'react';
import { Sprout, Mail, Lock, User as UserIcon, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function AuthScreen() {
  const { signIn, signUp, signInAsGuest } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const res =
      mode === 'login'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, name.trim() || 'Farmer');
    setBusy(false);
    if (res.error) setError(res.error);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-primary to-primary-container flex flex-col">
      <div className="flex-1 flex flex-col justify-center px-6 py-10 max-w-md mx-auto w-full">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center mb-4 ring-4 ring-white/10">
            <Sprout size={40} className="text-on-primary" strokeWidth={2.2} />
          </div>
          <h1 className="text-3xl font-bold text-on-primary tracking-tight">Panda Sasa</h1>
          <p className="text-on-primary/80 text-sm mt-1.5 text-center">
            Smart planting decisions for Kenyan farmers
          </p>
        </div>

        <div className="bg-surface-container-lowest rounded-3xl p-6 shadow-xl">
          <div className="flex bg-surface-container-high rounded-full p-1 mb-6">
            <button
              onClick={() => setMode('login')}
              className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all ${
                mode === 'login' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setMode('register')}
              className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-all ${
                mode === 'register' ? 'bg-primary text-on-primary shadow' : 'text-on-surface-variant'
              }`}
            >
              Register
            </button>
          </div>

          <form onSubmit={submit} className="space-y-4">
            {mode === 'register' && (
              <Field icon={UserIcon} label="Full Name">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Wanjiku Kamau"
                  className="w-full bg-transparent outline-none text-on-surface placeholder:text-outline"
                  required
                />
              </Field>
            )}
            <Field icon={Mail} label="Email">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full bg-transparent outline-none text-on-surface placeholder:text-outline"
                required
              />
            </Field>
            <Field icon={Lock} label="Password">
              <input
                type={showPw ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-transparent outline-none text-on-surface placeholder:text-outline"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPw((s) => !s)}
                className="text-outline hover:text-on-surface"
              >
                {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </Field>

            {error && (
              <div className="bg-error-container text-on-error-container text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full bg-primary text-on-primary font-semibold py-3.5 rounded-full hover:bg-primary-container transition-colors disabled:opacity-60"
            >
              {busy ? 'Please wait…' : mode === 'login' ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-outline-variant" />
            <span className="text-xs text-outline">or</span>
            <div className="flex-1 h-px bg-outline-variant" />
          </div>

          <button
            onClick={signInAsGuest}
            className="w-full border border-outline text-on-surface font-medium py-3 rounded-full hover:bg-surface-container-high transition-colors"
          >
            Continue as Guest
          </button>
        </div>

        <p className="text-on-primary/70 text-xs text-center mt-6 leading-relaxed">
          Panda Sasa uses KALRO crop calendars, rainfall forecasts, and agro-ecological data to give you explainable planting recommendations.
        </p>
      </div>
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  children,
}: {
  icon: typeof Mail;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-on-surface-variant mb-1.5 block">{label}</label>
      <div className="flex items-center gap-3 bg-surface-container-high rounded-xl px-4 py-3 focus-within:ring-2 focus-within:ring-primary">
        <Icon size={18} className="text-outline" />
        {children}
      </div>
    </div>
  );
}
