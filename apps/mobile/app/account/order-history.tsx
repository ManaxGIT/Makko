import { Redirect } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import OrdersScreen from '@/features/orders/OrdersScreen';

export default function OrderHistoryScreen() {
  const { isLoading, session } = useAuth();
  if (isLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;
  return <OrdersScreen key={session.user.id} history />;
}
