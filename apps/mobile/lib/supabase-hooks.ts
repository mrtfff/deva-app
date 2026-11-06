import { useCallback, useEffect, useState } from 'react';
import { supabase } from './supabase';
import { useAuth } from './auth';
import type { ThemeMode } from './theme';

export interface Conversation {
  id: string;
  title: string | null;
  archived: boolean;
  created_at: string;
  last_message_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  crisis_level: string | null;
  crisis_acknowledged: boolean;
  created_at: string;
}

export interface MemoryNote {
  id: string;
  content: string;
  category: 'fact' | 'preference' | 'event' | 'context';
  source: 'ai' | 'user';
  created_at: string;
  updated_at: string;
}

export interface ScreeningResultRow {
  id: string;
  instrument_code: 'PHQ9' | 'GAD7' | 'SCOFF';
  completed_at: string;
}

export interface Appointment {
  id: string;
  facility_id: string | null;
  title: string;
  starts_at: string;
  remind_at: string | null;
  remind_enabled: boolean;
  notes: string | null;
  facility_name?: string | null;
}

export interface UserSettings {
  theme: ThemeMode;
  daily_checkin_enabled: boolean;
  daily_checkin_time: string;
  post_crisis_followup_enabled: boolean;
  is_pro: boolean;
}

export interface StreakRow {
  current_streak: number;
  longest_streak: number;
  last_chat_date: string | null;
}

function useUserId(): string | null {
  const { user } = useAuth();
  return user?.id ?? null;
}

export function useProfile() {
  const { profile, loading, refreshProfile } = useAuth();
  return { profile, loading, refresh: refreshProfile };
}

export function useSettings() {
  const userId = useUserId();
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setSettings(null);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('user_settings')
      .select('theme, daily_checkin_enabled, daily_checkin_time, post_crisis_followup_enabled, is_pro')
      .eq('user_id', userId)
      .maybeSingle();

    if (data) {
      setSettings(data as UserSettings);
    } else {
      // İlk girişte satır yok; varsayılanlarla oluştur.
      const { data: created } = await supabase
        .from('user_settings')
        .upsert({ user_id: userId })
        .select('theme, daily_checkin_enabled, daily_checkin_time, post_crisis_followup_enabled, is_pro')
        .single();
      setSettings((created as UserSettings | null) ?? null);
    }
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const update = useCallback(
    async (patch: Partial<UserSettings>) => {
      if (!userId) return;
      setSettings((current) => (current ? { ...current, ...patch } : current));
      await supabase.from('user_settings').update(patch).eq('user_id', userId);
    },
    [userId],
  );

  return { settings, loading, refresh: load, update };
}

export function useConversations() {
  const userId = useUserId();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setConversations([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('conversations')
      .select('id, title, archived, created_at, last_message_at')
      .eq('user_id', userId)
      .order('last_message_at', { ascending: false });
    setConversations((data as Conversation[] | null) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async (): Promise<string | null> => {
    if (!userId) return null;
    const { data } = await supabase
      .from('conversations')
      .insert({ user_id: userId })
      .select('id')
      .single();
    return data ? (data.id as string) : null;
  }, [userId]);

  const remove = useCallback(
    async (id: string) => {
      await supabase.from('conversations').delete().eq('id', id);
      setConversations((current) => current.filter((c) => c.id !== id));
    },
    [],
  );

  const setArchived = useCallback(async (id: string, archived: boolean) => {
    await supabase.from('conversations').update({ archived }).eq('id', id);
    await load();
  }, [load]);

  return { conversations, loading, refresh: load, create, remove, setArchived };
}

export function useMessages(conversationId: string | null) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!conversationId) {
      setMessages([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('messages')
      .select('id, conversation_id, role, content, crisis_level, crisis_acknowledged, created_at')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });
    setMessages((data as Message[] | null) ?? []);
    setLoading(false);
  }, [conversationId]);

  useEffect(() => {
    setLoading(true);
    void load();
  }, [load]);

  return { messages, loading, refresh: load, setMessages };
}

