import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';

export interface Profile {
  id: string;
  display_name: string | null;
  birth_year: number;
  onboarding_completed: boolean;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
  updateDisplayName: (name: string) => Promise<boolean>;
  updateEmail: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const loadProfile = useCallback(async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      setProfile(null);
      return;
    }
    const { data: row } = await supabase
      .from('profiles')
      .select('id, display_name, birth_year, onboarding_completed')
      .eq('id', data.user.id)
      .maybeSingle();
    setProfile((row as Profile | null) ?? null);
  }, []);

  useEffect(() => {
    if (!session?.user) {
      setProfile(null);
      return;
    }
    void loadProfile();
  }, [session?.user, loadProfile]);

  const updateDisplayName = useCallback(
    async (name: string): Promise<boolean> => {
      const userId = session?.user?.id;
      if (!userId) return false;
      const { error } = await supabase.from('profiles').update({ display_name: name }).eq('id', userId);
      if (error) return false;
      await loadProfile();
      return true;
    },
    [session?.user?.id, loadProfile],
  );

  const updateEmail = useCallback(
    async (email: string): Promise<void> => {
      const { error } = await supabase.auth.updateUser({ email });
      if (error) throw new Error(error.message);
    },
    [],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      session,
      profile,
      loading,
      refreshProfile: loadProfile,
      signOut: async () => {
        await supabase.auth.signOut();
        setProfile(null);
      },
      updateDisplayName,
      updateEmail,
    }),
    [session, profile, loading, loadProfile, updateDisplayName, updateEmail],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return context;
}