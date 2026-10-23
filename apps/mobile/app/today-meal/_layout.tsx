import { Redirect, Stack } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { useAuth } from '@/features/auth/AuthProvider';
import { RecipePreviewProvider } from '@/features/meals/RecipePreviewProvider';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';

export default function MealLayout() {
  const { session, isLoading } = useAuth();
  if (isLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;
  return <RecipePreviewProvider key={session.user.id}>
    <Stack screenOptions={{ headerShown: false, gestureEnabled: true, animation: 'slide_from_right', contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="recipe" options={({ navigation }) => ({
        headerShown: true,
        title: 'Cách nấu',
        headerBackVisible: false,
        headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => navigation.goBack()} style={s.back}>
          <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} tintColor={colors.forest} size={18} />
        </Pressable>,
        headerTintColor: colors.forest,
        headerStyle: { backgroundColor: colors.background },
        headerTitleStyle: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
        headerShadowVisible: false,
      })} />
    </Stack>
  </RecipePreviewProvider>;
}

const s = StyleSheet.create({
  back: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
});
