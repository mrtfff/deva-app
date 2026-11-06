import * as fs from 'node:fs';
import * as path from 'node:path';
import { withAndroidManifest, withDangerousMod, type ConfigPlugin } from 'expo/config-plugins';

/**
 * Yerel geliştirme Supabase'i düz HTTP üzerinden çalışır (`http://<lan-ip>:54321`).
 * Android 9+ cleartext trafiği varsayılan olarak engellediği için release derlemesi
 * bağlantıyı reddeder.
 *
 * Bunun yerine tüm uygulamaya cleartext izni vermek yerine **yalnızca yerel
 * geliştirme host'larına** izin veren bir network security config yazıyoruz:
 * gerçek üretimde tüm trafik HTTPS olarak kalıyor.
 */

/** Emulator ve masaüstü geliştirme için standart host'lar. */
const ALWAYS_LOCAL = ['127.0.0.1', 'localhost', '10.0.2.2'];

export function localHosts(
  supabaseUrl: string | undefined = process.env.EXPO_PUBLIC_SUPABASE_URL,
): string[] {
  const hosts = new Set(ALWAYS_LOCAL);
  try {
    const url = new URL(supabaseUrl ?? '');
    // Cleartext istisnası yalnızca düz HTTP ile konuşan bir adres için
    // anlamlıdır; `https://` üretim adresine izin vermek HTTPS'i gereksiz
    // yere gevşetirdi.
    if (url.protocol === 'http:' && url.hostname) hosts.add(url.hostname);
  } catch {
    // URL yok ya da geçersiz; yalnızca standart host'lar kalır.
  }
  return [...hosts];
}

export function buildNetworkSecurityConfig(hosts: string[]): string {
  const domains = hosts
    .map((host) => `    <domain includeSubdomains="false">${host}</domain>`)
    .join('\n');

  return `<?xml version="1.0" encoding="utf-8"?>
<!-- DEVA: gerçek trafiğin tamamı HTTPS'tir. Cleartext yalnızca yerel geliştirme
     Supabase'i ve Android emülatör host'u için açıktır. -->
<network-security-config>
  <base-config cleartextTrafficPermitted="false" />
  <domain-config cleartextTrafficPermitted="true">
${domains}
  </domain-config>
</network-security-config>
`;
}

const withScopedCleartext: ConfigPlugin = (config) =>
  withAndroidManifest(config, (androidConfig) => {
    const application = androidConfig.modResults.manifest.application?.[0];
    if (application) {
      application.$ = {
        ...application.$,
        'android:usesCleartextTraffic': 'false',
        'android:networkSecurityConfig': '@xml/network_security_config',
      };
    }
    return androidConfig;
  });

const withNetworkSecurityXml: ConfigPlugin = (config) =>
  withDangerousMod(config, [
    'android',
    async (androidConfig) => {
      const directory = path.join(
        androidConfig.modRequest.platformProjectRoot,
        'app/src/main/res/xml',
      );
      await fs.promises.mkdir(directory, { recursive: true });
      await fs.promises.writeFile(
        path.join(directory, 'network_security_config.xml'),
        buildNetworkSecurityConfig(localHosts()),
        'utf8',
      );
      return androidConfig;
    },
  ]);

const withLocalNetworkAccess: ConfigPlugin = (config) =>
  withNetworkSecurityXml(withScopedCleartext(config));

export default withLocalNetworkAccess;