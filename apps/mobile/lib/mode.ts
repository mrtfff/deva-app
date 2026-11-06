/**
 * Yerel mod: `EXPO_PUBLIC_SUPABASE_ANON_KEY` tanımlı değilse uygulama hiçbir
 * sunucuya bağlanmadan, verileri cihazda (AsyncStorage) tutarak çalışır.
 * Anahtar tanımlıysa gerçek Supabase akışı aynen kullanılır.
 */
export const LOCAL_MODE =
  (process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '').trim().length === 0;
