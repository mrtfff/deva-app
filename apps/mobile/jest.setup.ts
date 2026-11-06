/**
 * Yerel modüllerin jest ortamında takılmasını önleyen mock'lar.
 * Uygulama davranışı değişmez; yalnızca testlerin native modül gerektirmemesi sağlanır.
 */

jest.mock('@react-native-async-storage/async-storage', () =>
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- Jest mock fabrikası CJS modül yükler
  require('@react-native-async-storage/async-storage/jest/async-storage-mock.js'),
);

jest.mock('expo-notifications', () => ({
  setNotificationHandler: jest.fn(),
  setNotificationChannelAsync: jest.fn(async () => undefined),
  requestPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: 'granted' })),
  getPermissionsAsync: jest.fn(async () => ({ granted: true, canAskAgain: true, status: 'granted' })),
  scheduleNotificationAsync: jest.fn(async () => 'scheduled-id'),
  cancelScheduledNotificationAsync: jest.fn(async () => undefined),
  cancelAllScheduledNotificationsAsync: jest.fn(async () => undefined),
  getAllScheduledNotificationsAsync: jest.fn(async () => []),
  addNotificationResponseReceivedListener: jest.fn(() => ({ remove: jest.fn() })),
  SchedulableTriggerInputTypes: { DATE: 'date' },
  AndroidImportance: { DEFAULT: 3 },
}));

jest.mock('expo-location', () => ({
  Accuracy: { Balanced: 3 },
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted', granted: true })),
  getCurrentPositionAsync: jest.fn(async () => ({
    coords: { latitude: 41.0082, longitude: 28.9784 },
  })),
}));

jest.mock('expo/fetch', () => ({
  fetch: jest.fn(),
}));

jest.mock('expo-router', () => {
  return {
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismiss: jest.fn() },
    useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), dismiss: jest.fn() }),
    useLocalSearchParams: () => ({}),
    useSegments: () => [],
    Redirect: () => null,
    Link: () => null,
    Stack: Object.assign(() => null, { Screen: () => null }),
    Tabs: Object.assign(() => null, { Screen: () => null }),
  };
});

jest.mock('./lib/supabase', () => {
  const chain = {
    select: () => chain,
    insert: () => chain,
    update: () => chain,
    upsert: () => chain,
    delete: () => chain,
    eq: () => chain,
    gte: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => chain,
    single: async () => ({ data: null, error: null }),
    maybeSingle: async () => ({ data: null, error: null }),
    then: (resolve: (value: unknown) => unknown) => resolve({ data: null, error: null }),
  };

  return {
    supabase: {
      from: () => chain,
      rpc: async () => ({ data: null, error: null }),
      auth: {
        getSession: async () => ({
          data: {
            session: {
              access_token: 'test-token',
              user: { id: 'user-1', email: 'test@deva.app' },
            },
          },
        }),
        getUser: async () => ({ data: { user: { id: 'user-1', email: 'test@deva.app' } } }),
        signOut: async () => ({ error: null }),
        onAuthStateChange: () => ({
          data: { subscription: { unsubscribe: () => undefined } },
        }),
      },
    },
    PHONE_AUTH_ENABLED: false,
  };
});