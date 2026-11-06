/**
 * Expo Go'da bazı native modüller kurulu değil ve bu modülleri import etmek
 * **uygulamayı açılışta** çökertiyor (expo-notifications, expo-maps).
 *
 * Bu test iki şeyi garanti eder:
 *   1. Expo Go ortamında `lib/*` modülleri hiçbir native modülü yüklemez.
 *   2. **Bütün route modülleri** Expo Go'da hatasız yüklenir — yani ileride
 *      eklenen bir ekran statik native import getirirse burada patlar.
 */

const path = require('node:path');
const fs = require('node:fs');

const APP_DIR = path.join(__dirname, '..', 'app');

function routeModules(): string[] {
  const found: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) found.push(full);
    }
  };
  walk(APP_DIR);
  return found.sort();
}

/** Expo Go ortamı: native modüller yok, bu modüller import edilirse patlar. */
function simulateExpoGo() {
  jest.resetModules();

  jest.doMock('expo-constants', () => ({
    ...jest.requireActual('expo-constants'),
    executionEnvironment: 'storeClient',
  }));
  jest.doMock('expo-modules-core', () => ({
    ...jest.requireActual('expo-modules-core'),
    requireOptionalNativeModule: () => null,
  }));

  for (const moduleName of ['expo-notifications', 'expo-maps']) {
    jest.doMock(moduleName, () => {
      throw new Error(`${moduleName} Expo Go içinde yüklenemez`);
    });
  }
}

afterEach(() => {
  jest.dontMock('expo-constants');
  jest.dontMock('expo-modules-core');
  jest.dontMock('expo-notifications');
  jest.dontMock('expo-maps');
});

describe('Expo Go ortamı', () => {
  it('lib/notifications hiçbir native modül yüklemiyor', () => {
    simulateExpoGo();

    const notifications = require('../lib/notifications');

    expect(notifications.isExpoGo).toBe(true);
  });

  it('lib/maps haritayı kapalı verir ve expo-maps yüklemez', () => {
    simulateExpoGo();

    const maps = require('../lib/maps');

    expect(maps.isNativeMapsAvailable).toBe(false);
    expect(maps.isMapsAvailable).toBe(false);
    expect(maps.loadGoogleMapsView()).toBeNull();
    expect(maps.mapsUnavailableReason()).toContain('Haritada aç');
  });

  it('harita ekranı Expo Go\'da hatasız yükleniyor', () => {
    simulateExpoGo();

    const mapScreen = require('../app/facilities/map');

    expect(typeof mapScreen.default).toBe('function');
  });

  it('bütün route modülleri Expo Go\'da hatasız yükleniyor', () => {
    simulateExpoGo();

    const modules = routeModules();
    expect(modules.length).toBeGreaterThan(10);

    const failures: string[] = [];
    for (const file of modules) {
      try {
        require(file);
      } catch (error) {
        failures.push(`${path.relative(APP_DIR, file)}: ${(error as Error).message}`);
      }
    }

    expect(failures).toEqual([]);
  });
});

describe('gerçek uygulama derlemesi', () => {
  it('anahtar ve native modül varsa harita yükleniyor', () => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY = 'test-google-key';

    jest.doMock('expo-modules-core', () => ({
      ...jest.requireActual('expo-modules-core'),
      requireOptionalNativeModule: () => ({}),
    }));

    const View = () => null;
    jest.doMock('expo-maps', () => ({ GoogleMaps: { View } }));

    const maps = require('../lib/maps');

    expect(maps.isNativeMapsAvailable).toBe(true);
    expect(maps.isMapsAvailable).toBe(true);
    expect(maps.loadGoogleMapsView()).toBe(View);

    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;
  });

  it('native modül olsa bile anahtar yoksa harita yüklenmiyor', () => {
    jest.resetModules();
    delete process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY;

    jest.doMock('expo-modules-core', () => ({
      ...jest.requireActual('expo-modules-core'),
      requireOptionalNativeModule: () => ({}),
    }));
    jest.doMock('expo-maps', () => {
      throw new Error('anahtar yokken expo-maps yüklenmemeli');
    });

    const maps = require('../lib/maps');

    expect(maps.isMapsAvailable).toBe(false);
    expect(maps.loadGoogleMapsView()).toBeNull();
    expect(maps.mapsUnavailableReason()).toContain('anahtar');
  });
});