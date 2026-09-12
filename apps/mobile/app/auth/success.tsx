import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, PrimaryButton, SecondaryButton } from '@/components/auth/AuthUI';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, letterSpacing, lineHeights } from '@/theme/typography';

export default function AuthSuccessScreen() {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <LinearGradient colors={['#FFE0A5', '#FFF1D0', colors.background]} locations={[0, 0.52, 0.53]} style={styles.background}>
        <View style={styles.brandArea}><Brand completed /></View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>CHÀO MỪNG ĐẾN MAKKO</Text>
          <Text style={styles.title}>Xin chào,{`\n`}hàng xóm mới!</Text>
          <Text style={styles.subtitle}>Tài khoản đã sẵn sàng. Hãy bắt đầu bằng một lời nhờ hoặc giúp ai đó tiện đường nhé.</Text>
        </View>
        <View style={styles.actionsCard}>
          <Pressable onPress={() => router.replace('/(tabs)/explore')} style={styles.actionRow}><Text style={styles.number}>1</Text><Text style={styles.actionLabel}>Khám phá yêu cầu gần bạn</Text><Text style={styles.chevron}>›</Text></Pressable>
          <View style={styles.divider} />
          <Pressable onPress={() => router.replace('/(tabs)/create')} style={styles.actionRow}><Text style={styles.number}>2</Text><Text style={styles.actionLabel}>Tạo yêu cầu đầu tiên</Text><Text style={styles.chevron}>›</Text></Pressable>
        </View>
        <View style={styles.footer}>
          <PrimaryButton onPress={() => router.replace('/(tabs)/explore')}>Khám phá Makko</PrimaryButton>
          <SecondaryButton onPress={() => router.replace('/(tabs)')}>Thiết lập địa chỉ sau</SecondaryButton>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFE0A5', flex: 1 }, background: { flex: 1, paddingHorizontal: 28 },
  brandArea: { alignItems: 'center', height: '35%', justifyContent: 'center' },
  copy: { alignItems: 'center', gap: 8 }, eyebrow: { color: colors.coral, fontFamily: fontFamilies.bodyExtraBold, fontSize: fontSizes.bodySmall, letterSpacing: letterSpacing.eyebrow },
  title: { color: colors.text, fontFamily: fontFamilies.display, fontSize: fontSizes.display, lineHeight: lineHeights.display, textAlign: 'center' }, subtitle: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, textAlign: 'center' },
  actionsCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 15, borderWidth: 1, marginTop: 24, paddingHorizontal: 13, paddingVertical: 5 },
  actionRow: { alignItems: 'center', flexDirection: 'row', height: 50 }, number: { backgroundColor: colors.cream, borderRadius: 9, color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, overflow: 'hidden', paddingHorizontal: 10, paddingVertical: 8 }, actionLabel: { color: colors.text, flex: 1, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, marginLeft: 10 }, chevron: { color: colors.text, fontSize: 16 }, divider: { backgroundColor: colors.border, height: 1 },
  footer: { bottom: 16, left: 20, position: 'absolute', right: 20 },
});
