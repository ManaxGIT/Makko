import { Redirect } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { CreateRequestScreen } from '@/features/create-request/CreateRequestScreen';

export default function Screen() {
  const { isLoading, session } = useAuth();
  if (isLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;
  return <CreateRequestScreen step={1} />;
}
