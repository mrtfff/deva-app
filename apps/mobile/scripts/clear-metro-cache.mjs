import { rmSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Metro, `EXPO_PUBLIC_*` değerlerini JS dönüştürme anında bundle'ın içine
 * gömer; ancak önbellek anahtarı bu ortam değişkenlerini **içermez**.
 * `.env` içindeki bir adresi değiştirdiğinde yeniden derleme eski adresi
 * gömer. Bu yüzden native derlemeden önce önbellek temizlenir.
 */
const paths = [
  join(process.cwd(), 'node_modules', '.cache', 'metro'),
  join(process.cwd(), '..', '..', 'node_modules', '.cache', 'metro'),
  join(tmpdir(), 'metro-cache'),
];

for (const entry of readdirSync(tmpdir())) {
  if (entry.startsWith('metro-file-map-') || entry.startsWith('haste-map-')) {
    paths.push(join(tmpdir(), entry));
  }
}

for (const target of paths) {
  rmSync(target, { recursive: true, force: true });
}

console.log(`Metro önbelleği temizlendi (${paths.length} konum).`);