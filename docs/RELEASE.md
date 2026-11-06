# Sürüm Yayın Rehberi (Release)

Bu belge `vX.Y.Z` sürümünün baştan uca nasıl alınacağını anlatır.
Release workflow (`.github/workflows/release.yml`) bu adımları otomatik
koşar; bu rehber yerel doğrulama ve imza adımları içindir.

## 1. Sürümü bump'la

Dört kaynak aynı anda güncellenir (`npm run version:check` doğrular):

1. `package.json` → `version`
2. `apps/mobile/package.json` → `version`
3. `apps/mobile/app.config.ts` → `version`
4. `apps/mobile/android/app/build.gradle` → `versionName`
   (üretilmiş dosya; `npm run prebuild:android` ile yenilenir)

`CHANGELOG.md` içinde `[Unreleased]` altındaki maddeler
`## [X.Y.Z] - YYYY-MM-DD` başlığına taşınır. Önemli: `android/` klasörü
git'te değildir; bu yüzden derleme öncesi `npm run prebuild:android`
koşulur.

```bash
npm run version:check
```

## 2. Kapı kontrolleri

```bash
npm run typecheck
npm run lint
npm test
npm run test --workspace @deva/mobile
```

Hepsi yeşil olmalı. CI da aynı kapıları koşar; kırmızı CI ile etiket
atılmamalıdır.

## 3. Etiket at (otomasyon bu noktadan sonra çalışır)

```bash
git add -A
git commit -m "release: vX.Y.Z"
git tag -a vX.Y.Z -m "vX.Y.Z"
git push origin master --tags
```

`v*.*.*` deseni `.github/workflows/release.yml`'i tetikler:

- **Check**: sürüm denetimi + kapılar.
- **APK**: prebuild → `./gradlew assembleRelease` →
  `deva-vX.Y.Z-release.apk` + `SHA256SUMS.txt` →
  GitHub Release "DEVA vX.Y.Z" altında.
- **Docker**: `ghcr.io/<repo>:vX.Y.Z` ve `:latest`.

`workflow_dispatch` ile yalnızca etiket verip workflow'u elle de
başlatabilirsiniz (örn. push atılmış etiketi kaçırdıysanız).

Kontrol:

```bash
# APK sağlama
sha256sum -c SHA256SUMS.txt
# Docker
docker pull ghcr.io/<repo>:vX.Y.Z
docker run --rm -p 8080:80 ghcr.io/<repo>:latest
```

## 4. APK çıktısı (yerel)

```bash
npm run prebuild:android   # android/ yoksa üretir (sürüm config'den gelir)
npm run apk:build          # önbellek temizler + assembleRelease
ls apps/mobile/android/app/build/outputs/apk/release/app-release.apk
sha256sum apps/mobile/android/app/build/outputs/apk/release/app-release.apk
```

## 5. Üretim imzalama (Play Store için şart)

Mevcut release imzası **debug keystore**'dur. Bu imza kurulum ve dağıtım
için geçerlidir ama Play Store kabul etmez. Üretim için:

1. Kendi keystore'unuzu üretin (güvenli yerde saklayın; `.gitignore`
   `*.jks`/`*.keystore`'u dışarıda bırakır):
   `keytool -genkeypair -v -keystore deva-release.jks -alias deva -keyalg RSA -keysize 2048 -validity 10000`
2. `android/gradle.properties` içinde (üretilmiş dosyadır; prebuild
   sonrası yeniden yazın, gerekirse `app.config.ts` plugin'i ile kalıcılaştırın):

   ```
   MYAPP_RELEASE_STORE_FILE=…/deva-release.jks
   MYAPP_RELEASE_STORE_PASSWORD=…
   MYAPP_RELEASE_KEY_ALIAS=deva
   MYAPP_RELEASE_KEY_PASSWORD=…
   ```

3. `android/app/build.gradle` `release { signingConfig }` satırını
   debug yerine bu değişkenlerden okuyan bir `signingConfigs.release`
   ile değiştirin (şablon için React Native dokümanına bakın).
4. `npm run apk:build` ile yeniden derleyip cihazda doğrulayın.

EAS kullanıyorsanız `apps/mobile/eas.json` `production` profili
`credentialsSource: "local"` kullanır; anahtar yönetimi EAS'e
devredilebilir.

## 6. Docker web

```bash
docker build -t deva:1.0.0 .
docker run --rm -p 8080:80 deva:1.0.0
# veya:
docker compose up --build
```

Hiçbir `EXPO_PUBLIC_*` verilmezse local-first çalışır (sunucusuz).
Supabase'li çalışmak için:

```bash
docker build -t deva:1.0.0 \
  --build-arg EXPO_PUBLIC_SUPABASE_URL=https://<proj>.supabase.co \
  --build-arg EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon-key> .
```

## 7. Geri alma (rollback)

- **APK**: halihazırda kurulmuş sürümler eski APK'ya dönerek geri alınır;
  yeni sürümün `versionCode`'u zaten ilerlemiş olduğundan geriye kurulum
  için `adb install -r` gerekebilir.
- **Docker**: önceki etiketi yeniden çalıştırın
  (`ghcr.io/<repo>:vX.Y.Z` tag'leri immutable'dır).
- **Git**: sorunlu etiketi silmeyin; düzeltme sürümü (`vX.Y.Z+1`) çıkarın.
