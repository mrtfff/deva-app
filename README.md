# DEVA

Ruh hali kötü olan / psikolojik zorluk yaşayan kullanıcıların konuşup yalnız kalmaması için
Türkçe bir sohbet uygulaması. DEVA **öncelikle dinler**: tanı koymaz, tedavi önermez, ilaç ya da
terapi yöntemi önermez. Sohbet ve anket verisinden yararlanarak kullanıcıyı yakındaki **tek bir**
uygun uzmana (psikiyatrist / psikolog / diyetisyen) yönlendirir.

## Kurulum

Docker çalışıyor olmalı.

```bash
npm install
npm run db:start          # supabase start
```

`supabase status` çıktısındaki değerleri `apps/mobile/.env` dosyasına yazın
(şablon için kök `.env.example` dosyasına bakın):

```
EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
EXPO_PUBLIC_SUPABASE_ANON_KEY=<ANON_KEY>
EXPO_PUBLIC_PHONE_AUTH_ENABLED=false
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
```

Ardından:

```bash
npm run db:reset                                        # şema + seed
npm run db:import -w @deva/db -- sample/facilities.sample.json
npm run db:testuser                                     # test@deva.app / Test1234!
npm run fn:serve                                        # ayrı terminal
npm run mobile                                          # Expo Go
```

`npm run db:testuser` komutu `USER_ID=` ve `TOKEN=` değerlerini de yazdırır; edge function
çağrılarını `curl` ile denemek için kullanılır.

## Komutlar

| Komut | Açıklama |
| --- | --- |
| `npm run typecheck` | `tsc -b` (node + db + mobile projeleri) |
| `npm run lint` | ESLint 9 flat config |
| `npm test` | Vitest — `_shared` alan mantığı |
| `npm run test --workspace @deva/mobile` | jest-expo — mobil bileşen davranışı |
| `npm run db:start` / `db:reset` | Supabase stack / veritabanını sıfırla |
| `npm run db:import -w @deva/db -- <dosya>` | Kurum listesini `facilities` tablosuna yaz (slug'a göre upsert) |
| `npm run db:testuser` | Test kullanıcısı oluştur |
| `npm run fn:serve` | Edge Function'ları yerelde çalıştır |
| `npm run mobile` | Expo başlat |
| `npm run prebuild:android` | `android/` native projesini üretir |
| `npm run apk:build` | Metro önbelleğini temizleyip release APK derler |

## Telefonda test etme — tek komut

```bash
npm run device
```

Bu komut sırayla: LAN IP'sini bulur → `apps/mobile/.env`'i üretir → Supabase'in
ayakta olduğunu doğrular (gerekirse başlatır) → **APK gerektiği kadar** yeniden
derler (IP değişmediyse atlar) → bağlı cihaza kurar → Expo Go sunucusunu LAN'da
başlatır → QR kodunu tarayıcıda açar.

IP değiştiğinde (yeni Wi-Fi, DHCP) **hiçbir şey yapmana gerek yok**: `npm run device`
değişikliği fark edip kendini yeniden derler. Sürekli senkron için:

```bash
npm run device:watch      # IP değişirse otomatik .env + APK + QR yeniler
npm run device:stop       # arka plandaki sunucuları durdur
```

| Komut | Ne yapar |
| --- | --- |
| `npm run device` | tam hat (IP → db → APK → QR) |
| `npm run device:env` | yalnızca `.env`'i üretir |
| `npm run device:apk` | APK derler ve bağlı cihaza kurar |
| `npm run device:expo` | yalnızca Expo Go + QR |
| `npm run device:watch` | IP değişimlerini izler |
| `npm run device:stop` | arka plan süreçlerini durdurur |

`scripts/device.mjs` saf Node'dur; Docker, adb, unzip, xdg-open ve `expo` dışında
ek bir bağımlılığı yoktur. Adres kuralları ve `.env` üretimi
`tests/device-script.test.ts` ile test edilir.

### Expo Go ile (elle, hızlı yol)

```bash
npm run mobile -- --lan     # ya da: cd apps/mobile && npx expo start --lan
```

**`apps/mobile/.env` içindeki `EXPO_PUBLIC_SUPABASE_URL` LAN adresi olmalı**
(`http://<bilgisayarın-lan-ip>:54321`). `127.0.0.1` telefonda telefonun kendisidir;
bu değerle bağlantı `java.net.ConnectException: failed to connect` ile reddedilir.

Expo Go'da `expo-notifications` ve `expo-maps` **native modülleri kurulu değildir**.
DEVA bu modülleri yalnızca gerçek derlemede yükler (`lib/notifications.ts`,
`lib/maps.ts`); Expo Go'da ilgili ekranlar sessizce yedek görünümü gösterir.
Bu davranış `__tests__/native-modules-expo-go.test.ts` ile korunur — yeni bir ekrana
statik native import eklenirse test kırılır.

APK ile (bildirimler ve harita dahil her şey çalışır):

```bash
npm run prebuild:android
npm run apk:build
adb install -r apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

İki yapılandırma notu:

- **Cleartext izni kapsamlıdır.** Yerel Supabase düz HTTP üzerinden çalıştığı için
  `plugins/withLocalNetworkAccess.ts` yalnızca yerel host'lara (`127.0.0.1`,
  `localhost`, `10.0.2.2` ve `EXPO_PUBLIC_SUPABASE_URL` içindeki **http** adresi)
  cleartext izni veren bir network security config üretir. Geri kalan tüm trafik
  HTTPS olarak kalır; üretimde `https://…` adres kullanılır.
- **Metro önbelleği `.env`'i izlemez.** `EXPO_PUBLIC_*` değerleri bundle'a dönüştürme
  anında gömülür ama önbellek anahtarında yer almaz. `.env` değişikliğinden sonra
  `npm run apk:build` önbelleği temizler; doğrudan `./gradlew assembleRelease`
  çalıştırırsan eski adres bundle'a girer.

## Mimari

```
supabase/functions/_shared/   saf TypeScript alan katmanı (kriz, triyaj, ölçekler,
                              kota, seri, hafıza, prompt, SSE, LLM sağlayıcıları)
supabase/functions/{chat,screening,triage}/   edge function'lar
supabase/migrations/          Postgres şeması, RLS, RPC'ler
apps/mobile/                  Expo + expo-router uygulaması
packages/db/                  kurum importer'ı ve test kullanıcısı
tests/                        Vitest (node), __tests__/ jest-expo (mobil)
```

Alan katmanı **tek kopyadır**: Edge Function'lar, Vitest testleri ve mobil uygulama aynı
dosyaları okur. Mobil taraf `@shared/*` alias'ı ile (Metro `resolver.aliasMap` + tsconfig
`paths`) erişir. `_shared` modülleri hiçbir npm paketi import etmez; ağ bağımlılıkları
`fetchImpl` olarak enjekte edilir.

