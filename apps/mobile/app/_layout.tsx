import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  BeVietnamPro_400Regular,
  BeVietnamPro_700Bold,
  BeVietnamPro_800ExtraBold,
  useFonts as useBeVietnamProFonts,
} from '@expo-google-fonts/be-vietnam-pro';
import {
  Lora_700Bold,
  useFonts as useLoraFonts,
} from '@expo-google-fonts/lora';

import { AuthProvider } from '@/features/auth/AuthProvider';

export default function RootLayout() {
  const [beVietnamProLoaded] = useBeVietnamProFonts({
    BeVietnamPro_400Regular,
    BeVietnamPro_700Bold,
    BeVietnamPro_800ExtraBold,
  });
  const [loraLoaded] = useLoraFonts({ Lora_700Bold });

  if (!beVietnamProLoaded || !loraLoaded) {
    return null;
  }

  return (
    <AuthProvider>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </AuthProvider>
  );
}
