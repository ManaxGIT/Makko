import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { AuthField, AuthHeader, AuthIntro, AuthScreen, InlineLink, PrimaryButton } from '@/components/auth/AuthUI';
import { useAuth } from '@/features/auth/AuthProvider';
import { parseAuthIdentifier } from '@/features/auth/identifier';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState<'password' | 'google' | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (session) router.replace('/(tabs)');
  }, [router, session]);

  const signInWithPassword = async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      setError('Chưa cấu hình Supabase. Hãy kiểm tra tệp .env.');
      return;
    }

    const credentials = parseAuthIdentifier(identifier);
    if (!credentials || password.length < 6) {
      setError('Vui lòng nhập email/số điện thoại và mật khẩu hợp lệ.');
      return;
    }

    setPending('password');
    const { error: signInError } = await supabase.auth.signInWithPassword({ ...credentials, password });
    setPending(null);

    if (signInError) {
      setError('Email, số điện thoại hoặc mật khẩu không đúng.');
      return;
    }

    router.replace('/(tabs)');
  };

  const signInWithGoogle = async () => {
    setError(null);
    if (!isSupabaseConfigured) {
      setError('Chưa cấu hình Supabase. Hãy kiểm tra tệp .env.');
      return;
    }

    setPending('google');
    const redirectTo = Linking.createURL('auth/login');
    const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        skipBrowserRedirect: Platform.OS !== 'web',
      },
    });

    if (oauthError || !data.url) {
      setPending(null);
      setError('Không thể bắt đầu đăng nhập Google. Vui lòng thử lại.');
      return;
    }

    if (Platform.OS === 'web') return;

    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
    if (result.type !== 'success') {
      setPending(null);
      if (result.type !== 'cancel') setError('Đăng nhập Google chưa hoàn tất.');
      return;
    }

    const callbackUrl = new URL(result.url);
    const hash = new URLSearchParams(callbackUrl.hash.replace(/^#/, ''));
    const oauthErrorDescription = hash.get('error_description') ?? callbackUrl.searchParams.get('error_description');

    if (oauthErrorDescription) {
      setPending(null);
      const normalizedError = oauthErrorDescription.toLowerCase();
      setError(normalizedError.includes('identity') || normalizedError.includes('already') || normalizedError.includes('email')
        ? 'Email Google này đã có tài khoản nhưng chưa thể liên kết. Hãy đăng nhập bằng mật khẩu hoặc xác nhận email rồi thử lại Google.'
        : 'Không thể đăng nhập Google. Vui lòng thử lại.');
      return;
    }

    const accessToken = hash.get('access_token') ?? callbackUrl.searchParams.get('access_token');
    const refreshToken = hash.get('refresh_token') ?? callbackUrl.searchParams.get('refresh_token');

    if (!accessToken || !refreshToken) {
      setPending(null);
      setError('Google không trả về phiên đăng nhập hợp lệ.');
      return;
    }

    const { error: sessionError } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    });
    setPending(null);

    if (sessionError) {
      setError('Không thể lưu phiên đăng nhập Google.');
      return;
    }

    router.replace('/(tabs)');
  };

  return (
    <AuthScreen footer={<InlineLink before="Chưa có tài khoản? " label="Đăng ký ngay" onPress={() => router.replace('/auth/register')} />}>
      <AuthHeader />
      <AuthIntro eyebrow="CHÀO MỪNG TRỞ LẠI" title="Đăng nhập" subtitle="Cùng xem hôm nay khu phố đang cần gì nhé." />
      <AuthField autoCapitalize="none" autoComplete="username" keyboardType="email-address" label="EMAIL HOẶC SỐ ĐIỆN THOẠI" onChangeText={setIdentifier} placeholder="tengmail, ban@email.com hoặc 0912..." value={identifier} />
      <AuthField autoComplete="current-password" label="MẬT KHẨU" onChangeText={setPassword} onSubmitEditing={signInWithPassword} placeholder="Nhập mật khẩu" returnKeyType="done" secureTextEntry={!visible} trailing={<Pressable accessibilityLabel={visible ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'} onPress={() => setVisible((value) => !value)}><Text style={styles.eye}>{visible ? '◌' : '◉'}</Text></Pressable>} value={password} />
      <View style={styles.options}>
        <Pressable onPress={() => setRemember((value) => !value)} style={styles.remember}>
          <View style={[styles.checkbox, remember && styles.checkboxChecked]}><Text style={styles.check}>{remember ? '✓' : ''}</Text></View>
          <Text style={styles.optionText}>Ghi nhớ tôi</Text>
        </Pressable>
        <Pressable><Text style={styles.forgot}>Quên mật khẩu?</Text></Pressable>
      </View>
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <PrimaryButton disabled={pending !== null} onPress={signInWithPassword}>{pending === 'password' ? 'Đang đăng nhập…' : 'Đăng nhập'}</PrimaryButton>
      <View style={styles.or}><View style={styles.line} /><Text style={styles.orText}>HOẶC TIẾP TỤC VỚI</Text><View style={styles.line} /></View>
      <Pressable accessibilityLabel="Đăng nhập bằng Google" accessibilityRole="button" disabled={pending !== null} onPress={signInWithGoogle} style={({ pressed }) => [styles.google, (pressed || pending !== null) && styles.pressed]}>
        {pending === 'google' ? <ActivityIndicator color="#4285F4" /> : <Text style={styles.googleMark}>G</Text>}
        <Text style={styles.socialText}>{pending === 'google' ? 'Đang kết nối Google…' : 'Tiếp tục với Google'}</Text>
      </Pressable>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  eye: { color: colors.text, fontSize: 17, padding: 8 },
  options: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 1, paddingTop: 13 },
  remember: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  checkbox: { alignItems: 'center', borderColor: colors.forest, borderRadius: 5, borderWidth: 1, height: 18, justifyContent: 'center', width: 18 },
  checkboxChecked: { backgroundColor: colors.forest },
  check: { color: colors.surface, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption },
  optionText: { color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  forgot: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  or: { alignItems: 'center', flexDirection: 'row', gap: 8, marginTop: 23 },
  line: { backgroundColor: colors.border, flex: 1, height: 1 },
  orText: { color: colors.mutedLight, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  error: { color: '#B42318', fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: 18, marginTop: 12 },
  google: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 11, borderWidth: 1, flexDirection: 'row', gap: 10, height: 48, justifyContent: 'center', marginTop: 14 },
  googleMark: { color: '#4285F4', fontFamily: fontFamilies.bodyBold, fontSize: 18 },
  socialText: { color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  pressed: { opacity: 0.68 },
});
