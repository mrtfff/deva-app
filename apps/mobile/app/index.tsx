import { Redirect } from 'expo-router';
import { useAuth } from '../lib/auth';

export default function Index() {
  const { user, profile, loading } = useAuth();

  if (loading) return null;
  if (!user) return <Redirect href="/auth" />;
  if (!profile?.onboarding_completed) return <Redirect href="/onboarding" />;
  return <Redirect href="/(tabs)" />;
}