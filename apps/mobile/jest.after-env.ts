/**
 * React 19 `act(...)` ortam bayrağı. Bu olmadan RTL'nin state güncellemeleri
 * "act(...) içine sarılmadı" uyarısı üretir ve asenkron render'lar yanlış
 * zamanlamayla değerlendirilir.
 */
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

/**
 * Expo'nun winter polyfill'leri `install()` ile lazy getter olarak kuruluyor ve
 * getter ilk okunduğunda `require` çalıştırıyor. Bu okuma teardown aşamasına
 * kalırsa jest "test kodu dışında import" hatası veriyor.
 *
 * `beforeAll` test yaşam döngüsünün içinde çalıştığı için tüm getter'ları burada
 * bir kez tetikleyip çözülmüş hâlde saklıyoruz.
 */
const WINTER_GLOBALS = [
  'TextDecoder',
  'TextDecoderStream',
  'TextEncoderStream',
  'URL',
  'URLSearchParams',
  'DOMException',
  '__ExpoImportMetaRegistry',
  'structuredClone',
] as const;

function resolveWinterGlobals() {
  const globals = globalThis as unknown as Record<string, unknown>;
  for (const key of WINTER_GLOBALS) void globals[key];
}

// `jest.resetModules()` sonrasında expo yeniden yüklendiğinde getter'lar tekrar
// kurulur; bu yüzden hem testlerden önce hem de teardown'dan önce çözülürler.
beforeAll(resolveWinterGlobals);
afterAll(resolveWinterGlobals);