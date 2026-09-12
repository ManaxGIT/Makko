import { Redirect } from 'expo-router';

import { useAuth } from '@/features/auth/AuthProvider';

export default function Index() {
  const { isLoading, session } = useAuth();

  if (isLoading) return null;

  return <Redirect href={session ? '/(tabs)' : '/auth'} />;
}
