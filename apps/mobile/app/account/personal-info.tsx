import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, Stack, useFocusEffect, useRouter } from 'expo-router';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useAuth } from '@/features/auth/AuthProvider';
import { getAccountProfile, saveAccountProfile, type EditableProfile } from '@/features/account/api';
import { accountProfileEntry, fetchAccountProfile, invalidateOrderLists, patchAccountProfile } from '@/features/orders/listCache';
import { OrderScreenHeader } from '@/features/orders/OrderScreenHeader';
import { AvatarImage } from '@/components/ui/AvatarImage';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';

type Photo = { uri: string; base64: string; path?: string };
const empty: EditableProfile = { displayName: '', phone: null, bio: null, avatarPath: null };
const same = (a: EditableProfile, b: EditableProfile) => a.displayName === b.displayName && a.phone === b.phone && a.bio === b.bio && a.avatarPath === b.avatarPath;

export default function PersonalInfoRoute() {
  const { session, isLoading } = useAuth();
  if (isLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;
  return <PersonalInfoScreen key={session.user.id} userId={session.user.id} identifier={session.user.email || session.user.phone || ''} />;
}
function PersonalInfoScreen({ userId, identifier }: { userId: string; identifier: string }) {
  const router = useRouter();
  const cached = accountProfileEntry(userId).data;
  const [form, setForm] = useState<EditableProfile>(cached ?? empty);
  const [original, setOriginal] = useState<EditableProfile>(cached ?? empty);
  const [loaded, setLoaded] = useState(!!cached);
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [sheet, setSheet] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [focus, setFocus] = useState('');
  const alive = useRef(true);
  const lock = useRef(false);
  const dirtyRef = useRef(false);
  const readVersion = useRef(0);
  const scroll = useRef<ScrollView>(null);
  const dirty = !!photo || !same(form, original);
  dirtyRef.current = dirty;
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  const load = useCallback(async () => {
    const version = ++readVersion.current;
    try {
      const data = await fetchAccountProfile(userId, () => getAccountProfile(userId));
      if (alive.current && version === readVersion.current && data && !dirtyRef.current) { setForm(data); setOriginal(data); setLoaded(true); setError(''); }
    } catch (failure) { if (alive.current && version === readVersion.current) setError(failure instanceof Error ? failure.message : 'Không tải được hồ sơ.'); }
  }, [userId]);
  useEffect(() => {
    const entry = accountProfileEntry(userId);
    if (!entry.data || Date.now() - entry.updatedAt >= 30_000) void load();
  }, [load, userId]);
  const leave = useCallback(() => {
    if (lock.current) return;
    const back = () => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile');
    if (dirty) Alert.alert('Bỏ thay đổi?', 'Thông tin và ảnh bạn vừa chọn chưa được lưu.', [{ text: 'Tiếp tục chỉnh sửa', style: 'cancel' }, { text: 'Bỏ thay đổi', style: 'destructive', onPress: back }]);
    else back();
  }, [dirty, router]);
  useFocusEffect(useCallback(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => { if (sheet) setSheet(false); else leave(); return true; });
    return () => subscription.remove();
  }, [leave, sheet]));
  const change = (key: 'displayName' | 'phone' | 'bio', value: string) => { dirtyRef.current = true; readVersion.current += 1; setForm(previous => ({ ...previous, [key]: value })); setSuccess(false); setError(''); };
  async function pickPhoto() {
    if (lock.current) return;
    lock.current = true; setBusy(true); setError('');
    try {
      if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExponentImagePicker')) throw new Error('Bản Makko đang cài chưa hỗ trợ chọn ảnh. Vui lòng cài bản ứng dụng mới rồi thử lại.');
      const picker = await import('expo-image-picker');
      const result = await picker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.8, base64: true });
      if (result.canceled || !alive.current) return;
      const asset = result.assets[0];
      if (!asset.base64 || asset.base64.length * 0.75 > 10 * 1024 * 1024) throw new Error('Chọn ảnh JPEG, PNG hoặc WebP nhỏ hơn 10 MB.');
      readVersion.current += 1;
      setPhoto({ uri: asset.uri, base64: asset.base64 }); setSuccess(false); setSheet(false);
    } catch (failure) { if (alive.current) { setError(failure instanceof Error ? failure.message : 'Không mở được ảnh.'); setSheet(false); } }
    finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  async function save() {
    if (lock.current || !loaded || !dirty) return;
    const desired: EditableProfile = { displayName: form.displayName.trim(), phone: form.phone?.trim() || null, bio: form.bio?.trim() || null, avatarPath: form.avatarPath };
    if (desired.displayName.length < 2) { setError('Tên hiển thị cần có ít nhất 2 ký tự.'); return; }
    lock.current = true; setBusy(true); setSuccess(false); setError(''); readVersion.current += 1;
    const apply = (result: EditableProfile) => {
      if (!alive.current) return;
      setForm(result); setOriginal(result); setPhoto(null); setSuccess(true); scroll.current?.scrollTo({ y: 0, animated: true });
    };
    let savingProfile = false;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session || session.user.id !== userId) throw new Error('Tài khoản đã thay đổi. Vui lòng mở lại hồ sơ.');
      if (photo) {
        let path = photo.path;
        if (!path) {
          const bytes = Uint8Array.from(atob(photo.base64), character => character.charCodeAt(0));
          const jpeg = bytes[0] === 255 && bytes[1] === 216;
          const png = bytes[0] === 137 && bytes[1] === 80;
          const webp = bytes[0] === 82 && bytes[1] === 73 && bytes[8] === 87 && bytes[9] === 69;
          if (!jpeg && !png && !webp) throw new Error('Ảnh cần ở định dạng JPEG, PNG hoặc WebP.');
          const extension = jpeg ? 'jpg' : png ? 'png' : 'webp';
          path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${extension}`;
          const { error: uploadError } = await supabase.storage.from('profile-avatars').upload(path, bytes.buffer, { upsert: false, contentType: `image/${jpeg ? 'jpeg' : extension}` });
          if (uploadError) throw uploadError;
          photo.path = path;
        }
        desired.avatarPath = path;
      }
      savingProfile = true;
      apply(await saveAccountProfile(desired, userId));
    } catch (failure) {
      if (savingProfile) {
        try {
          const data = await getAccountProfile(userId);
          if (same(data, desired)) { invalidateOrderLists(); patchAccountProfile(userId, data); apply(data); return; }
        } catch { /* Keep the draft and uploaded path for an explicit retry. */ }
      }
      if (alive.current) setError(failure instanceof Error ? failure.message : 'Chưa xác nhận được việc lưu. Thông tin nhập vẫn được giữ lại, bạn có thể thử lại.');
    } finally { lock.current = false; if (alive.current) setBusy(false); }
  }
  const initials = form.displayName.trim().split(/\s+/).filter(Boolean).slice(-2).map(word => word[0]).join('').toUpperCase() || 'M';
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <Stack.Screen options={{ gestureEnabled: !dirty && !busy }} />
    <OrderScreenHeader title="Thông tin cá nhân" backLabel="Quay lại Tài khoản" onBack={leave} />
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        {success && <Text accessibilityRole="alert" style={s.success}>✓ Đã lưu thông tin cá nhân</Text>}
        {!!error && <View accessibilityRole="alert"><Text style={s.error}>{error}</Text>{!loaded && <Pressable accessibilityRole="button" onPress={() => void load()}><Text style={s.changePhoto}>Thử lại</Text></Pressable>}</View>}
        {!loaded && !error && <ActivityIndicator color={colors.coral} />}
        {loaded && <>
          <View style={s.hero}><Pressable accessibilityRole="button" accessibilityLabel="Đổi ảnh đại diện" disabled={busy} onPress={() => setSheet(true)} style={s.avatar}><Text style={s.initials}>{initials}</Text>{photo ? <Image source={{ uri: photo.uri }} style={s.preview} /> : <AvatarImage path={form.avatarPath} borderRadius={18} />}<View style={s.camera}><SymbolView name={{ ios: 'camera', android: 'photo_camera', web: 'photo_camera' }} size={13} tintColor={colors.forest} fallback={<Text>▧</Text>} /></View></Pressable><View style={s.flex}><Text style={s.bold}>{form.displayName.trim() || 'Tên hiển thị'}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={() => setSheet(true)}><Text style={s.changePhoto}>Đổi ảnh đại diện</Text></Pressable><Text style={s.caption}>Thông tin giúp người cùng đơn dễ nhận ra bạn hơn.</Text></View></View>
          <View style={s.field}><View style={s.labelRow}><Text style={s.label}>Tên hiển thị</Text><Text style={s.caption}>Bắt buộc</Text></View><TextInput accessibilityLabel="Tên hiển thị" value={form.displayName} onChangeText={value => change('displayName', value)} maxLength={80} autoCapitalize="words" editable={!busy} onFocus={() => setFocus('name')} onBlur={() => setFocus('')} style={[s.input, focus === 'name' && s.focused]} /><Text style={s.caption}>Tên hiển thị với người cùng đơn.</Text></View>
          <View style={s.field}><View style={s.labelRow}><Text style={s.label}>Số điện thoại liên hệ</Text><Text style={s.caption}>Không bắt buộc</Text></View><TextInput accessibilityLabel="Số điện thoại liên hệ" value={form.phone ?? ''} onChangeText={value => change('phone', value)} keyboardType="phone-pad" maxLength={32} placeholder="Ví dụ: 090 123 4567" placeholderTextColor={colors.muted} editable={!busy} onFocus={() => setFocus('phone')} onBlur={() => setFocus('')} style={[s.input, focus === 'phone' && s.focused]} /><Text style={s.caption}>Chỉ dùng cho hồ sơ; không đổi số đăng nhập hoặc số trong đơn đã đăng.</Text></View>
          <View style={s.field}><View style={s.labelRow}><Text style={s.label}>Giới thiệu ngắn</Text><Text style={s.caption}>Không bắt buộc</Text></View><TextInput accessibilityLabel="Giới thiệu ngắn" value={form.bio ?? ''} onChangeText={value => change('bio', value)} multiline maxLength={500} textAlignVertical="top" placeholder="Chia sẻ đôi điều về bạn" placeholderTextColor={colors.muted} editable={!busy} onFocus={() => setFocus('bio')} onBlur={() => setFocus('')} style={[s.input, s.bio, focus === 'bio' && s.focused]} /><Text style={[s.caption, s.count]}>{form.bio?.length ?? 0}/500 ký tự</Text></View>
          {!!identifier && <View style={s.field}><Text style={s.small}>Thông tin đăng nhập</Text><View style={s.email}><Text style={[s.small, s.flex]}>{identifier}</Text><Text style={s.caption}>Không chỉnh sửa</Text></View></View>}
        </>}
      </ScrollView>
      <View style={s.footer}><Pressable accessibilityRole="button" disabled={!loaded || !dirty || busy} accessibilityState={{ disabled: !loaded || !dirty || busy, busy }} onPress={() => void save()} style={[s.primary, (!loaded || !dirty || busy) && s.disabled]}><Text style={s.bold}>{busy ? 'Đang xử lý…' : 'Lưu thay đổi'}</Text></Pressable></View>
    </KeyboardAvoidingView>
    <Modal visible={sheet} transparent animationType="slide" onRequestClose={() => { if (!busy) setSheet(false); }}>
      <View style={s.overlay}><Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Đóng" onPress={() => { if (!busy) setSheet(false); }} /><SafeAreaView edges={['bottom']} style={s.sheet}><View style={s.handle} /><View style={s.labelRow}><Text style={s.sheetTitle}>Ảnh đại diện</Text><Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Đóng" onPress={() => setSheet(false)} style={s.close}><Text style={s.closeText}>×</Text></Pressable></View><Text style={s.small}>Chọn ảnh để người cùng đơn dễ nhận ra bạn.</Text><Pressable disabled={busy} accessibilityRole="button" onPress={() => void pickPhoto()} style={s.photoAction}><Text style={s.bold}>Chọn ảnh từ thư viện</Text><Text style={s.caption}>Ảnh sẽ được xem trước trên hồ sơ</Text></Pressable><Pressable disabled={busy || (!photo && !form.avatarPath)} accessibilityRole="button" onPress={() => { readVersion.current += 1; setPhoto(null); setForm(previous => ({ ...previous, avatarPath: null })); setSuccess(false); setSheet(false); }} style={[s.photoAction, (!photo && !form.avatarPath) && s.disabled]}><Text style={s.bold}>Gỡ ảnh đại diện</Text><Text style={s.caption}>Dùng chữ viết tắt từ tên của bạn</Text></Pressable><Text style={[s.caption, s.center]}>Bấm Lưu thay đổi trên hồ sơ để lưu ảnh.</Text></SafeAreaView></View>
    </Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, content: { padding: 20, gap: 20 },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingBottom: 20, borderBottomWidth: 1, borderBottomColor: colors.border }, avatar: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, initials: { color: colors.forest, fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle }, preview: { position: 'absolute', left: 0, top: 0, width: 56, height: 56, borderRadius: 18 }, camera: { position: 'absolute', right: -4, bottom: -4, width: 25, height: 25, backgroundColor: colors.orange, borderWidth: 3, borderColor: colors.background, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  bold: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, lineHeight: lineHeights.body }, small: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall }, caption: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption }, changePhoto: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, paddingVertical: 6 },
  field: { gap: 8 }, labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 }, label: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, lineHeight: lineHeights.body }, input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 14, minHeight: 50, color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.body, lineHeight: lineHeights.body }, focused: { borderColor: colors.orange }, bio: { minHeight: 104 }, count: { textAlign: 'right' }, email: { padding: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 12, backgroundColor: colors.chip, flexDirection: 'row', gap: 10, alignItems: 'center' },
  footer: { paddingHorizontal: 20, paddingVertical: 16, borderTopWidth: 1, borderTopColor: colors.border }, primary: { padding: 15, borderRadius: 14, backgroundColor: colors.orange, alignItems: 'center' }, disabled: { opacity: 0.45 }, error: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall }, success: { backgroundColor: colors.vegetable, color: colors.forest, padding: 12, borderRadius: 12, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall }, overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: '#1F272366' }, sheet: { padding: 20, borderTopLeftRadius: 24, borderTopRightRadius: 24, backgroundColor: colors.background, gap: 14 }, handle: { width: 38, height: 4, borderRadius: 4, backgroundColor: colors.border, alignSelf: 'center' }, sheetTitle: { color: colors.forest, fontFamily: fontFamilies.display, fontSize: fontSizes.sectionTitle, lineHeight: lineHeights.sectionTitle }, close: { width: 34, height: 34, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, closeText: { fontSize: fontSizes.pageTitle, color: colors.forest }, photoAction: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, backgroundColor: colors.surface, gap: 4 }, center: { textAlign: 'center' },
});
