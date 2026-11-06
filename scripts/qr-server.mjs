import { createServer } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * QR sayfasını servis eden ayrı süreç.
 *
 * `device.mjs` bu süreci arka planda (detached) başlatır ve PID'ini
 * `.deva/qr.pid` dosyasına yazar; böylece ana komut hemen biter ve
 * `npm run device:stop` sunucuyu kapatabilir.
 */
const STATE_DIR = join(dirname(dirname(fileURLToPath(import.meta.url))), '.deva');
const HTML_FILE = join(STATE_DIR, 'qr.html');
const PORT = Number.parseInt(process.env.QR_PORT ?? '8099', 10);

if (!existsSync(HTML_FILE)) {
  console.error('QR sayfası bulunamadı; önce `npm run device` çalıştır.');
  process.exit(1);
}

const html = readFileSync(HTML_FILE);

createServer((req, res) => {
  if (req.url === '/' || req.url === '/qr.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
    return;
  }
  res.writeHead(404).end();
}).listen(PORT, '127.0.0.1', () => {
  console.log(`QR sunucusu hazır: http://127.0.0.1:${PORT}/`);
});