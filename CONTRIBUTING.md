# Katkıda Bulunma

DEVA'ya katkı için bu belgeyi okuyun. Alan katmanı
`supabase/functions/_shared/` içindeki saf modüllerdir; Edge Function'lar,
Vitest testleri ve mobil uygulama aynı dosyaları okur.

## Kurulum

Gereksinimler: Node.js 24+ (`.nvmrc` bakın), Docker (Supabase için), JDK 17 +
Android SDK (APK için).

```bash
npm ci
cp .env.example apps/mobile/.env   # değerleri `supabase status` çıktısından doldurun
```

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run typecheck` | `tsc -b` (node + db + mobile) |
| `npm run lint` | ESLint 9 flat config |
| `npm test` | Vitest — `_shared` alan mantığı |
| `npm run test --workspace @deva/mobile` | jest-expo — mobil bileşen davranışı |
| `npm run version:check` | Dört sürüm kaynağının tutarlılığı |
| `npm run db:start` / `db:reset` | Supabase stack / şema+seed |

Yeni bir ekran eklerken: native modül `lib/` içinde koşullu yüklenir
(`lib/notifications.ts`, `lib/maps.ts` deseni). `__tests__/native-modules-expo-go.test.ts`
bunu korur — test kırılırsa desen bozulmuştur.

## Test politikası

- Saf alan mantığı için kalıcı test yazın (kriz, triyaj, ölçek bantları, kota,
  seri, SSE parser, LLM sağlayıcıları).
- Kalıcı testler kullanıcıya görünen davranışı, sınırları ve geçişleri
  yakalamalı: ne saf yönlendirme/kopya ne de zararsız varsayılan dondurma.
- CI'da Docker/Supabase çalıştırılmaz; edge function'ları çalıştıran test
  eklemeyin.

## Pull Request denetim listesi

- [ ] `npm run typecheck`, `npm run lint`, `npm test` ve mobil testler yeşil.
- [ ] Sürüm değiştiyse dört kaynak güncellendi (`npm run version:check` yeşil).
- [ ] Davranış değişikliği varsa `CHANGELOG.md` `[Unreleased]` altına yazıldı.
- [ ] Sır içeren hiçbir dosya eklenmedi (`apps/mobile/.env`,
      `supabase/functions/.env`, `*.jks`/`*.keystore`).

Sürüm alımı için `docs/RELEASE.md`'ye bakın.
