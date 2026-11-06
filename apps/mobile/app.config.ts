import type { ExpoConfig, ConfigContext } from 'expo/config';

const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'DEVA',
  slug: 'deva',
  scheme: 'deva',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  icon: './assets/images/icon.png',
  ios: {
    supportsTablet: true,
  },
  android: {
    package: 'app.deva.mobile',
    adaptiveIcon: {
      backgroundColor: '#E4EEE9',
      foregroundImage: './assets/images/android-icon-foreground.png',
      monochromeImage: './assets/images/android-icon-monochrome.png',
    },
    ...(googleMapsApiKey ? { googleMaps: { apiKey: googleMapsApiKey } } : {}),
  },
  web: {
    output: 'static',
    favicon: './assets/images/favicon.png',
  },
  plugins: [
    'expo-router',
    'expo-notifications',
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'DEVA, yakınındaki uzmana yönlendirme yapabilmek için konumunu kullanır.',
      },
    ],
    'expo-secure-store',
    'expo-maps',
    '@react-native-community/datetimepicker',
    './plugins/withLocalNetworkAccess',
  ],
  experiments: {
    typedRoutes: true,
  },
});