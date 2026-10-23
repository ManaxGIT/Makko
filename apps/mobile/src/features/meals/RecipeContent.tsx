import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, letterSpacing, lineHeights } from '@/theme/typography';
import type { RecipeSnapshot } from './api';

export function RecipeContent({ recipe, saved = false }: { recipe: RecipeSnapshot; saved?: boolean }) {
  return <ScrollView contentContainerStyle={s.content}>
    <Text style={s.eyebrow}>{saved ? 'CÔNG THỨC THEO ĐƠN' : 'CÁCH NẤU BỮA ĐÃ CHỌN'}</Text>
    <Text style={s.heading}>{recipe.title}</Text>
    <Text style={s.meta}>{recipe.servings} người · Khoảng {recipe.cookingMinutes} phút</Text>
    {saved && <View style={s.notice}><Text style={s.small}>Công thức của bữa đã chọn khi đăng đơn. Danh sách mua có thể đã được bạn chỉnh sửa; hãy đối chiếu nguyên liệu trước khi nấu.</Text></View>}
    <Text style={s.section}>Nguyên liệu dùng để nấu</Text>
    <View style={s.card}>{recipe.ingredients.map((i, index) => <View key={`${index}-${i.name}`} style={s.row}><Text style={s.ingredient}>{i.name}</Text><Text style={s.quantity}>{i.quantity.toLocaleString('vi-VN')} {i.unit}</Text></View>)}</View>
    <Text style={s.small}>Đây là lượng dùng khi nấu, có thể ít hơn lượng mua. Bao gồm cả nguyên liệu đã có trong bếp.</Text>
    <Text style={s.section}>Các bước chế biến</Text>
    {recipe.steps.map((step, index) => <View key={index} style={s.step}><View style={s.number}><Text style={s.numberText}>{index + 1}</Text></View><Text style={s.stepText}>{step}</Text></View>)}
  </ScrollView>;
}
const s = StyleSheet.create({
  content: { padding: 20, paddingBottom: 30 }, eyebrow: { fontFamily: fontFamilies.bodyExtraBold, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, letterSpacing: letterSpacing.eyebrow, color: colors.coral },
  heading: { fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle, lineHeight: lineHeights.pageTitle, color: colors.forest, marginTop: 10 }, meta: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.muted, marginTop: 10, marginBottom: 8 },
  notice: { padding: 13, borderRadius: 13, backgroundColor: colors.cream, marginTop: 12 }, small: { fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.bodySmall, color: colors.muted },
  section: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, lineHeight: lineHeights.body, color: colors.forest, marginTop: 24, marginBottom: 12 },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 14, marginBottom: 10 }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 15, paddingVertical: 5 },
  ingredient: { flex: 1, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest }, quantity: { maxWidth: '40%', fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.muted, textAlign: 'right' },
  step: { flexDirection: 'row', gap: 12, marginBottom: 20 }, number: { width: 26, height: 26, borderRadius: 9, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, numberText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, color: colors.coral }, stepText: { flex: 1, fontFamily: fontFamilies.body, fontSize: fontSizes.body, lineHeight: lineHeights.bodyLarge, color: colors.text },
});
