import { Redirect } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import AddressesScreen from '@/features/addresses/AddressesScreen';

export default function AccountAddresses() {
  const { session, isLoading } = useAuth();
  if (isLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;
  return <AddressesScreen key={session.user.id} />;
}
