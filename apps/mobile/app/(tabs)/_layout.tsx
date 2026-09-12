import { Redirect, Tabs } from 'expo-router';

import { AppTabBar } from '@/components/navigation/AppTabBar';
import { useAuth } from '@/features/auth/AuthProvider';

export default function TabsLayout() {
  const { isLoading, session } = useAuth();

  if (isLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;

  return (
    <Tabs
      tabBar={(props) => <AppTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Trang chủ' }} />
      <Tabs.Screen name="explore" options={{ title: 'Khám phá' }} />
      <Tabs.Screen name="create" options={{ title: 'Tạo yêu cầu' }} />
      <Tabs.Screen name="orders" options={{ title: 'Đơn hàng' }} />
      <Tabs.Screen name="profile" options={{ title: 'Tài khoản' }} />
    </Tabs>
  );
}
