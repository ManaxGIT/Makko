import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';

import { AuthField, AuthHeader, AuthIntro, AuthScreen, PrimaryButton } from '@/components/auth/AuthUI';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const completeProfile = async () => {
    if (displayName.trim().length < 2) {
      setError('Tên hiển thị là bắt buộc và cần có ít nhất 2 ký tự.');
      return;
    }

    setError(null);
    setPending(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      setPending(false);
      setError('Phiên đăng ký đã hết hạn. Vui lòng đăng ký lại.');
      return;
    }

    const { error: updateError } = await supabase
      .from('profiles')
      .update({ display_name: displayName.trim(), bio: bio.trim() || null })
      .eq('id', user.id);
    setPending(false);

    if (updateError) {
      setError('Không thể lưu hồ sơ. Vui lòng thử lại.');
      return;
    }

    router.push('/auth/success');
  };

  const initials = displayName.trim()
    ? displayName.trim().split(/\s+/).slice(-2).map((part) => part[0]?.toUpperCase()).join('')
    : 'M';
  return (
    <AuthScreen>
      <AuthHeader showStep />
      <AuthIntro eyebrow="HOÀN THIỆN HỒ SƠ" title={'Để hàng xóm\nnhận ra bạn'} subtitle="Hồ sơ rõ ràng giúp mọi người an tâm hơn khi giúp đỡ nhau." />
      <Pressable style={styles.avatarWrap}>
        <View style={styles.avatar}><Text style={styles.initials}>{initials}</Text><View style={styles.camera}><Text style={styles.cameraText}>⌁</Text></View></View>
        <Text style={styles.avatarLabel}>Thêm ảnh đại diện</Text>
      </Pressable>
      <AuthField autoCapitalize="words" label="TÊN HIỂN THỊ *" onChangeText={(value) => { setDisplayName(value); if (error) setError(null); }} placeholder="Nhập tên mọi người sẽ nhìn thấy" trailing={displayName.trim().length >= 2 ? <Text style={styles.valid}>✓</Text> : undefined} value={displayName} />
      {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
      <AuthField label="GIỚI THIỆU NGẮN" multiline onChangeText={setBio} placeholder="Chia sẻ đôi điều về bạn (không bắt buộc)" value={bio} />
      <View style={styles.trust}><Text style={styles.heart}>♥</Text><Text style={styles.trustText}><Text style={styles.trustStrong}>Makko dựa trên sự tin cậy.{`\n`}</Text>Chỉ chia sẻ thông tin bạn cảm thấy thoải mái.</Text></View>
      <PrimaryButton disabled={displayName.trim().length < 2 || pending} onPress={completeProfile}>{pending ? 'Đang lưu hồ sơ…' : 'Hoàn tất đăng ký'}</PrimaryButton>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  avatarWrap: { alignItems: 'center', marginBottom: 1, marginTop: 25 },
  avatar: { alignItems: 'center', backgroundColor: colors.cream, borderRadius: 28, height: 88, justifyContent: 'center', position: 'relative', width: 88 },
  initials: { color: colors.text, fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle },
  camera: { alignItems: 'center', backgroundColor: colors.orange, borderColor: colors.background, borderRadius: 9, borderWidth: 3, bottom: -4, height: 31, justifyContent: 'center', position: 'absolute', right: -4, width: 31 }, cameraText: { color: colors.forest, fontSize: 14 },
  avatarLabel: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, marginTop: 12 }, valid: { color: colors.forest, fontFamily: fontFamilies.bodyBold },
  error: { color: '#B42318', fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, marginTop: 8 },
  trust: { backgroundColor: '#FFF0CF', borderRadius: 12, flexDirection: 'row', gap: 10, marginTop: 14, padding: 12 }, heart: { color: colors.forest, fontSize: 11 }, trustText: { color: colors.text, flex: 1, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption }, trustStrong: { fontFamily: fontFamilies.bodyBold },
});
