import { useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AuthHeader, AuthIntro, AuthScreen, PrimaryButton } from '@/components/auth/AuthUI';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';

export default function VerifyScreen() {
  const router = useRouter();
  const [code, setCode] = useState(['4', '8', '2', '6', '', '']);
  const refs = useRef<Array<TextInput | null>>([]);
  const updateCode = (value: string, index: number) => {
    const next = [...code]; next[index] = value.slice(-1); setCode(next);
    if (value && index < 5) refs.current[index + 1]?.focus();
  };
  return (
    <AuthScreen>
      <AuthHeader />
      <View style={styles.mail}><Text style={styles.mailText}>✉</Text></View>
      <AuthIntro eyebrow="XÁC THỰC SỐ ĐIỆN THOẠI" title="Nhập mã 6 số" subtitle="Makko vừa gửi mã đến +84 912 345 678" />
      <View style={styles.codeRow}>{code.map((digit, index) => <TextInput key={index} keyboardType="number-pad" maxLength={1} onChangeText={(value) => updateCode(value, index)} ref={(ref) => { refs.current[index] = ref; }} style={[styles.codeInput, index === 3 && styles.codeActive]} value={digit} />)}</View>
      <Pressable><Text style={styles.resend}>Chưa nhận được mã? <Text style={styles.resendLink}>Gửi lại sau 00:42</Text></Text></Pressable>
      <PrimaryButton onPress={() => router.push('/auth/profile-setup')}>Xác nhận</PrimaryButton>
      <View style={styles.notice}><Text style={styles.noticeIcon}>♢</Text><Text style={styles.noticeText}><Text style={styles.noticeStrong}>Mã chỉ có hiệu lực trong 5 phút{`\n`}</Text>Không chia sẻ mã này với bất kỳ ai, kể cả người tự xưng là Makko.</Text></View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  mail: { alignItems: 'center', backgroundColor: colors.cream, borderRadius: 18, height: 58, justifyContent: 'center', marginTop: 36, width: 58 }, mailText: { fontSize: 24 },
  codeRow: { flexDirection: 'row', gap: 8, justifyContent: 'space-between', marginTop: 29 },
  codeInput: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1, color: colors.text, fontFamily: fontFamilies.display, fontSize: fontSizes.sectionTitle, height: 56, padding: 0, textAlign: 'center', width: 47 },
  codeActive: { borderColor: colors.orange, shadowColor: colors.orange, shadowOpacity: 0.2, shadowRadius: 4 },
  resend: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, marginBottom: 8, marginTop: 17, textAlign: 'center' }, resendLink: { color: colors.coral, fontFamily: fontFamilies.bodyBold },
  notice: { backgroundColor: '#EDF4E9', borderRadius: 12, flexDirection: 'row', gap: 10, marginTop: 18, padding: 12 }, noticeIcon: { color: colors.forest, fontSize: 20 }, noticeText: { color: colors.text, flex: 1, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption }, noticeStrong: { fontFamily: fontFamilies.bodyBold },
});
