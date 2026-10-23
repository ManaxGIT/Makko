import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';

export function OrderScreenHeader({ title, onBack, backLabel = 'Quay lại' }: { title: string; onBack?: () => void; backLabel?: string }) {
  const router = useRouter();
  return <View style={s.header}>
    <Pressable accessibilityRole="button" accessibilityLabel={backLabel} onPress={onBack ?? (() => router.back())} style={s.back}>
      <SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={19} tintColor={colors.forest} fallback={<Text style={s.arrow}>‹</Text>} />
    </Pressable>
    <Text style={s.title}>{title}</Text><View style={s.spacer} />
  </View>;
}
const s = StyleSheet.create({
  header: { height: 60, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }, spacer: { width: 34 },
  title: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, lineHeight: lineHeights.body, color: colors.forest }, arrow: { color: colors.forest, fontSize: fontSizes.pageTitle },
});
