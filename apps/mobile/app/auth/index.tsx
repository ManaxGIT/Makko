import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Brand, PrimaryButton, SecondaryButton } from '@/components/auth/AuthUI';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, letterSpacing, lineHeights } from '@/theme/typography';

export default function WelcomeScreen() {
  const router = useRouter();
  return (
    <SafeAreaView edges={['top', 'bottom']} style={styles.safeArea}>
      <LinearGradient colors={['#FFE0A5', '#FFF1D0', colors.background]} locations={[0, 0.57, 0.58]} style={styles.gradient}>
        <View style={styles.hero}>
          <View style={[styles.floating, styles.lettuce]}><Text style={styles.emoji}>🥬</Text></View>
          <View style={[styles.floating, styles.orange]}><Text style={styles.emoji}>🍊</Text></View>
          <View style={[styles.floating, styles.carrot]}><Text style={styles.emoji}>🥕</Text></View>
          <View style={[styles.floating, styles.tomato]}><Text style={styles.emoji}>🍅</Text></View>
          <Brand />
        </View>
        <View style={styles.copy}>
          <Text style={styles.eyebrow}>CHỢ GẦN · NGƯỜI QUEN</Text>
          <Text style={styles.title}>Đi chợ giúp nhau,{`\n`}gần nhà hơn.</Text>
          <Text style={styles.subtitle}>Gửi lời nhờ đến hàng xóm hoặc tiện đường mua giúp một người gần bạn.</Text>
        </View>
        <View style={styles.footer}>
          <PrimaryButton onPress={() => router.push('/auth/register')}>Bắt đầu với Makko</PrimaryButton>
          <SecondaryButton onPress={() => router.push('/auth/login')}>Tôi đã có tài khoản</SecondaryButton>
          <Text style={styles.legal}>Bằng việc tiếp tục, bạn đồng ý với Điều khoản và Quyền riêng tư.</Text>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: '#FFE0A5', flex: 1 },
  gradient: { flex: 1, paddingHorizontal: 20 },
  hero: { alignItems: 'center', height: '45%', justifyContent: 'center', position: 'relative' },
  floating: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 15, height: 48, justifyContent: 'center', position: 'absolute', shadowColor: '#6C4C20', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.13, shadowRadius: 12, width: 48 },
  lettuce: { left: 25, top: 70 }, orange: { right: 25, top: 95 }, carrot: { bottom: 52, left: 42 }, tomato: { bottom: 44, right: 34 },
  emoji: { fontSize: 23 },
  copy: { alignItems: 'center', gap: 8, paddingHorizontal: 15, paddingTop: 24 },
  eyebrow: { color: colors.coral, fontFamily: fontFamilies.bodyExtraBold, fontSize: fontSizes.bodySmall, letterSpacing: letterSpacing.eyebrow },
  title: { color: colors.text, fontFamily: fontFamilies.display, fontSize: fontSizes.display, lineHeight: lineHeights.display, textAlign: 'center' },
  subtitle: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, textAlign: 'center' },
  footer: { bottom: 16, left: 20, position: 'absolute', right: 20 },
  legal: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, marginTop: 8, textAlign: 'center' },
});
