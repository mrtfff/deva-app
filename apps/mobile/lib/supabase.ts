import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { LOCAL_MODE } from './mode';
import { createLocalSupabaseClient } from './local/localClient';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** Telefon/SMS kaydı kodu hazır ama varsayılan olarak gizli. */
export const PHONE_AUTH_ENABLED =
  process.env.EXPO_PUBLIC_PHONE_AUTH_ENABLED === 'true' && !LOCAL_MODE;

/** Uygulamanın tek veri istemcisi: anahtar yoksa yerel (cihaz içi) mod. */
export const supabase: SupabaseClient = LOCAL_MODE
  ? createLocalSupabaseClient()
  : createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        storage: AsyncStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