export function useScreeningResults() {
  const userId = useUserId();
  const [results, setResults] = useState<ScreeningResultRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setResults([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('screening_results')
      .select('id, instrument_code, completed_at')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false });
    setResults((data as ScreeningResultRow[] | null) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { results, loading, refresh: load };
}

export function useAppointments() {
  const userId = useUserId();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setAppointments([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('appointments')
      .select('id, facility_id, title, starts_at, remind_at, remind_enabled, notes, facilities(name)')
      .eq('user_id', userId)
      .order('starts_at', { ascending: true });

    const rows = ((data as unknown[] | null) ?? []).map((row) => {
      const item = row as Appointment & { facilities?: { name: string } | { name: string }[] | null };
      const facility = Array.isArray(item.facilities) ? item.facilities[0] : item.facilities;
      return { ...item, facility_name: facility?.name ?? null } as Appointment;
    });

    setAppointments(rows);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = useCallback(async (appointment: Omit<Appointment, 'id'>) => {
    if (!userId) return null;
    const { data } = await supabase
      .from('appointments')
      .insert({ ...appointment, user_id: userId })
      .select('id')
      .single();
    await load();
    return data ? (data.id as string) : null;
  }, [userId, load]);

  const remove = useCallback(async (id: string) => {
    await supabase.from('appointments').delete().eq('id', id);
    setAppointments((current) => current.filter((a) => a.id !== id));
  }, []);

  const toggleReminder = useCallback(async (id: string, enabled: boolean) => {
    await supabase.from('appointments').update({ remind_enabled: enabled }).eq('id', id);
    setAppointments((current) =>
      current.map((a) => (a.id === id ? { ...a, remind_enabled: enabled } : a)),
    );
  }, []);

  return { appointments, loading, refresh: load, create, remove, toggleReminder };
}

export function useMemoryNotes() {
  const userId = useUserId();
  const [notes, setNotes] = useState<MemoryNote[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!userId) {
      setNotes([]);
      setLoading(false);
      return;
    }
    const { data } = await supabase
      .from('memory_notes')
      .select('id, content, category, source, created_at, updated_at')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('updated_at', { ascending: false });
    setNotes((data as MemoryNote[] | null) ?? []);
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const add = useCallback(
    async (content: string, category: MemoryNote['category']) => {
      if (!userId) return;
      await supabase
        .from('memory_notes')
        .insert({ user_id: userId, content, category, source: 'user' });
      await load();
    },
    [userId, load],
  );

  const update = useCallback(
    async (id: string, content: string, category: MemoryNote['category']) => {
      await supabase.from('memory_notes').update({ content, category }).eq('id', id);
      setNotes((current) => current.map((n) => (n.id === id ? { ...n, content, category } : n)));
    },
    [],
  );

  const remove = useCallback(async (id: string) => {
    await supabase.from('memory_notes').delete().eq('id', id);
    setNotes((current) => current.filter((n) => n.id !== id));
  }, []);

  const forgetAll = useCallback(async () => {
    if (!userId) return;
    await supabase
      .from('memory_notes')
      .delete()
      .eq('user_id', userId)
      .eq('is_active', true);
    await load();
  }, [userId, load]);

  return { notes, loading, refresh: load, add, update, remove, forgetAll };
}

/** Seri bilgisi sunucu tarafında yazılır; istemci yalnızca okur. */
export function useStreak() {
  const userId = useUserId();
  const [streak, setStreak] = useState<StreakRow | null>(null);

  const load = useCallback(async () => {
    if (!userId) {
      setStreak(null);
      return;
    }
    const { data } = await supabase
      .from('streaks')
      .select('current_streak, longest_streak, last_chat_date')
      .eq('user_id', userId)
      .maybeSingle();
    setStreak((data as StreakRow | null) ?? null);
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  return { streak, refresh: load };
}