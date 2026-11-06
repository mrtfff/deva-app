import { readFile } from 'node:fs/promises';
import process from 'node:process';
import { createClient } from '@supabase/supabase-js';
import { facilityInputSchema, toSlug } from './facility-schema.ts';

async function main(): Promise<void> {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error('Kullanım: npm run import --workspace @deva/db -- <kurumlar.json>');
    process.exit(1);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(await readFile(filePath, 'utf8'));
  } catch (err) {
    console.error(`Dosya okunamadı veya geçerli JSON değil: ${filePath}`);
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  const parsed = facilityInputSchema.safeParse(raw);
  if (!parsed.success) {
    console.error(`Veri doğrulaması başarısız: ${filePath}`);
    for (const issue of parsed.error.issues) {
      // Kök dizi seviyesindeki hatalar için path[0] = 0 -> dosyanın 1. satırı.
      const row = typeof issue.path[0] === 'number' ? issue.path[0] : 0;
      const field = issue.path.slice(1).join('.') || '(satır)';
      console.error(`  satır ${row + 1} · ${field}: ${issue.message}`);
    }
    process.exit(1);
  }

  const rows = parsed.data.map((row) => ({
    ...row,
    slug: row.slug ?? toSlug(row.name, row.city),
  }));
  const url = process.env.SUPABASE_URL;
  if (!url) {
    console.error('Ortam değişkeni eksik: SUPABASE_URL');
    process.exit(1);
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    console.error('Ortam değişkeni eksik: SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }
  const db = createClient(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error } = await db.from('facilities').upsert(rows, { onConflict: 'slug' });
  if (error) {
    console.error(`Kurumlar yazılamadı: ${error.message}`);
    console.error(`Kod: ${error.code}`);
    process.exit(1);
  }

  console.log(`${rows.length} kayıt işlendi`);
}

await main();