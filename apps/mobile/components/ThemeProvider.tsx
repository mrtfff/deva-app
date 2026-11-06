import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { resolveTheme, type Theme, type ThemeMode } from '../lib/theme';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/auth';

interface ThemeContextValue {
  theme: Theme;
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemScheme = useColorScheme();
  const { user } = useAuth();
  const [mode, setModeState] = useState<ThemeMode>('system');

  useEffect(() => {
    if (!user) {
      setModeState('system');
      return;
    }
    let active = true;
    supabase
      .from('user_settings')
      .select('theme')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!active) return;
        const saved = (data as { theme?: ThemeMode } | null)?.theme;
        if (saved === 'light' || saved === 'dark' || saved === 'system') {
          setModeState(saved);
        }
      });
    return () => {
      active = false;
    };
  }, [user]);

  const setMode = useCallback(
    async (next: ThemeMode) => {
      setModeState(next);
      if (!user) return;
      await supabase.from('user_settings').update({ theme: next }).eq('user_id', user.id);
    },
    [user],
  );

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme: resolveTheme(mode, systemScheme === 'dark'),
      mode,
      setMode,
    }),
    [mode, systemScheme, setMode],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme, ThemeProvider içinde kullanılmalı');
  return context;
}