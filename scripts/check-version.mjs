/**
 * Dört sürüm kaynağının tutarlılığını denetler:
 *   kök package.json, apps/mobile/package.json, apps/mobile/app.config.ts,
 *   apps/mobile/android/app/build.gradle (prebuild çıktısı; yoksa atlanır).
 * Hepsi aynı olmalı. Biri farklıysa çıkış kodu 1.
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function readJson(path) {
  return JSON.parse(readFileSync(path, 'utf8'));
}

const sources = [];

const rootPkg = readJson(join(ROOT, 'package.json')).version;
sources.push(['package.json', rootPkg]);

const mobilePkg = readJson(join(ROOT, 'apps/mobile/package.json')).version;
sources.push(['apps/mobile/package.json', mobilePkg]);

const appConfig = readFileSync(join(ROOT, 'apps/mobile/app.config.ts'), 'utf8');
const appConfigVersion = appConfig.match(/version:\s*'([^']+)'/)?.[1];
if (!appConfigVersion) {
  console.error('app.config.ts içinde version bulunamadı.');
  process.exit(1);
}
sources.push(['apps/mobile/app.config.ts', appConfigVersion]);

const gradlePath = join(ROOT, 'apps/mobile/android/app/build.gradle');
if (existsSync(gradlePath)) {
  const gradle = readFileSync(gradlePath, 'utf8');
  const gradleVersion = gradle.match(/versionName\s+"([^"]+)"/)?.[1];
  if (gradleVersion) sources.push(['apps/mobile/android/app/build.gradle', gradleVersion]);
  else console.warn('build.gradle içinde versionName bulunamadı; atlandı.');
} else {
  console.warn('android/app/build.gradle yok (prebuild çalıştırılmamış); atlandı.');
}

for (const [name, version] of sources) {
  console.log(`${version === rootPkg ? 'OK  ' : 'FARK'} ${name}: ${version}`);
}

const mismatch = sources.filter(([, version]) => version !== rootPkg);
if (mismatch.length > 0) {
  console.error(`\nSürüm uyumsuzluğu: ${mismatch.map(([n]) => n).join(', ')}`);
  process.exit(1);
}

console.log(`\nSürümler tutarlı: ${rootPkg}`);
