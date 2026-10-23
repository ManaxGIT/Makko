import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/AuthProvider';
import { getOrderRecipe, RecipeSnapshot } from '@/features/meals/api';
import { RecipeContent } from '@/features/meals/RecipeContent';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';

export default function Screen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session, isLoading } = useAuth();
  if (isLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;
  return <OrderRecipe key={`${session.user.id}:${id}`} id={id} />;
}
function OrderRecipe({ id }: { id: string }) {
  const router = useRouter();
  const [recipe, setRecipe] = useState<RecipeSnapshot | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [loading, setLoading] = useState(true);
  const sequence = useRef(0);
  useEffect(() => {
    const version = ++sequence.current;
    setLoading(true); setError('');
    getOrderRecipe(id).then(value => { if (sequence.current === version) setRecipe(value); })
      .catch(() => { if (sequence.current === version) setError('Không xem được công thức. Công thức chỉ dành cho người đăng đơn và chỉ có ở đơn đã lưu công thức.'); })
      .finally(() => { if (sequence.current === version) setLoading(false); });
    return () => { sequence.current++; };
  }, [id, attempt]);
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}><View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/orders')} style={s.back}><Text style={s.backText}>‹</Text></Pressable><Text style={s.title}>Cách nấu</Text></View>
    {recipe ? <RecipeContent recipe={recipe} saved /> : <View style={s.state}>{loading ? <ActivityIndicator color={colors.coral} /> : <><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(n => n + 1)} style={s.retry}><Text style={s.title}>Thử lại</Text></Pressable></>}</View>}
  </SafeAreaView>;
}
const s = StyleSheet.create({ safe: { flex: 1, backgroundColor: colors.background }, header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 20, paddingVertical: 12 }, back: { backgroundColor: colors.surface, width: 36, height: 36, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, backText: { fontFamily: fontFamilies.body, fontSize: fontSizes.pageTitle, color: colors.forest }, title: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, color: colors.forest }, state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }, error: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.body, textAlign: 'center', color: colors.muted }, retry: { padding: 14, borderRadius: 12, backgroundColor: colors.orange } });
