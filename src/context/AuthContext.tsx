import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase, type Profile } from '@/lib/supabase';
import { detectLocation } from '@/lib/location';

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  isGuest: boolean;
  loading: boolean;
  detectedCounty: string | null;
  detectingLocation: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signInAsGuest: () => void;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [detectedCounty, setDetectedCounty] = useState<string | null>(null);
  const [detectingLocation, setDetectingLocation] = useState(false);

  // Auto-detect the user's county via browser geolocation. Used as the default
  // for guests and for users whose profile doesn't specify a county yet.
  useEffect(() => {
    let cancelled = false;
    setDetectingLocation(true);
    detectLocation()
      .then((loc) => {
        if (!cancelled) setDetectedCounty(loc.county.name);
      })
      .catch(() => {
        // Silently fall back to the default county (Nakuru).
      })
      .finally(() => {
        if (!cancelled) setDetectingLocation(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function loadProfile(userId: string) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    setProfile(data as Profile | null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user) {
        loadProfile(data.session.user.id);
      }
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, sess) => {
      (async () => {
        setSession(sess);
        if (sess?.user) {
          setIsGuest(false);
          await loadProfile(sess.user.id);
        } else {
          setProfile(null);
        }
      })();
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  };

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    if (error) return { error: error.message };
    if (data.user) {
      await loadProfile(data.user.id);
    }
    return { error: null };
  };

  const signInAsGuest = () => {
    setIsGuest(true);
    setSession(null);
    setProfile(null);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setIsGuest(false);
    setProfile(null);
    setSession(null);
  };

  const refreshProfile = async () => {
    if (session?.user) await loadProfile(session.user.id);
  };

  return (
    <AuthContext.Provider
      value={{ session, user: session?.user ?? null, profile, isGuest, loading, detectedCounty, detectingLocation, signIn, signUp, signInAsGuest, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
