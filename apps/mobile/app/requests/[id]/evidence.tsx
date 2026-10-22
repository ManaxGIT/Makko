import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import type { ImagePickerOptions } from 'expo-image-picker';
import { requireOptionalNativeModule } from 'expo';
import { useAuth } from '@/features/auth/AuthProvider';
import { getOrderDetail, OrderDetail } from '@/features/orders/api';
import { evidenceBucket, EvidencePhoto, submitEvidence, submitDeliveryEvidence } from '@/features/orders/evidence';
import { supabase } from '@/lib/supabase';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights, letterSpacing } from '@/theme/typography';

type Photo = { key: string; uri: string; base64: string; kind: EvidencePhoto['kind']; storagePath?: string };
const money = (n: number) => `${n.toLocaleString('vi-VN')}đ`;
const agreement = 'Mua đủ, đúng yêu cầu: bạn giữ phần tiết kiệm và tự chịu phần vượt giá, không thu thêm. Thiếu hoặc thay món cần người đăng đồng ý và điều chỉnh tiền.';

export default function PurchaseEvidenceScreen() {
  const { id, stage } = useLocalSearchParams<{ id: string; stage?: string }>();
  const delivery = stage === 'delivery';
  const router = useRouter();
  const { session } = useAuth();
  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [step, setStep] = useState(0);
  const [checked, setChecked] = useState<string[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [issue, setIssue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const submitting = useRef(false);
  const owner = useRef(session?.user.id);
  const scroll = useRef<ScrollView>(null);
  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true); setError('');
    try { setOrder(await getOrderDetail(id)); }
    catch (e) { setError(e instanceof Error ? e.message : 'Không tải được đơn hàng.'); }
    finally { setLoading(false); }
  }, [id]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  useFocusEffect(useCallback(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (submitting.current) return true;
      if (!delivery && step > 0) { setStep(step - 1); return true; }
      return false;
    });
    return () => sub.remove();
  }, [step, delivery]));
  if (!session || session.user.id !== owner.current) return <Redirect href="/auth/login" />;
  function go(n: number) { setError(''); setStep(n); scroll.current?.scrollTo({ y: 0, animated: false }); }
  async function pick(camera: boolean, kind: Photo['kind']) {
    if (busy || photos.length >= 20) { if (photos.length >= 20) setError('Tối đa 20 ảnh cho một lần xác nhận.'); return; }
    setBusy(true); setError('');
    try {
      // Older development clients must still be able to load the route tree.
      // Import the picker only after checking that its native module is installed.
      if (Platform.OS !== 'web' && !requireOptionalNativeModule('ExponentImagePicker')) {
        setError('Bản Makko đang cài chưa hỗ trợ chọn/chụp ảnh. Vui lòng cài bản ứng dụng mới rồi thử lại.');
        return;
      }
      const ImagePicker = await import('expo-image-picker');
      if (camera) {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) { setError('Cho phép truy cập camera trong Cài đặt, hoặc chọn ảnh từ thư viện.'); return; }
      }
      const options: ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, quality: 0.7, base64: true };
      const result = camera ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled) return;
      const asset = result.assets[0];
      if (!asset.base64 || asset.base64.length * 0.75 > 10 * 1024 * 1024) { setError('Chọn ảnh nhỏ hơn 10 MB.'); return; }
      const photo: Photo = { key: `${Date.now()}-${Math.random().toString(36).slice(2)}`, uri: asset.uri, base64: asset.base64, kind };
      setPhotos(old => [...old, photo]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không mở được ảnh.'); }
    finally { setBusy(false); }
  }
  async function next() {
    if (!order || submitting.current || busy) return;
    if (!delivery && step === 0) {
      if (issue) { setError('Cần thống nhất thay đổi với người đăng trước khi giao. Hiện chưa hỗ trợ xác nhận điều chỉnh trong ứng dụng.'); return; }
      if (!order.items.length || order.items.some(item => !checked.includes(item.id))) { setError('Xác nhận đã mua đủ và đúng từng món trước khi tiếp tục.'); return; }
      go(1); return;
    }
    if (!photos.some(p => p.kind === (delivery ? 'delivery' : 'goods'))) { setError(delivery ? 'Thêm ít nhất một ảnh giao hàng.' : 'Thêm ít nhất một ảnh hàng đã mua.'); return; }
    if (!delivery && step === 1) { go(2); return; }
    submitting.current = true; setBusy(true); setError('');
    try {
      const { data: { session: current } } = await supabase.auth.getSession();
      if (!current || current.user.id !== owner.current) throw new Error('Tài khoản đã thay đổi. Vui lòng mở lại đơn hàng.');
      const uploaded: EvidencePhoto[] = [];
      for (const photo of photos) {
        let path = photo.storagePath;
        if (!path) {
          const bytes = Uint8Array.from(atob(photo.base64), c => c.charCodeAt(0));
          // Picker base64 is JPEG on native; detect supported web outputs as well.
          const png = bytes[0] === 137 && bytes[1] === 80;
          const jpeg = bytes[0] === 255 && bytes[1] === 216;
          const webp = bytes[0] === 82 && bytes[8] === 87;
          if (!png && !jpeg && !webp) throw new Error('Ảnh cần ở định dạng JPEG, PNG hoặc WebP.');
          const ext = png ? 'png' : jpeg ? 'jpg' : 'webp';
          path = `${current.user.id}/${id}/${photo.key}.${ext}`;
          const { error: uploadError } = await supabase.storage.from(evidenceBucket).upload(path, bytes.buffer, { contentType: `image/${jpeg ? 'jpeg' : ext}`, upsert: false });
          if (uploadError) throw uploadError;
          photo.storagePath = path; // Retain successful uploads on retry; never re-upload or overwrite.
          setPhotos(old => old.map(p => p.key === photo.key ? { ...p, storagePath: path } : p));
        }
        uploaded.push({ kind: photo.kind, storagePath: path });
      }
      if (delivery) await submitDeliveryEvidence(id, uploaded, current.user.id);
      else await submitEvidence(id, checked, uploaded, current.user.id);
      router.replace(`/requests/${id}`);
    } catch (e) { setError(e instanceof Error ? e.message : 'Không gửi được minh chứng. Các thông tin đã nhập vẫn được giữ để thử lại.'); }
    finally { submitting.current = false; setBusy(false); }
  }
  const editable = order?.role === 'shopper' && order.status === (delivery ? 'delivering' : 'shopping');
  return <SafeAreaView edges={['top', 'bottom']} style={s.safe}>
    <Stack.Screen options={{ gestureEnabled: !busy }} />
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Quay lại" disabled={busy} hitSlop={7} style={s.back} onPress={() => !delivery && step ? go(step - 1) : router.back()}><SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={19} tintColor={colors.text} /></Pressable><Text style={s.bold}>{delivery ? 'Minh chứng giao hàng' : 'Hoàn tất mua hàng'}</Text>{!delivery && <Text style={s.small}>{step + 1}/3</Text>}</View>
    {loading ? <ActivityIndicator color={colors.orange} style={s.content} /> : !order ? <View style={s.content}><Text style={s.error}>{error}</Text><Pressable onPress={load}><Text style={s.bold}>Thử lại</Text></Pressable></View> : !editable ? <View style={s.content}><Text style={s.body}>{delivery ? 'Đơn không còn ở bước giao hàng hoặc bạn không phải người nhận đơn.' : 'Đơn không còn ở bước chọn hàng hoặc bạn không phải người nhận đơn.'}</Text><Pressable onPress={() => router.replace(`/requests/${id}`)}><Text style={s.bold}>Về theo dõi đơn</Text></Pressable></View> : <>
      {!delivery && <View style={s.steps}>{['Kiểm tra hàng', 'Thêm ảnh', 'Xác nhận'].map((label, i) => <Pressable key={label} disabled={busy || i >= step} onPress={() => go(i)} style={[s.step, i <= step && s.active]}><Text style={s.small}>{i + 1}. {label}</Text></Pressable>)}</View>}
      <ScrollView ref={scroll} contentContainerStyle={s.content}>
        <Text style={s.eyebrow}>{delivery ? 'TRƯỚC KHI XÁC NHẬN ĐÃ GIAO' : ['KIỂM TRA HÀNG', 'MINH CHỨNG MUA HÀNG', 'TRƯỚC KHI BẮT ĐẦU GIAO'][step]}</Text>
        <Text style={s.heading}>{delivery ? 'Giao hàng xong. Thêm ảnh minh chứng.' : ['Đủ món, đúng ý người nhờ mua.', 'Có hàng thật. An tâm hơn.', 'Sẵn sàng giao đến người nhờ mua.'][step]}</Text>
        <Text style={s.body}>{order.title}</Text>
        {!delivery && step === 0 && <>
          <Text style={s.description}>Đánh dấu từng món đã mua đủ số lượng và đúng yêu cầu.</Text>
          {order.items.map(item => <Pressable key={item.id} accessibilityRole="checkbox" accessibilityState={{ checked: checked.includes(item.id) }} disabled={busy} onPress={() => setChecked(old => old.includes(item.id) ? old.filter(i => i !== item.id) : [...old, item.id])} style={s.card}><Text style={s.bold}>{checked.includes(item.id) ? '☑' : '☐'}  {item.name} · {item.quantity} {item.unit}</Text>{!!item.note && <Text style={s.description}>{item.note}</Text>}</Pressable>)}
          <Pressable onPress={() => setIssue(v => !v)} style={s.secondary}><Text style={s.action}>{issue ? 'Quay lại trường hợp mua đủ, đúng món' : 'Có món thiếu hoặc cần thay thế'}</Text></Pressable>
          {issue && <Text style={s.tip}>Cần liên hệ người đăng để thống nhất thay đổi và tiền điều chỉnh. Chưa thể xác nhận giao khi vấn đề chưa được giải quyết.</Text>}
          <Text style={s.tip}>{agreement}</Text>
        </>}
        {!delivery && step === 1 && <>
          <Text style={s.description}>Thêm ít nhất một ảnh rõ các món đã mua. Hóa đơn không bắt buộc, không cần nhập giá thực mua.</Text>
          <View style={s.upload}><Text style={s.bold}>Ảnh hàng đã mua</Text><Text style={s.description}>Chụp chung cả giỏ hoặc thêm nhiều ảnh.</Text><View style={s.row}><Pressable disabled={busy} style={s.secondary} onPress={() => pick(true, 'goods')}><Text style={s.action}>Chụp ảnh</Text></Pressable><Pressable disabled={busy} style={s.secondary} onPress={() => pick(false, 'goods')}><Text style={s.action}>Chọn ảnh</Text></Pressable></View></View>
        </>}
        {!delivery && step === 2 && order.items.map(item => <View key={item.id} style={s.card}><Text style={s.body}>✓ {item.name} · {item.quantity} {item.unit}</Text></View>)}
        {!delivery && step > 0 && <>{(['goods', 'receipt'] as const).map(kind => <View key={kind}><Text style={s.bold}>{kind === 'goods' ? 'Ảnh hàng đã mua' : 'Hóa đơn · Không bắt buộc'}</Text><View style={s.photos}>{photos.filter(p => p.kind === kind).map(photo => <View key={photo.key}><Image source={{ uri: photo.uri }} style={s.photo} />{step === 1 && <Pressable disabled={busy} accessibilityLabel="Xóa ảnh đã chọn" style={s.remove} onPress={() => setPhotos(old => old.filter(p => p.key !== photo.key))}><Text style={s.bold}>×</Text></Pressable>}</View>)}</View>{step === 1 && kind === 'receipt' && <Pressable disabled={busy} style={s.secondary} onPress={() => pick(false, 'receipt')}><Text style={s.action}>＋ Thêm ảnh hóa đơn</Text></Pressable>}</View>)}</>}
        {!delivery && (step === 0 || step === 2) && <View style={s.card}><View style={s.totalRow}><Text style={s.body}>Tiền hàng đã thỏa thuận</Text><Text style={s.bold}>{money(order.estimatedItemsTotal ?? 0)}</Text></View><View style={s.totalRow}><Text style={s.body}>Phí đi chợ</Text><Text style={s.bold}>{money(order.deliveryFee)}</Text></View><Text style={s.description}>Tổng tiền giữ nguyên khi mua đủ, đúng yêu cầu.</Text></View>}
        {delivery && <>
          <Text style={s.description}>Thêm ít nhất một ảnh thể hiện hàng đã được giao tại nơi nhận.</Text>
          <View style={s.upload}><Text style={s.bold}>Ảnh giao hàng</Text><Text style={s.description}>Chụp rõ hàng tại nơi giao. Không cần chụp khuôn mặt người nhận.</Text><View style={s.row}><Pressable disabled={busy} style={s.secondary} onPress={() => pick(true, 'delivery')}><Text style={s.action}>Chụp ảnh</Text></Pressable><Pressable disabled={busy} style={s.secondary} onPress={() => pick(false, 'delivery')}><Text style={s.action}>Chọn từ thư viện</Text></Pressable></View></View>
          <View style={s.photos}>{photos.map(photo => <View key={photo.key}><Image accessibilityLabel="Ảnh giao hàng đã chọn" source={{ uri: photo.uri }} style={s.photo} /><Pressable disabled={busy} accessibilityRole="button" accessibilityLabel="Xóa ảnh giao hàng" style={s.remove} onPress={() => setPhotos(old => old.filter(p => p.key !== photo.key))}><Text style={s.bold}>×</Text></Pressable></View>)}</View>
          <Text style={s.small}>{photos.length ? `${photos.length} ảnh giao hàng` : 'Chưa có ảnh'}</Text>
          <Text style={s.tip}>Ảnh giao hàng được lưu riêng với ảnh mua hàng và hóa đơn. Sau khi bạn xác nhận đã giao, đơn vẫn chờ người đăng xác nhận đã nhận hàng.</Text>
        </>}
        {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
      </ScrollView>
      <View style={s.footer}>{!delivery && <View style={s.totalRow}><Text style={s.body}>Tổng tiền đã chốt</Text><Text style={s.total}>{money((order.estimatedItemsTotal ?? 0) + order.deliveryFee)}</Text></View>}<Pressable accessibilityRole="button" disabled={busy || (delivery && !photos.length)} accessibilityState={{ disabled: busy || (delivery && !photos.length), busy }} onPress={next} style={[s.primary, (busy || (delivery && !photos.length)) && { opacity: 0.5 }]}><Text style={s.primaryText}>{busy ? 'Đang xử lý…' : delivery ? 'Xác nhận đã giao hàng →' : ['Tiếp tục: thêm ảnh →', 'Tiếp tục: kiểm tra →', 'Xác nhận và bắt đầu giao hàng'][step]}</Text></Pressable></View>
    </>}
  </SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, content: { padding: 20, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: colors.border },
  back: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  steps: { flexDirection: 'row', gap: 8, padding: 20, paddingBottom: 0 }, step: { flex: 1, borderTopWidth: 3, borderColor: colors.border, paddingTop: 8 }, active: { borderColor: colors.forest },
  heading: { fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle, lineHeight: lineHeights.pageTitle, color: colors.text },
  eyebrow: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, letterSpacing: letterSpacing.eyebrow, color: colors.coral },
  bold: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, color: colors.forest },
  body: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.text },
  description: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.muted, marginVertical: 8 },
  small: { fontFamily: fontFamilies.body, fontSize: fontSizes.caption, color: colors.muted },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 16, borderRadius: 16, gap: 8 },
  row: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' }, totalRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  tip: { backgroundColor: colors.cream, padding: 16, borderRadius: 14, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.brown },
  secondary: { borderWidth: 1, borderColor: colors.border, borderRadius: 12, padding: 12, minHeight: 44, backgroundColor: colors.surface }, action: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, color: colors.coral },
  upload: { backgroundColor: colors.cream, borderWidth: 1, borderStyle: 'dashed', borderColor: colors.orange, padding: 20, borderRadius: 16 },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginVertical: 12 }, photo: { width: 96, height: 96, borderRadius: 12 }, remove: { position: 'absolute', top: 0, right: 0, width: 32, height: 32, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center', borderRadius: 16 },
  footer: { padding: 16, gap: 12, borderTopWidth: 1, borderColor: colors.border }, total: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodyLarge, color: colors.coral },
  primary: { backgroundColor: colors.orange, borderRadius: 14, padding: 16, alignItems: 'center', minHeight: 50 }, primaryText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, color: colors.forest },
  error: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, color: colors.coral },
});
