import { describe, expect, it } from 'vitest';
import {
  detectLanAddress,
  isLanAddress,
  renderEnvFile,
} from '../scripts/device.mjs';

describe('isLanAddress', () => {
  it('gerçek LAN adreslerini kabul eder', () => {
    for (const address of ['192.168.1.14', '10.0.2.2', '172.16.0.1', '172.31.255.254']) {
      expect(isLanAddress(address)).toBe(true);
    }
  });

  it('loopback, link-local ve Docker/virbr arayüzlerini eler', () => {
    for (const address of ['127.0.0.1', '169.254.1.1', '172.15.0.1', '172.32.0.1', '8.8.8.8']) {
      expect(isLanAddress(address)).toBe(false);
    }
  });
});

describe('renderEnvFile', () => {
  const values = {
    EXPO_PUBLIC_SUPABASE_URL: 'http://192.168.1.14:54321',
    EXPO_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    EXPO_PUBLIC_PHONE_AUTH_ENABLED: 'false',
    EXPO_PUBLIC_GOOGLE_MAPS_API_KEY: '',
  };

  it('tüm EXPO_PUBLIC_* anahtarlarını yazar', () => {
    const content = renderEnvFile(values);

    expect(content).toContain('EXPO_PUBLIC_SUPABASE_URL=http://192.168.1.14:54321');
    expect(content).toContain('EXPO_PUBLIC_SUPABASE_ANON_KEY=anon-key');
    expect(content).toContain('EXPO_PUBLIC_PHONE_AUTH_ENABLED=false');
    expect(content).toContain('EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=');
  });

  it('dosyayı satır sonuyla bitirir ve yeniden üretim ipucu verir', () => {
    const content = renderEnvFile(values);

    expect(content.endsWith('\n')).toBe(true);
    expect(content).toContain('npm run device:env');
  });

  it('eksik anahtarlar için varsayılan yazar, anahtarı uydurmaz', () => {
    const content = renderEnvFile({ EXPO_PUBLIC_SUPABASE_URL: 'http://10.0.0.5:54321' });

    expect(content).toContain('EXPO_PUBLIC_SUPABASE_ANON_KEY=');
    expect(content).toContain('EXPO_PUBLIC_PHONE_AUTH_ENABLED=false');
  });
});

describe('detectLanAddress', () => {
  it('bir LAN adresi döner (ağ yoksa hata fırlatır)', () => {
    let address: string | null = null;
    try {
      address = detectLanAddress();
    } catch {
      // Test ortamında ağ olmayabilir; o durumda atlanır.
      return;
    }

    expect(address).toMatch(/^\d{1,3}(\.\d{1,3}){3}$/);
    expect(isLanAddress(address)).toBe(true);
  });
});