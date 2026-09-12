import type { ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

const items = [
  { label: '🥬 Rau muống · 2 bó', price: '~24.000đ' },
  { label: '🥩 Thịt ba chỉ · 500g', price: '~75.000đ' },
  { label: '🥚 Trứng gà · 10 quả', price: '~32.000đ' },
];

function AppIcon({ name, color = colors.coral, size = 16 }: {
  name: SymbolName;
  color?: string;
  size?: number;
}) {
  return <SymbolView name={name} size={size} tintColor={color} fallback={<Text style={{ color, fontSize: size }}>•</Text>} />;
}

function SummaryRow({ icon, label, value }: { icon: SymbolName; label: string; value: string }) {
  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryIcon}><AppIcon name={icon} /></View>
      <View>
        <Text style={styles.summaryLabel}>{label}</Text>
        <Text style={styles.summaryValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function ReviewRequestScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <AppIcon name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} color={colors.text} size={18} />
        </Pressable>
        <Text style={styles.headerTitle}>Kiểm tra lại</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/create')} style={({ pressed }) => [styles.editHeaderButton, pressed && styles.pressed]}>
          <Text style={styles.editHeaderText}>Sửa</Text>
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        <View style={styles.progressDone} />
        <View style={styles.progressDone} />
        <View style={styles.progressDone} />
        <View style={styles.progressDone} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.step}>BƯỚC 4/4 · XÁC NHẬN</Text>
        <Text style={styles.heading}>Sẵn sàng đăng yêu cầu?</Text>

        <LinearGradient colors={['#FFF3D7', '#FFE2B9']} end={{ x: 1, y: 0.5 }} start={{ x: 0, y: 0.5 }} style={styles.requestHero}>
          <Text style={styles.basket}>🧺</Text>
          <View style={styles.heroCopy}>
            <Text style={styles.heroEyebrow}>YÊU CẦU CỦA BẠN</Text>
            <Text style={styles.heroTitle}>Bữa cơm chiều cho gia đình</Text>
            <Text style={styles.heroSubtitle}>Chợ Bến Thành · 5 món</Text>
          </View>
        </LinearGradient>

        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>Danh sách đi chợ</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/create/items')}><Text style={styles.editText}>Sửa</Text></Pressable>
          </View>
          {items.map((item) => (
            <View key={item.label} style={styles.itemRow}>
              <Text style={styles.itemLabel}>{item.label}</Text>
              <Text style={styles.itemPrice}>{item.price}</Text>
            </View>
          ))}
          <Pressable accessibilityRole="button" style={({ pressed }) => [styles.moreButton, pressed && styles.pressed]}>
            <Text style={styles.moreText}>＋ 2 món khác</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <SummaryRow icon={{ ios: 'house', android: 'home', web: 'home' }} label="Giao đến" value="12 Nguyễn Huệ, P. Bến Nghé" />
          <SummaryRow icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }} label="Nhận trước" value="17:30 · Ngày mai, 13/09" />
          <SummaryRow icon={{ ios: 'banknote', android: 'payments', web: 'payments' }} label="Phí đi chợ" value="32.000đ" />
        </View>

        <View style={styles.estimateRow}>
          <View>
            <Text style={styles.estimateLabel}>Tạm tính tiền hàng</Text>
            <Text style={styles.estimateValue}>Khoảng 228.000đ</Text>
          </View>
          <Text style={styles.feeText}>＋ 32.000đ phí</Text>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Text style={styles.agreement}>Bằng việc đăng, bạn đồng ý với quy tắc cộng đồng Makko.</Text>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/create/success')} style={({ pressed }) => [styles.publishButton, pressed && styles.pressed]}>
          <Text style={styles.publishText}>Đăng yêu cầu</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', height: 64, justifyContent: 'space-between', paddingHorizontal: 20 },
  backButton: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 11, height: 34, justifyContent: 'center', width: 34 },
  headerTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
  editHeaderButton: { alignItems: 'flex-end', justifyContent: 'center', minHeight: 34, width: 78 },
  editHeaderText: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.actionLarge },
  progressTrack: { flexDirection: 'row', gap: 3, height: 3, paddingHorizontal: 20 },
  progressDone: { backgroundColor: colors.orange, flex: 1 },
  scrollContent: { gap: 7, paddingBottom: 26, paddingHorizontal: 20, paddingTop: 18 },
  step: { color: colors.coral, fontFamily: fontFamilies.bodyExtraBold, fontSize: fontSizes.caption, letterSpacing: 1.04 },
  heading: { color: colors.text, fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle, lineHeight: 32, marginBottom: 1 },
  requestHero: { alignItems: 'center', borderColor: colors.border, borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 11, minHeight: 82, paddingHorizontal: 12, paddingVertical: 12 },
  basket: { fontSize: 32 },
  heroCopy: { gap: 3 },
  heroEyebrow: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, letterSpacing: 0.6 },
  heroTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, marginTop: 2 },
  heroSubtitle: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 15, borderWidth: 1, gap: 7, paddingBottom: 12, paddingHorizontal: 12, paddingTop: 14 },
  cardHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  cardTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  editText: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  itemRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  itemLabel: { color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  itemPrice: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption },
  moreButton: { alignSelf: 'flex-start', justifyContent: 'center', minHeight: 27 },
  moreText: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  summaryRow: { alignItems: 'center', flexDirection: 'row', gap: 9, minHeight: 34 },
  summaryIcon: { alignItems: 'center', backgroundColor: colors.background, borderRadius: 8, height: 27, justifyContent: 'center', width: 27 },
  summaryLabel: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  summaryValue: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, marginTop: 3 },
  estimateRow: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2, paddingTop: 7 },
  estimateLabel: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  estimateValue: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, marginTop: 3 },
  feeText: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  footer: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, gap: 11, paddingHorizontal: 20, paddingVertical: 14 },
  agreement: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, letterSpacing: 0.48, textAlign: 'center' },
  publishButton: { alignItems: 'center', backgroundColor: colors.orange, borderRadius: 12, height: 44, justifyContent: 'center' },
  publishText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall },
  pressed: { opacity: 0.65 },
});
