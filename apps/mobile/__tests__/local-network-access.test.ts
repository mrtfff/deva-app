import {
  buildNetworkSecurityConfig,
  localHosts,
} from '../plugins/withLocalNetworkAccess';

describe('localHosts', () => {
  it('Supabase adresinin host\'unu cleartext istisnasına ekler', () => {
    const hosts = localHosts('http://192.168.1.14:54321');

    expect(hosts).toContain('192.168.1.14');
    expect(hosts).toContain('127.0.0.1');
    expect(hosts).toContain('localhost');
    expect(hosts).toContain('10.0.2.2');
  });

  it('aynı hostu iki kez eklemez', () => {
    const hosts = localHosts('http://localhost:54321');

    expect(hosts.filter((host) => host === 'localhost')).toHaveLength(1);
  });

  it('geçersiz ya da eksik adresde yalnızca standart host\'lar kalır', () => {
    expect(localHosts('')).toEqual(['127.0.0.1', 'localhost', '10.0.2.2']);
    expect(localHosts('adres-degil')).toEqual(['127.0.0.1', 'localhost', '10.0.2.2']);
  });

  it('https üretim adresini cleartext istisnasına katmaz', () => {
    // Üretimde Supabase HTTPS'tir; cleartext izni yalnızca yerel host'lara verilir.
    const hosts = localHosts('https://abc.supabase.co');

    expect(hosts).not.toContain('abc.supabase.co');
    expect(hosts).toEqual(['127.0.0.1', 'localhost', '10.0.2.2']);
  });

  it('düz HTTP kullanan yerel adresi istisnaya katar', () => {
    expect(localHosts('http://192.168.1.50:54321')).toContain('192.168.1.50');
  });
});

describe('buildNetworkSecurityConfig', () => {
  const xml = buildNetworkSecurityConfig(localHosts('http://192.168.1.14:54321'));

  it('varsayılan olarak cleartext trafiği kapatır', () => {
    expect(xml).toContain('<base-config cleartextTrafficPermitted="false" />');
  });

  it('yalnızca listelenen host\'larda cleartext\'e izin verir', () => {
    expect(xml).toContain('<domain-config cleartextTrafficPermitted="true">');
    expect(xml).toContain('<domain includeSubdomains="false">192.168.1.14</domain>');
    expect(xml).toContain('<domain includeSubdomains="false">10.0.2.2</domain>');
  });

  it('geçersiz XML üretmez', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="utf-8"?>')).toBe(true);
    expect(xml.trimEnd().endsWith('</network-security-config>')).toBe(true);

    const opens = (xml.match(/<domain-config/g) ?? []).length;
    const closes = (xml.match(/<\/domain-config>/g) ?? []).length;
    expect(opens).toBe(closes);
  });
});