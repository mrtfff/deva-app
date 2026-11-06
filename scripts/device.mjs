/**
 * DEVA cihaz otomasyonu.
 *
 * Tek komutla: LAN IP'sini bulur, `apps/mobile/.env`'i günceller, Supabase'in
 * ayakta olduğunu doğrular, gerekiyorsa APK'yı yeniden derleyip bağlı cihaza
 * kurar, Expo Go için LAN sunucusunu başlatır ve QR kodunu tarayıcıda açar.
 *
 *   node scripts/device.mjs            tam hat (IP → db → APK → QR)
 *   node scripts/device.mjs env        yalnızca .env güncelle
 *   node scripts/device.mjs apk        APK derle + kur
 *   node scripts/device.mjs expo       Expo Go + QR
 *   node scripts/device.mjs watch      IP değişirse otomatik yeniden senkronla
 *   node scripts/device.mjs stop       arka plandaki süreçleri durdur
 */

import { spawn, spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { connect } from 'node:net';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const MOBILE = join(ROOT, 'apps', 'mobile');
const ENV_FILE = join(MOBILE, '.env');
const STATE_DIR = join(ROOT, '.deva');
const PID_FILE = join(STATE_DIR, 'expo.pid');
const QR_PID_FILE = join(STATE_DIR, 'qr.pid');
const QR_FILE = join(STATE_DIR, 'qr.html');
const QR_PORT = 8099;
const QR_SERVER = join(ROOT, 'scripts', 'qr-server.mjs');
const EXPO_PORT = 8081;
const APK = join(MOBILE, 'android/app/build/outputs/apk/release/app-release.apk');

const log = (...args) => console.log(...args);
const step = (title) => log(`\n\x1b[1m▸ ${title}\x1b[0m`);
const ok = (msg) => log(`  \x1b[32m✓\x1b[0m ${msg}`);
const warn = (msg) => log(`  \x1b[33m!\x1b[0m ${msg}`);
const fail = (msg) => log(`  \x1b[31m✗\x1b[0m ${msg}`);

/** Docker/VM arayüzlerini (virbr, docker0) ele. */
export function isLanAddress(address) {
  return (
    address.startsWith('192.168.') ||
    address.startsWith('10.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(address)
  );
}

export function detectLanAddress() {
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' || entry.internal) continue;
      if (!isLanAddress(entry.address)) continue;
      return entry.address;
    }
  }
  throw new Error('LAN adresi bulunamadı; bilgisayar ağa bağlı mı?');
}

function readEnvFile() {
  const values = {};
  if (existsSync(ENV_FILE)) {
    for (const line of readFileSync(ENV_FILE, 'utf8').split('\n')) {
      const match = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
      if (match) values[match[1]] = match[2];
    }
  }
  return values;
}

function anonKeyFromSupabase() {
  const result = spawnSync('npx', ['supabase', 'status', '-o', 'env'], {
    encoding: 'utf8',
  });
  const match = /^ANON_KEY=(.+)$/m.exec(result.stdout ?? '');
  return match?.[1]?.trim();
}

export function renderEnvFile(values) {
  return [
    `# Bu dosya .gitignore'dadır; scripts/device.mjs tarafından üretilir.`,
    `# IP değiştiğinde yeniden üretmek için: npm run device:env`,
    `EXPO_PUBLIC_SUPABASE_URL=${values.EXPO_PUBLIC_SUPABASE_URL}`,
    `EXPO_PUBLIC_SUPABASE_ANON_KEY=${values.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? ''}`,
    `EXPO_PUBLIC_PHONE_AUTH_ENABLED=${values.EXPO_PUBLIC_PHONE_AUTH_ENABLED ?? 'false'}`,
    `EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=${values.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? ''}`,
    '',
  ].join('\n');
}

/** .env'i günceller; gerçekten değiştiyse true döner. */
export function syncEnv(lanAddress) {
  const current = readEnvFile();
  const next = {
    ...current,
    EXPO_PUBLIC_SUPABASE_URL: `http://${lanAddress}:54321`,
    EXPO_PUBLIC_PHONE_AUTH_ENABLED: current.EXPO_PUBLIC_PHONE_AUTH_ENABLED ?? 'false',
  };
  if (!next.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    next.EXPO_PUBLIC_SUPABASE_ANON_KEY = anonKeyFromSupabase() ?? '';
  }

  const previous = existsSync(ENV_FILE) ? readFileSync(ENV_FILE, 'utf8') : '';
  const content = renderEnvFile(next);
  if (previous === content) return false;

  // Bu araç yerel geliştirme içindir; üretim adresi varsa sessizce
  // ezmek yerine yedeğe alır.
  const existing = current.EXPO_PUBLIC_SUPABASE_URL ?? '';
  if (existing.startsWith('https://')) {
    writeFileSync(`${ENV_FILE}.bak`, previous, 'utf8');
    warn(`Mevcut .env bir HTTPS adresiydi; ${ENV_FILE}.bak dosyasına yedeklendi.`);
  }

  mkdirSync(MOBILE, { recursive: true });
  writeFileSync(ENV_FILE, content, 'utf8');
  return true;
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: { ...process.env, ...options.env },
    ...options,
  });
  return result.status === 0;
}

