import { useEffect } from 'react';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import { AuthProvider, useAuth } from '../lib/auth';
import { ThemeProvider, useTheme } from '../components/ThemeProvider';
import {
  addNotificationResponseListener,
  configureNotifications,
  syncAllNotifications,
} from '../lib/notifications';

function NotificationsBridge() {
  const { user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    void configureNotifications();
  }, []);

  useEffect(() => {
    if (user) void syncAllNotifications(user.id);
  }, [user]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active' && user) void syncAllNotifications(user.id);
    });
    return () => subscription.remove();
  }, [user]);

  useEffect(() => {
    const subscription = addNotificationResponseListener((url) => {
      router.push(url as never);
    });
    return () => subscription.remove();
  }, [router]);

  return null;
}

function RootStack() {
  const { theme } = useTheme();

  return (
    <>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: theme.colors.bg },
          headerTintColor: theme.colors.text,
          headerTitleStyle: { fontWeight: '600' },
          contentStyle: { backgroundColor: theme.colors.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="terms" options={{ title: 'Kullanım Şartları ve KVKK' }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="chat/history" options={{ title: 'Sohbet geçmişi' }} />
        <Stack.Screen name="chat/[id]" options={{ title: 'Sohbet' }} />
        <Stack.Screen name="facilities/index" options={{ title: 'Uzmanlar' }} />
        <Stack.Screen name="facilities/map" options={{ title: 'Harita' }} />
        <Stack.Screen name="facilities/[id]" options={{ title: 'Kurum' }} />
        <Stack.Screen name="memory" options={{ title: 'DEVA’nın senden hatırladıkları' }} />
        <Stack.Screen name="appointments" options={{ title: 'Randevularım' }} />
        <Stack.Screen
          name="crisis"
          options={{
            title: 'Yalnız değilsin',
            presentation: Platform.OS === 'ios' ? 'modal' : 'card',
          }}
        />
        <Stack.Screen name="screening/[code]" options={{ headerShown: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <NotificationsBridge />
          <RootStack />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}