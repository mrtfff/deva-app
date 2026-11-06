import { createClient } from '@supabase/supabase-js';

const EMAIL = 'test@deva.app';
const PASSWORD = 'Test1234!';
const BIRTH_YEAR = 1995;

const url = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const anonKey = process.env.SUPABASE_ANON_KEY;

if (!url || !serviceRoleKey) {
  console.error('SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenleri gerekli.');
  process.exit(1);
}

const admin = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

/** Kullanıcı varsa yenisini oluşturmak yerine mevcut olanı döndürür. */
async function ensureUser(): Promise<string> {
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });

  if (created?.user) return created.user.id;
  if (!createError) throw new Error('Kullanıcı oluşturulamadı.');

  const { data: list, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listError) throw listError;

  const existing = list.users.find((user) => user.email === EMAIL);
  if (!existing) throw createError;

  await admin.auth.admin.updateUserById(existing.id, { password: PASSWORD, email_confirm: true });
  return existing.id;
}

const userId = await ensureUser();

await admin.from('profiles').upsert({
  id: userId,
  display_name: 'Test',
  birth_year: BIRTH_YEAR,
  onboarding_completed: true,
});
await admin.from('user_settings').upsert({ user_id: userId });
await admin.from('consent').upsert({ user_id: userId, terms_version: '1.0.0' });

console.log(`Kullanıcı hazır: ${EMAIL} / ${PASSWORD}`);
console.log(`USER_ID=${userId}`);

if (anonKey) {
  const client = createClient(url, anonKey, { auth: { persistSession: false } });
  const { data, error } = await client.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (!error && data.session) {
    console.log(`TOKEN=${data.session.access_token}`);
  } else {
    console.error(`Token alınamadı: ${error?.message ?? 'bilinmeyen hata'}`);
    process.exit(1);
  }
} else {
  console.log('EXPO_PUBLIC_SUPABASE_ANON_KEY tanımlı değil; TOKEN üretilmedi.');
}