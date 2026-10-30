import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { BasketArt, s } from './FoodUI';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';
export function WeeklyFoodEntry() {
    const router = useRouter();
    return <View style={styles.card}><Text style={s.eyebrow}>GÓI NGUYÊN LIỆU TUẦN</Text><View style={styles.copy}><Text style={styles.title}>Một giỏ đầy.{`\n`}Bảy ngày ngon.</Text><Text style={s.body}>Nguyên liệu đủ 7 ngày,{`\n`}Makko chuẩn bị sẵn.</Text></View><View pointerEvents="none" style={styles.art}><BasketArt /></View><Text style={[s.bold, { marginTop: 12 }]}>Giao chậm nhất Chủ nhật</Text><Pressable accessibilityRole="button" onPress={() => router.push('/weekly-food')} style={({ pressed }) => [styles.button, pressed && s.dim]}><Text style={s.buttonText}>Xem gói tuần</Text><Text style={s.buttonText}>→</Text></Pressable></View>;
}
const styles = StyleSheet.create({
    card: { backgroundColor: colors.cream, borderWidth: 1, borderColor: colors.goldLight, borderRadius: 26, padding: 20, marginHorizontal: 20, marginTop: 16, overflow: 'hidden' },
    copy: { paddingTop: 14, gap: 12, maxWidth: '69%', zIndex: 1 },
    title: { fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle, lineHeight: lineHeights.pageTitle, color: colors.forest },
    art: { position: 'absolute', right: -5, top: 30, transform: [{ scale: 0.9 }] },
    button: { backgroundColor: colors.orange, borderRadius: 14, minHeight: 52, paddingHorizontal: 16, marginTop: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
