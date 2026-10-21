import { useEffect } from 'react';
import { Redirect, Stack, useLocalSearchParams, useNavigation } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { CreateRequestProvider, useCreateRequest } from '@/features/create-request/CreateRequestProvider';

export default function EditLayout() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isLoading } = useAuth();
  if (isLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;
  if (!id) return <Redirect href="/(tabs)/orders" />;
  return <CreateRequestProvider editId={id}><EditStack /></CreateRequestProvider>;
}

function EditStack() {
  const { requestLocked } = useCreateRequest();
  const navigation = useNavigation();
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !requestLocked });
    return () => navigation.setOptions({ gestureEnabled: true });
  }, [navigation, requestLocked]);
  return <Stack screenOptions={{ headerShown: false }} />;
}
