const expoPreset = require('jest-expo/jest-preset');

// Expo'nun winter fetch kurulumu, jest kökü dışındaki bir dosyayı `require`
// etmeye çalışıyor. Testlerde React Native'ın fetch polyfill'i yeterli.
process.env.EXPO_PUBLIC_USE_RN_FETCH = 'true';

/**
 * jest-expo preset'i `setupFiles` ve `transformIgnorePatterns` tanımlar;
 * bunları doğrudan ezmemek için preset yayılır ve yalnızca eklenecekler
 * üstüne konur.
 *
 * `_shared` node_modules dışında bir klasörde olduğu için `@shared/*` alias'ı
 * Metro'daki hedefle aynı yere işaret eder.
 */
module.exports = {
  ...expoPreset,
  moduleNameMapper: {
    ...expoPreset.moduleNameMapper,
    '^@shared/(.*)$': '<rootDir>/../../supabase/functions/_shared/$1',
  },
  setupFiles: [...expoPreset.setupFiles, '<rootDir>/jest.setup.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest.after-env.ts'],
  testMatch: ['<rootDir>/__tests__/**/*.test.ts?(x)'],
  transformIgnorePatterns: expoPreset.transformIgnorePatterns,
};