## Gerçek model

`supabase/functions/.env.example` dosyasını `supabase/functions/.env` olarak kopyalayın.
Varsayılan olarak `LLM_PROVIDER=mock` kullanılır: mock sağlayıcı deterministik Türkçe yansıtma
cümleleri üretir, geliştirme için yeterlidir ve hiçbir anahtar gerekmez.

Gerçek bir sağlayıcıya geçmek için **kod değişmez**, sadece:

```
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-...
```

`anthropic` ve `gemini` için de aynı anahtar değişkenleri geçerlidir.

## Kurum verisi

Depoda yalnızca `packages/db/sample/facilities.sample.json` içinde **8 adet demo kayıt**
vardır; adları ` (demo)` ile biter ve sahte telefon numarası taşır. Gerçek kurum listesi
kullanıcı tarafından hazırlanır ve aynı şemayla `npm run db:import` ile yüklenir.

`promoted_until` / `promoted_weight` alanları reklam sıralamasını kontrol eder ve doğrudan
veritabanından yazılır; uygulamada reklam yönetimi yoktur. Demo kayıtlar kapatılmak istenirse
`is_active = false` yapılır.

## Testler

CI'da Docker/Supabase stack'i başlatılmaz ve edge function'lar çalıştırılmaz. Kapsam saf
mantık (kriz tespiti, triyaj önceliği, ölçek bantları, kota, seri, hafıza, SSE parser, LLM
sağlayıcıları) ve mobil bileşen davranışıdır.

## Docker (web)

Uygulamayı sunuculu çalıştırabilirsiniz: Expo static export + nginx.

```bash
docker build -t deva:1.0.0 .
docker run --rm -p 8080:80 deva:1.0.0
# veya: docker compose up --build
```

Hiçbir `EXPO_PUBLIC_*` verilmezse local-first çalışır (sunucusuz).
Supabase'li çalışmak için build argümanı verin ve `.env`'i runtime'da
geçmek yerine build-time gömüldüğünü unutmayın. Ayrıntılar
`docs/RELEASE.md` > "Docker web" bölümündedir.

## Sürüm alımı

```bash
npm run version:check   # dört sürüm kaynağı tutarlı mı?
```

Detaylı akış `docs/RELEASE.md`'dedir: sürüm bump → kapı kontrolleri →
`vX.Y.Z` etiketi → otomatik Release (APK + `SHA256SUMS.txt` + Docker →
GHCR). Üretim imzalaması (debug keystore dışı) bölümü de oradadır.

## Telefonda APK'yı bulma (Release)

Telefonda GitHub uygulamasında **Releases** sekmesini bulamazsanız:

1. `github.com/mrtfff/deva-app` adresine gidin — repo ilintisinde **Releases**
   (sağ panelde, Code/Issues/PR'lar yanında) seçeneği vardır.
2. İlgili sürümün altından `deva-<sürüm>-release.apk` dosyasını indirin.
3. İndirilen dosyayı açıp "bu kaynaktan kuruluma izin ver" uyarısına izin
   vererek kurun.

Alternatif (tek dokunuş): <https://github.com/mrtfff/deva-app/releases>

Kısa yollar:

- Normal sürüm: `v1.0.0` etiketi
- Sadece UI görmek için (veritabanısız): `v1.0.0-demo` etiketi

Korumak için: indirdiğiniz APK'nın SHA-256'sını `SHA256SUMS.txt` içindeki
aynı adlı satırla karşılaştırın (`sha256sum deva-*.apk`).

Not: Her iki APK aynı paket adını (`app.deva.mobile`) kullandığı için tek
cihazda yan yana kurulamaz; birini kurup diğeri yerine geçirilmelidir.

## Lisans ve politika

[LICENSE](LICENSE) · [CHANGELOG](CHANGELOG.md) · [CONTRIBUTING](CONTRIBUTING.md) · [SECURITY](SECURITY.md)