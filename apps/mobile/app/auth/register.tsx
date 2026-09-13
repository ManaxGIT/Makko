import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AuthField, AuthHeader, AuthIntro, AuthScreen, InlineLink, PrimaryButton } from '@/components/auth/AuthUI';
import { parseAuthIdentifier } from '@/features/auth/identifier';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';

export default function RegisterScreen() {
  const router = useRouter();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const continueRegistration = async () => {
    setError(null);
    const credentials = parseAuthIdentifier(identifier);

    if (!credentials) {
      setError('Vui lòng nhập email hoặc số điện thoại Việt Nam hợp lệ.');
      return;
    }
    if (password.length < 6) {
      setError('Mật khẩu cần có ít nhất 6 ký tự.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Mật khẩu nhập lại chưa trùng khớp.');
      return;
    }
    if (!accepted) {
      setError('Bạn cần đồng ý với điều khoản để tiếp tục.');
      return;
    }

    if (!isSupabaseConfigured) {
      setError('Chưa cấu hình Supabase. Hãy kiểm tra tệp .env.');
      return;
    }

    setPending(true);
    const { data, error: signUpError } = await supabase.auth.signUp({ ...credentials, password });
    setPending(false);

    if (signUpError) {
      setError(signUpError.message.toLowerCase().includes('already')
        ? ('email' in credentials ? 'Email đã được đăng ký.' : 'Số điện thoại đã được đăng ký.')
        : 'Không thể tạo tài khoản. Vui lòng thử lại.');
      return;
    }

    // Supabase may conceal an existing email to prevent account enumeration by
    // returning a user with no identities instead of an explicit error.
    if (Array.isArray(data.user?.identities) && data.user.identities.length === 0) {
      setError('Email đã được đăng ký.');
      return;
    }

    if (!data.session) {
      // TODO(auth-verification): Route to /auth/verify when email/phone confirmation is re-enabled.
      setError('Hệ thống đang yêu cầu xác thực. Vui lòng liên hệ quản trị viên.');
      return;
    }

    router.push('/auth/profile-setup');
  };

  return (
    <AuthScreen footer={<InlineLink before="Đã có tài khoản? " label="Đăng nhập" onPress={() => router.replace('/auth/login')} />}>
      <AuthHeader />
      <AuthIntro eyebrow="THAM GIA KHU PHỐ MAKKO" title="Tạo tài khoản" subtitle="Chỉ mất một phút để bắt đầu giúp đỡ lẫn nhau." />
      <AuthField autoCapitalize="none" autoComplete="username" keyboardType="email-address" label="EMAIL HOẶC SỐ ĐIỆN THOẠI" onChangeText={setIdentifier} placeholder="tengmail, ban@email.com hoặc 0912..." value={identifier} />
      <AuthField autoComplete="new-password" label="MẬT KHẨU" onChangeText={setPassword} placeholder="Ít nhất 6 ký tự" secureTextEntry={!passwordVisible} trailing={<Pressable accessibilityLabel={passwordVisible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setPasswordVisible((value) => !value)}><Text style={styles.eye}>{passwordVisible ? '◌' : '◉'}</Text></Pressable>} value={password} />
      <AuthField autoComplete="new-password" label="NHẬP LẠI MẬT KHẨU" onChangeText={setConfirmPassword} onSubmitEditing={continueRegistration} placeholder="Nhập lại mật khẩu" returnKeyType="done" secureTextEntry={!passwordVisible} value={confirmPassword} />
      <Pressable onPress={() => setAccepted((value) => !value)} style={styles.terms}>
        <View style={[styles.checkbox, accepted && styles.checkboxChecked]}><Text style={styles.check}>{accepted ? '✓' : ''}</Text></View>
        <Text style={styles.termsText}>Tôi đồng ý với <Text style={styles.link}>Điều khoản sử dụng</Text> và <Text style={styles.link}>Quy tắc cộng đồng</Text> của Makko.</Text>
      </Pressable>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <PrimaryButton disabled={pending} onPress={continueRegistration}>{pending ? 'Đang tạo tài khoản…' : 'Tiếp tục'}</PrimaryButton>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  eye: { color: colors.text, fontSize: 17, padding: 8 },
  error: { color: '#B42318', fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, marginTop: 12 },
  terms: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 16 },
  checkbox: { alignItems: 'center', borderColor: colors.forest, borderRadius: 5, borderWidth: 1, height: 18, justifyContent: 'center', width: 18 },
  checkboxChecked: { backgroundColor: colors.forest }, check: { color: colors.surface, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption },
  termsText: { color: '#80867F', flex: 1, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption },
  link: { color: colors.coral, fontFamily: fontFamilies.bodyBold },
});
