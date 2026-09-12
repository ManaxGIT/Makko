import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

function AppIcon({ name, color = colors.coral, size = 16 }: {
  name: SymbolName;
  color?: string;
  size?: number;
}) {
  return <SymbolView name={name} size={size} tintColor={color} fallback={<Text style={{ color, fontSize: size }}>•</Text>} />;
}

function InfoRow({ icon, label, value, last = false }: {
  icon: SymbolName;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last && styles.infoRowBorder]}>
      <AppIcon name={icon} />
      <View style={styles.infoCopy}>
        <Text style={styles.infoLabel}>{label}</Text>
        <Text style={styles.infoValue}>{value}</Text>
      </View>
    </View>
  );
}

export default function CreateSuccessScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <LinearGradient colors={['#FFE5B3', '#FFF5DF', colors.background]} locations={[0, 0.45, 0.7]} style={styles.background}>
        <View style={styles.illustration}>
          <View style={styles.outerCircle} />
          <View style={styles.innerCircle} />
          <Text style={styles.basket}>🧺</Text>
          <View style={styles.checkBadge}><Text style={styles.check}>✓</Text></View>
        </View>

        <View style={styles.successCopy}>
          <Text style={styles.heading}>Đăng yêu cầu{`\n`}thành công</Text>
          <Text style={styles.subtitle}>
            Makko đang tìm người đi chợ phù hợp gần bạn. Thường chỉ mất{`\n`}khoảng 5–10 phút.
          </Text>
        </View>

        <View style={styles.infoCard}>
          <View style={[styles.requestNameBlock, styles.infoRowBorder]}>
            <Text style={styles.infoLabel}>TÊN YÊU CẦU</Text>
            <Text style={styles.requestName}>Bữa cơm chiều cho gia đình</Text>
          </View>
          <InfoRow
            icon={{ ios: 'clock', android: 'schedule', web: 'schedule' }}
            label="GIAO TRƯỚC"
            value="17:30 · Ngày mai"
          />
          <InfoRow
            icon={{ ios: 'location', android: 'my_location', web: 'my_location' }}
            label="ĐỊA CHỈ"
            last
            value="12 Nguyễn Huệ, Quận 1"
          />
        </View>

        <View style={styles.searchingCard}>
          <View style={styles.statusDot}><View style={styles.statusDotHalo} /></View>
          <View>
            <Text style={styles.searchingTitle}>Đang tìm người đi chợ…</Text>
            <Text style={styles.searchingSubtitle}>Bạn có thể rời màn hình này</Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)/orders')} style={({ pressed }) => [styles.primaryButton, pressed && styles.pressed]}>
            <Text style={styles.primaryText}>Xem yêu cầu của tôi</Text>
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => router.replace('/(tabs)')} style={({ pressed }) => [styles.homeButton, pressed && styles.pressed]}>
            <Text style={styles.homeText}>Về trang chủ</Text>
          </Pressable>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFE5B3', flex: 1 },
  background: { flex: 1 },
  illustration: { alignItems: 'center', height: 220, justifyContent: 'center' },
  outerCircle: { borderColor: 'rgba(177,111,35,0.18)', borderRadius: 105, borderWidth: 1, height: 210, position: 'absolute', width: 210 },
  innerCircle: { borderColor: 'rgba(177,111,35,0.18)', borderRadius: 73, borderWidth: 1, height: 145, position: 'absolute', width: 145 },
  basket: { fontSize: 72, textShadowColor: 'rgba(112,73,29,0.18)', textShadowOffset: { width: 0, height: 16 }, textShadowRadius: 7 },
  checkBadge: { alignItems: 'center', backgroundColor: colors.forest, borderColor: '#FFE5B3', borderRadius: 16, borderWidth: 4, bottom: 43, height: 31, justifyContent: 'center', position: 'absolute', right: '39%', width: 31 },
  check: { color: colors.surface, fontSize: 16 },
  successCopy: { alignItems: 'center', paddingHorizontal: 34 },
  heading: { color: colors.text, fontFamily: fontFamilies.display, fontSize: fontSizes.display, lineHeight: 34, marginTop: 8, textAlign: 'center' },
  subtitle: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: 14, marginTop: 9, textAlign: 'center' },
  infoCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 15, borderWidth: 1, marginHorizontal: 20, marginTop: 24, paddingHorizontal: 13, paddingVertical: 7 },
  requestNameBlock: { paddingBottom: 9, paddingTop: 6 },
  requestName: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, marginTop: 3 },
  infoRow: { alignItems: 'center', flexDirection: 'row', gap: 9, paddingVertical: 8 },
  infoRowBorder: { borderBottomColor: colors.border, borderBottomWidth: 1 },
  infoCopy: { gap: 2 },
  infoLabel: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, letterSpacing: 0.54 },
  infoValue: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption },
  searchingCard: { alignItems: 'center', backgroundColor: '#EDF3E9', borderRadius: 13, flexDirection: 'row', gap: 11, marginHorizontal: 20, marginTop: 13, padding: 12 },
  statusDot: { backgroundColor: '#55A56D', borderRadius: 6, height: 12, width: 12 },
  statusDotHalo: { borderColor: 'rgba(85,165,109,0.14)', borderRadius: 12, borderWidth: 6, height: 24, left: -6, position: 'absolute', top: -6, width: 24 },
  searchingTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  searchingSubtitle: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, marginTop: 2 },
  footer: { bottom: 10, gap: 7, left: 20, position: 'absolute', right: 20 },
  primaryButton: { alignItems: 'center', backgroundColor: colors.orange, borderRadius: 12, height: 42, justifyContent: 'center' },
  primaryText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  homeButton: { alignItems: 'center', borderRadius: 12, height: 42, justifyContent: 'center' },
  homeText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  pressed: { opacity: 0.65 },
});
