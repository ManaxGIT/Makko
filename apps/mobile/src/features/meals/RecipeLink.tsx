import { Pressable, StyleSheet, Text } from 'react-native';
import { SymbolView } from 'expo-symbols';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';

export function RecipeLink({ onPress, compact = false }: { onPress: () => void; compact?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} hitSlop={compact ? 6 : 0} style={({ pressed }) => [s.link, compact ? s.badge : s.row, pressed && s.pressed]}><SymbolView name={{ ios: 'book', android: 'menu_book', web: 'menu_book' }} size={14} tintColor={colors.statusGreen} /><Text style={s.label}>{compact ? 'Có công thức' : 'Xem cách nấu'}</Text>{!compact && <Text style={s.arrow}>→</Text>}</Pressable>;
}
const s = StyleSheet.create({
  link: { flexDirection: 'row', alignItems: 'center', gap: 6 }, badge: { alignSelf: 'flex-start', backgroundColor: colors.vegetable, borderRadius: 8, paddingVertical: 7, paddingHorizontal: 9, marginVertical: 4 }, row: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, marginTop: 4, minHeight: 44 },
  label: { fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, color: colors.statusGreen }, arrow: { marginLeft: 'auto', fontFamily: fontFamilies.body, fontSize: fontSizes.body, color: colors.statusGreen }, pressed: { opacity: 0.65 },
});
