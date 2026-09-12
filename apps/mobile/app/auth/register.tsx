import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AuthField, AuthHeader, AuthIntro, AuthScreen, InlineLink, PrimaryButton } from '@/components/auth/AuthUI';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState('Nguyễn Hoài An');
  const [phone, setPhone] = useState('912 345 678');
  const [password, setPassword] = useState('makko123');
  const [accepted, setAccepted] = useState(true);
  return (
    <AuthScreen footer={<InlineLink before="Đã có tài khoản? " label="Đăng nhập" onPress={() => router.replace('/auth/login')} />}>
      <AuthHeader />
      <AuthIntro eyebrow="THAM GIA KHU PHỐ MAKKO" title="Tạo tài khoản" subtitle="Chỉ mất một phút để bắt đầu giúp đỡ lẫn nhau." />
      <AuthField label="HỌ VÀ TÊN" onChangeText={setName} value={name} />
      <AuthField keyboardType="phone-pad" label="SỐ ĐIỆN THOẠI" onChangeText={setPhone} prefix="🇻🇳 +84" trailing={<Text style={styles.valid}>✓</Text>} value={phone} />
      <AuthField label="MẬT KHẨU" onChangeText={setPassword} secureTextEntry trailing={<Text style={styles.eye}>◉</Text>} value={password} />
      <Pressable onPress={() => setAccepted((value) => !value)} style={styles.terms}>
        <View style={[styles.checkbox, accepted && styles.checkboxChecked]}><Text style={styles.check}>{accepted ? '✓' : ''}</Text></View>
        <Text style={styles.termsText}>Tôi đồng ý với <Text style={styles.link}>Điều khoản sử dụng</Text> và <Text style={styles.link}>Quy tắc cộng đồng</Text> của Makko.</Text>
      </Pressable>
      <PrimaryButton onPress={() => router.push('/auth/verify')}>Tiếp tục</PrimaryButton>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  valid: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body }, eye: { color: colors.text, fontSize: 17 },
  terms: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 16 },
  checkbox: { alignItems: 'center', borderColor: colors.forest, borderRadius: 5, borderWidth: 1, height: 18, justifyContent: 'center', width: 18 },
  checkboxChecked: { backgroundColor: colors.forest }, check: { color: colors.surface, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption },
  termsText: { color: '#80867F', flex: 1, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption },
  link: { color: colors.coral, fontFamily: fontFamilies.bodyBold },
});
