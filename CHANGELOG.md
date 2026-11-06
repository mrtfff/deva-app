# Changelog

Bu dosya, DEVA'daki önemli değişiklikleri bu formatta belgeler.
Format: [Keep a Changelog](https://keepachangelog.com/tr/1.0.0/).
Sürümleme: [SemVer](https://semver.org/lang/tr/).

## [Unreleased]

## [1.0.0] - 2026-11-06

### Eklendi

- Cihaz içi (local-first) mod: anon anahtar yokken veri AsyncStorage'da tutulur,
  sunucuya bağlanılmaz; anahtar tanımlıysa Supabase akışı kullanılır.
- SSE sohbet: kriz tespiti, kota ve seri hesabı, hafıza notları, ekran
  sonuçlarından özet bağlamı (`apps/mobile/lib/local/localChat.ts`).
- Üç edge function: `chat`, `screening`, `triage`; saf alan katmanı
  `supabase/functions/_shared/` içinde tek kopya.
- Yakındaki tek uygun uzmana yönlendirme: haversine mesafe, tip fanı,
  sponsor sıralaması; 8 demo kurum kaydı (`packages/db/sample/`).
- Bildirimler ve günlük kontrol: `lib/notifications.ts` (Expo Go'da metin
  yedek görünüm; native modüller yalnızca gerçek derlemede yüklenir).
- CI: typecheck + lint + Vitest (94 test) + jest-expo (56 test).
- Release: `v*` etiketinde APK + Docker (GHCR) + `SHA256SUMS.txt` üreten
  `.github/workflows/release.yml`; `docs/RELEASE.md` çalıştırma kitabı.
- Docker web imajı: Expo static export + nginx (`Dockerfile`, `docker-compose.yml`).
- Sürüm tutarlılık denetimi: `npm run version:check` (`scripts/check-version.mjs`).

### Düzeltildi

- Yerel DB zincirleme API'si (`insert().select().single()`, `update().eq()`,
  `delete().eq()`): mutasyonlar artık ertelenip çözümleniyor; `Query` private
  alan erişim hatası kaldırıldı (`localDb.ts` yeniden yazımı).
- Jest'te AsyncStorage mock'u eklendi; route yükleme testi yeşil.
- İmzalı release APK ilk kez üretildi (debug keystore; üretim anahtarı için
  `docs/RELEASE.md`'ye bakın).