function supabaseIsRunning() {
  const result = spawnSync('npx', ['supabase', 'status'], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  return result.status === 0;
}

function ensureDatabase() {
  if (supabaseIsRunning()) {
    ok('Supabase ayakta');
    return true;
  }
  warn('Supabase çalışmıyor, başlatılıyor…');
  return run('npx', ['supabase', 'start']);
}

/** APK'nın gömülü bundle'ı beklenen LAN adresini taşıyor mu? */
function apkIsCurrent(lanAddress) {
  if (!existsSync(APK)) return false;

  const result = spawnSync('unzip', ['-p', APK, 'assets/index.android.bundle'], {
    encoding: 'buffer',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (result.status !== 0 || !result.stdout?.length) return false;

  return result.stdout.includes(Buffer.from(`http://${lanAddress}:54321`));
}

function connectedDevice() {
  const result = spawnSync('adb', ['devices'], { encoding: 'utf8' });
  const line = (result.stdout ?? '')
    .split('\n')
    .slice(1)
    .find((entry) => entry.includes('\tdevice'));
  return line ? line.split('\t')[0] : null;
}

function buildApk() {
  mkdirSync(STATE_DIR, { recursive: true });
  if (!existsSync(join(MOBILE, 'android'))) {
    step('Native proje üretiliyor');
    if (!run('npx', ['expo', 'prebuild', '--platform', 'android', '--no-install'], { cwd: MOBILE, env: { CI: '' } })) {
      fail('expo prebuild başarısız');
      return false;
    }
  }

  step('APK derleniyor (Metro önbelleği temizleniyor)');
  if (!run('npm', ['run', 'apk:clean'], { cwd: MOBILE })) return false;
  if (!run('./gradlew', ['assembleRelease', '--no-daemon'], { cwd: join(MOBILE, 'android') })) {
    fail('Gradle derlemesi başarısız');
    return false;
  }
  ok(`APK hazır: ${APK.replace(`${ROOT}/`, '')}`);
  return true;
}

function installApk() {
  const device = connectedDevice();
  if (!device) {
    warn('Bağlı Android cihaz yok, APK kurulmadı (USB kablosu + USB debugging)');
    return false;
  }
  step(`APK kuruluyor (${device})`);
  const okInstall = run('adb', ['install', '-r', APK]);
  if (okInstall) ok('Kuruldu');
  return okInstall;
}

function readPid(file = PID_FILE) {
  if (!existsSync(file)) return null;
  const pid = Number.parseInt(readFileSync(file, 'utf8').trim(), 10);
  return Number.isFinite(pid) ? pid : null;
}

function killPidFile(file, label) {
  const pid = readPid(file);
  if (!pid) return false;
  try {
    // Detached süreçler grup lideri olduğu için süreç grubu ile kapatılır.
    process.kill(-pid, 'SIGTERM');
  } catch {
    try {
      process.kill(pid, 'SIGTERM');
    } catch {
      /* süreç zaten yok */
    }
  }
  rmSync(file, { force: true });
  if (pid) ok(`${label} durduruldu (PID ${pid})`);
  return true;
}

function stopExpo() {
  killPidFile(PID_FILE, 'Metro');
  killPidFile(QR_PID_FILE, 'QR sunucusu');
}

async function startExpo(lanAddress) {
  step('Expo Go sunucusu (LAN) başlatılıyor');
  stopExpo();

  // CI=1 Metro'yu kısıtlayıp QR'ı bastırıyor; temizlenmeli.
  const env = { ...process.env, CI: '', EXPO_NO_TELEMETRY: '1' };
  delete env.CI;

  const child = spawn('npx', ['expo', 'start', '--lan', '--port', String(EXPO_PORT)], {
    cwd: MOBILE,
    detached: true,
    stdio: ['ignore', 'ignore', 'ignore'],
    env,
  });
  child.unref();
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(PID_FILE, String(child.pid), 'utf8');
  ok(`PID ${child.pid}`);

  const url = `exp://${lanAddress}:${EXPO_PORT}`;
  await waitForServer(EXPO_PORT, 180_000);
  ok(`Metro hazır: ${url}`);
  return url;
}

async function waitForServer(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const reachable = await new Promise((resolve) => {
      const client = connect({ port, host: '127.0.0.1' }, () => {
        client.end();
        resolve(true);
      });
      client.on('error', () => resolve(false));
    });
    if (reachable) return true;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  warn('Metro sunucusu zamanında açılmadı; yine de devam ediliyor');
  return false;
}

async function openQrPage(url) {
  step('QR kodu hazırlanıyor');
  const png = await QRCode.toDataURL(url, { width: 720, margin: 2 });
  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8"><title>DEVA — Expo Go</title>
<style>
  body { margin:0; min-height:100vh; display:flex; align-items:center; justify-content:center;
         background:#F6F7F4; color:#1C2422;
         font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
  .card { background:#fff; border:1px solid #E2E8E3; border-radius:18px;
          padding:40px 48px; text-align:center; max-width:760px; }
  h1 { font-size:26px; margin:0 0 4px; letter-spacing:2px; color:#3F7A6B; }
  p.sub { color:#6B7B77; margin:0 0 24px; font-size:15px; }
  img { width:520px; max-width:100%; image-rendering:pixelated; }
  .url { margin-top:20px; font-family:ui-monospace,Menlo,monospace; font-size:20px;
         background:#E4EEE9; color:#1C2422; padding:12px 18px; border-radius:12px;
         display:inline-block; }
  .note { margin-top:22px; font-size:14px; color:#6B7B77; line-height:1.7; }
  .note b { color:#1C2422; }
</style></head>
<body><div class="card">
  <h1>DEVA</h1>
  <p class="sub">Expo Go ile açmak için QR kodunu telefonunla tara</p>
  <img src="${png}" alt="Expo Go QR kodu">
  <div class="url">${url}</div>
  <div class="note">
    Telefon ve bu bilgisayar <b>aynı Wi-Fi ağında</b> olmalı.<br>
    Expo Go uygulaması telefonda kurulu olmalı.<br>
    Bildirimler ve harita yalnızca <b>APK</b> derlemesinde çalışır.
  </div>
</div></body></html>`;

  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(QR_FILE, html, 'utf8');

  killPidFile(QR_PID_FILE, 'QR sunucusu');
  const server = spawn('node', [QR_SERVER], {
    cwd: ROOT,
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, QR_PORT: String(QR_PORT) },
  });
  server.unref();
  writeFileSync(QR_PID_FILE, String(server.pid), 'utf8');

  const ready = await waitForServer(QR_PORT, 15_000);
  const page = `http://127.0.0.1:${QR_PORT}/`;
  if (!ready) {
    warn(`QR sunucusu açılmadı; şu dosyayı tarayıcıda aç: ${QR_FILE}`);
    return;
  }
  ok(`QR sayfası: ${page}`);
  if (!run('xdg-open', [page], { stdio: 'ignore' })) {
    warn(`Tarayıcı açılamadı; şu adresi kendin aç: ${page}`);
  }
}

async function fullPipeline() {
  const lanAddress = detectLanAddress();
  log(`\x1b[1mDEVA cihaz hazırlığı\x1b[0m  ·  LAN: ${lanAddress}`);

  step('Ortam değişkenleri');
  const changed = syncEnv(lanAddress);
  ok(
    changed
      ? `.env güncellendi → ${`http://${lanAddress}:54321`}`
      : `.env güncel (${`http://${lanAddress}:54321`})`,
  );

  if (!ensureDatabase()) {
    fail('Supabase başlatılamadı');
    process.exitCode = 1;
    return;
  }

  step('APK');
  if (changed || !apkIsCurrent(lanAddress)) {
    if (buildApk()) installApk();
  } else {
    ok(`APK güncel, derleme atlandı (${APK.replace(`${ROOT}/`, '')})`);
    installApk();
  }

  const url = await startExpo(lanAddress);
  await openQrPage(url);

  log('\n\x1b[1mHazır.\x1b[0m  Durdurmak için: npm run device:stop');
}

async function watchLoop() {
  log('\x1b[1mİzleme modu:\x1b[0m IP değişirse APK yeniden derlenir. Çıkmak için Ctrl+C\n');
  let last = detectLanAddress();
  ok(`Başlangıç IP: ${last}`);

  for (;;) {
    await new Promise((resolve) => setTimeout(resolve, 30_000));
    let current;
    try {
      current = detectLanAddress();
    } catch {
      warn('Ağ geçici olarak yok, tekrar denenecek');
      continue;
    }
    if (current === last) continue;

    fail(`IP değişti: ${last} → ${current}`);
    last = current;
    syncEnv(current);
    ensureDatabase();
    if (buildApk()) installApk();
    stopExpo();
    const url = await startExpo(current);
    await openQrPage(url);
  }
}

async function main() {
  const command = process.argv[2] ?? 'all';

  if (command === 'env') {
    const lanAddress = detectLanAddress();
    const changed = syncEnv(lanAddress);
    ok(changed ? '.env güncellendi' : '.env güncel');
    log(`  EXPO_PUBLIC_SUPABASE_URL=http://${lanAddress}:54321`);
    return;
  }

  if (command === 'apk') {
    const lanAddress = detectLanAddress();
    syncEnv(lanAddress);
    ensureDatabase();
    if (buildApk()) installApk();
    return;
  }

  if (command === 'expo') {
    const lanAddress = detectLanAddress();
    syncEnv(lanAddress);
    await startExpo(lanAddress);
    return;
  }

  if (command === 'stop') {
    stopExpo();
    ok('Arka plandaki süreçler durduruldu');
    return;
  }

  if (command === 'watch') {
    process.on('SIGINT', () => {
      stopExpo();
      process.exit(0);
    });
    await watchLoop();
    return;
  }

  process.on('SIGINT', () => {
    stopExpo();
    process.exit(0);
  });
  await fullPipeline();
}

// Yalnızca doğrudan çalıştırıldığında yan etki üretir; testler güvenle import edebilir.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
