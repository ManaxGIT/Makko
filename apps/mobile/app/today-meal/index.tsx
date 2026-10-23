import { Redirect } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { TodayMealScreen } from '@/features/meals/TodayMealScreen';

export default function Screen() {
  const { session, isLoading } = useAuth();
  if (isLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;
  return <TodayMealScreen key={session.user.id} userId={session.user.id} />;
}
