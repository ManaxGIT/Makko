import { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, TextInputProps, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, letterSpacing, lineHeights } from '@/theme/typography';
import { RequestItem, useCreateRequest } from './CreateRequestProvider';

const money = (value: string | number) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;
const moneyInput = (value: string) => value ? Number(value).toLocaleString('vi-VN') : '';
const units = ['kg', 'gram', 'bó', 'quả', 'hộp', 'gói', 'chai', 'con'];
function Action({ label, onPress, danger = false }: { label: string; onPress: () => void; danger?: boolean }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={s.action}><Text style={[s.actionText, danger && s.danger]}>{label}</Text></Pressable>;
}
function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={s.field}><Text style={s.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.mutedLight} {...props} style={[s.input, props.multiline && s.multiline, props.style]} /></View>;
}
function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return <Pressable accessibilityRole="radio" accessibilityState={{ selected }} onPress={onPress} style={[s.choice, selected && s.selected]}><Text style={s.body}>{label}</Text></Pressable>;
}
export function CreateRequestScreen({ step }: { step: 1 | 2 | 3 | 4 }) {
  const router = useRouter();
  const { form, patch, reset } = useCreateRequest();
  const [item, setItem] = useState<RequestItem | null>(null);
  const [customUnit, setCustomUnit] = useState(false);
  const [addressOpen, setAddressOpen] = useState(false);
  const [address, setAddress] = useState({ recipient: '', phone: '', address: '' });
  const [error, setError] = useState('');
  const [modalError, setModalError] = useState('');
  const nextId = useRef(0);
  function goBack() {
    if (router.canGoBack()) router.back();
    else router.replace(step === 3 ? '/create/delivery' : step === 2 ? '/create/items' : '/(tabs)');
  }
  function openItem(existing?: RequestItem) {
    setModalError('');
    setCustomUnit(!!existing && !units.includes(existing.unit));
    setItem(existing ? { ...existing } : { id: `item-${Date.now()}-${nextId.current++}`, name: '', quantity: '1', unit: 'kg', note: '', allowSubstitution: false });
  }
  function saveItem() {
    if (!item) return;
    const quantity = Number(item.quantity.replace(',', '.'));
    if (!item.name.trim() || !Number.isFinite(quantity) || quantity <= 0 || !/^\d+(?:[.,]\d{1,3})?$/.test(item.quantity)) {
      setModalError('Nhập tên món và số lượng lớn hơn 0 (tối đa 3 số thập phân).'); return;
    }
    if (!item.unit.trim()) { setModalError('Vui lòng nhập đơn vị mua.'); return; }
    const saved = { ...item, name: item.name.trim(), unit: item.unit.trim(), note: item.note.trim() };
    patch({ items: form.items.some(i => i.id === item.id) ? form.items.map(i => i.id === item.id ? saved : i) : [...form.items, saved] });
    setItem(null); setError('');
  }
  function proceed() {
    setError('');
    if (step === 1) {
      if (!form.items.length) { setError('Thêm ít nhất một món để tiếp tục.'); return; }
      router.push('/create/delivery');
    } else if (step === 2) {
      if (!form.recipient.trim() || !form.address.trim() || form.phone.replace(/\D/g, '').length < 9) { setError('Vui lòng bổ sung đầy đủ thông tin người nhận và địa chỉ.'); return; }
      if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(form.time)) { setError('Nhập giờ giao theo định dạng HH:mm, ví dụ 18:00.'); return; }
      if (!form.fee || !Number.isFinite(Number(form.fee))) { setError('Vui lòng nhập phí đi chợ.'); return; }
      router.push('/create/review');
    } else if (step === 3) {
      if (!form.items.length) { router.dismissTo('/create/items'); return; }
      // This supplied design is a UI preview. Do not report a real publish without an API response.
      router.push('/create/success');
    } else { reset(); router.dismissTo('/create/items'); }
  }
  const heading = ['Hôm nay mua gì?', 'Giao đến bạn.', 'Sẵn sàng nhờ đi chợ?', 'Đang tìm người\nđi chợ giúp bạn.'][step - 1];
  const intro = ['Thêm những món bạn cần, Makko giúp bạn kết nối với người đi chợ.', 'Chọn nơi nhận và thời gian bạn cần hàng.', 'Kiểm tra một lượt trước khi đăng yêu cầu.', 'Khi có người nhận, bạn có thể theo dõi tiến trình của yêu cầu.'][step - 1];
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={s.header}>{step < 4 && <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={goBack} hitSlop={7} style={({ pressed }) => [s.backButton, pressed && { opacity: 0.62 }]}><SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={19} tintColor="#000000" /></Pressable>}<Text style={s.headerTitle}>Đăng yêu cầu</Text><Text style={s.small}>{step === 4 ? 'Hoàn tất' : `Bước ${step} / 3`}</Text></View>
    <View style={s.progress}>{[1, 2, 3].map(i => <View key={i} style={[s.segment, i <= step && s.activeSegment]} />)}</View>
    <ScrollView style={s.flex} contentContainerStyle={[s.content, step === 4 && s.successContent]} keyboardShouldPersistTaps="handled">
      {step === 4 && <View style={s.successIcon}><Text style={s.check}>✓</Text></View>}
      <Text style={s.eyebrow}>{['DANH SÁCH ĐI CHỢ', 'GIAO HÀNG & CHI PHÍ', 'KIỂM TRA LẠI', 'XEM TRƯỚC SAU KHI ĐĂNG'][step - 1]}</Text>
      <Text style={[s.heading, step === 4 && s.center]}>{heading}</Text><Text style={[s.description, step === 4 && s.center]}>{intro}</Text>
      {step === 1 && <>
        <View style={s.sectionRow}><Text style={s.bold}>Món cần mua</Text><Text style={s.bold}>{form.items.length} món</Text></View>
        {form.items.map(i => <View key={i.id} style={[s.card, s.row]}><View style={s.cart}><Text style={s.cartText}>🛒</Text></View><View style={s.flex}><Text style={s.bold}>{i.name}</Text><Text style={s.small}>{i.quantity} {i.unit}{i.note ? ` · ${i.note}` : ''}</Text></View><Action label="Sửa" onPress={() => openItem(i)} /><Action label="Xóa" danger onPress={() => patch({ items: form.items.filter(row => row.id !== i.id) })} /></View>)}
        {!form.items.length && <Text style={s.description}>Danh sách còn trống. Thêm món đầu tiên bên dưới.</Text>}
        <Pressable accessibilityRole="button" onPress={() => openItem()} style={s.add}><Text style={s.bold}>＋ Thêm món</Text></Pressable>
        <View style={s.soft}><Text style={s.bold}>Không biết giá? Không sao.</Text><Text style={s.description}>Bạn chỉ cần ghi món và số lượng. Có thể điền tiền hàng dự kiến cho cả giỏ ở bước tiếp theo.</Text></View>
        <Text style={s.small}>Dữ liệu minh họa để thử giao diện. Chưa tạo yêu cầu thật.</Text>
      </>}
      {step === 2 && <>
        <View style={s.sectionRow}><Text style={s.bold}>Địa chỉ nhận</Text><Action label="Thay đổi" onPress={() => { setAddress({ recipient: form.recipient, phone: form.phone, address: form.address }); setModalError(''); setAddressOpen(true); }} /></View>
        <View style={s.card}><Text style={s.bold}>{form.recipient || 'Chưa có người nhận'}{form.phone ? ` · ${form.phone}` : ''}</Text><Text style={s.description}>{form.address || 'Chọn Thay đổi để nhập địa chỉ'}</Text><Text style={s.small}>Thông tin chỉ dùng cho yêu cầu đang nhập, chưa lưu lên hệ thống</Text></View>
        <Text style={s.label}>Ngày nhận</Text><View style={s.row}><Choice label="Hôm nay" selected={form.day === 'today'} onPress={() => patch({ day: 'today' })} /><Choice label="Ngày mai" selected={form.day === 'tomorrow'} onPress={() => patch({ day: 'tomorrow' })} /></View>
        <View style={s.row}><View style={s.flex}><Field label="Giao trước (HH:mm)" value={form.time} onChangeText={time => patch({ time })} placeholder="18:00" maxLength={5} keyboardType="numbers-and-punctuation" /></View><Image source={require('../../../assets/images/request-clock.png')} style={s.clock} /></View>
        <Field label="Tiền hàng dự kiến · Không bắt buộc" value={moneyInput(form.budget)} onChangeText={v => patch({ budget: v.replace(/\D/g, '').slice(0, 10) })} placeholder="Ví dụ: 150.000" keyboardType="number-pad" />
        <Text style={s.small}>Đơn vị: đồng. Ước tính cho cả giỏ, chưa gồm phí đi chợ. Tiền thực tế có thể thay đổi.</Text>
        <Field label="Phí đi chợ bạn đề nghị (đ)" value={moneyInput(form.fee)} onChangeText={v => patch({ fee: v.replace(/\D/g, '').slice(0, 10) })} keyboardType="number-pad" />
        <Text style={s.label}>Thanh toán</Text><View style={s.row}><Choice label="Tiền mặt" selected={form.payment === 'cash'} onPress={() => patch({ payment: 'cash' })} /><Choice label="Chuyển khoản" selected={form.payment === 'bank_transfer'} onPress={() => patch({ payment: 'bank_transfer' })} /></View>
        <Field label="Lưu ý giao hàng · Không bắt buộc" value={form.deliveryNote} onChangeText={deliveryNote => patch({ deliveryNote })} multiline placeholder="Ví dụ: Gọi mình khi đến sảnh." maxLength={500} />
      </>}
      {step === 3 && <>
        <View style={s.sectionRow}><Text style={s.bold}>Món cần mua</Text><Action label="Sửa" onPress={() => router.dismissTo('/create/items')} /></View>
        <View style={s.card}>{form.items.map(i => <View key={i.id} style={s.reviewItem}><Text style={s.bold}>{i.name} · {i.quantity} {i.unit}</Text>{!!i.note && <Text style={s.description}>{i.note}</Text>}<Text style={s.small}>{i.allowSubstitution ? 'Có thể mua loại tương tự' : 'Không tự thay loại khác'}</Text></View>)}</View>
        <View style={s.sectionRow}><Text style={s.bold}>Thông tin giao hàng</Text><Action label="Sửa" onPress={() => router.dismissTo('/create/delivery')} /></View>
        <View style={s.card}><Text style={s.bold}>{form.recipient} · {form.phone}</Text><Text style={s.description}>{form.address}</Text><Text style={s.description}>{form.day === 'today' ? 'Hôm nay' : 'Ngày mai'} · Giao trước {form.time}</Text><Text style={s.description}>Thanh toán: {form.payment === 'cash' ? 'Tiền mặt' : 'Chuyển khoản'}</Text>{!!form.deliveryNote && <Text style={s.description}>{form.deliveryNote}</Text>}</View>
        <View style={s.soft}><View style={s.sectionRow}><Text style={s.body}>Tiền hàng dự kiến</Text><Text style={s.bold}>{form.budget ? money(form.budget) : 'Chưa ước tính'}</Text></View><View style={s.sectionRow}><Text style={s.body}>Phí đi chợ</Text><Text style={s.bold}>{money(form.fee)}</Text></View><View style={[s.sectionRow, s.total]}><Text style={s.body}>Tổng dự kiến</Text><Text style={s.totalText}>{form.budget ? money(Number(form.budget) + Number(form.fee)) : 'Chưa xác định'}</Text></View><Text style={s.small}>{form.budget ? 'Tiền hàng thực tế có thể khác số tiền dự kiến.' : 'Bạn sẽ trả tiền hàng thực tế và phí đi chợ ở trên.'}</Text></View>
        <Text style={s.small}>Bản xem thử, chưa đăng yêu cầu lên hệ thống.</Text>
      </>}
      {step === 4 && <View style={s.soft}><Text style={[s.body, s.center]}>Đây là trạng thái mô phỏng.{ '\n' }Chưa có yêu cầu nào được tạo thật.</Text></View>}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    </ScrollView>
    <View style={s.footer}><Pressable accessibilityRole="button" onPress={proceed} style={s.primary}><Text style={s.primaryText}>{step === 4 ? 'Thử tạo yêu cầu khác' : step === 3 ? 'Đăng yêu cầu' : 'Tiếp tục →'}</Text></Pressable><Text style={[s.small, s.footerHint]}>{step === 1 ? 'Tiếp theo: địa chỉ, thời gian và chi phí' : step === 2 ? 'Tiếp theo: kiểm tra trước khi đăng' : 'Bản xem thử · Chưa tạo yêu cầu thật'}</Text></View>
  </KeyboardAvoidingView>
  <Modal visible={!!item || addressOpen} transparent animationType="slide" onRequestClose={() => { setItem(null); setAddressOpen(false); }}><View style={s.overlay}><SafeAreaView style={s.modalSafe}><KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={s.modal}>
    <View style={s.sectionRow}><Text style={s.bold}>{item ? 'Thông tin món' : 'Địa chỉ nhận'}</Text><Action label="Đóng" onPress={() => { setItem(null); setAddressOpen(false); }} /></View>
    {item ? <><Field label="Tên món" value={item.name} onChangeText={name => setItem({ ...item, name })} maxLength={160} placeholder="Ví dụ: Thịt heo nạc vai" /><Field label="Số lượng" value={item.quantity} onChangeText={quantity => setItem({ ...item, quantity })} keyboardType="decimal-pad" /><Text style={s.label}>Đơn vị</Text><View style={s.wrap}>{units.map(unit => <Choice key={unit} label={unit} selected={!customUnit && item.unit === unit} onPress={() => { setCustomUnit(false); setItem({ ...item, unit }); }} />)}<Choice label="Khác" selected={customUnit} onPress={() => { setCustomUnit(true); if (!customUnit) setItem({ ...item, unit: '' }); }} /></View>{customUnit && <Field label="Đơn vị tự nhập" value={item.unit} onChangeText={unit => setItem({ ...item, unit })} placeholder="Ví dụ: nải, lon, mớ…" maxLength={40} />}<Field label="Dặn người mua · Không bắt buộc" value={item.note} onChangeText={note => setItem({ ...item, note })} multiline maxLength={500} /><View style={s.row}><Switch accessibilityLabel="Cho phép mua loại tương tự" value={item.allowSubstitution} onValueChange={allowSubstitution => setItem({ ...item, allowSubstitution })} /><Text style={[s.body, s.flex]}>Cho phép mua loại tương tự nếu hết hàng</Text></View></> : <><Field label="Người nhận" value={address.recipient} onChangeText={recipient => setAddress({ ...address, recipient })} /><Field label="Số điện thoại" value={address.phone} onChangeText={phone => setAddress({ ...address, phone })} keyboardType="phone-pad" /><Field label="Địa chỉ đầy đủ" value={address.address} onChangeText={value => setAddress({ ...address, address: value })} multiline /></>}
    {!!modalError && <Text accessibilityRole="alert" style={s.error}>{modalError}</Text>}<Pressable accessibilityRole="button" style={s.primary} onPress={() => { if (item) saveItem(); else { if (!address.recipient.trim() || !address.address.trim() || address.phone.replace(/\D/g, '').length < 9) { setModalError('Nhập đầy đủ người nhận, số điện thoại và địa chỉ.'); return; } patch(address); setAddressOpen(false); } }}><Text style={s.primaryText}>{item ? 'Xong' : 'Dùng địa chỉ này'}</Text></Pressable>
  </ScrollView></KeyboardAvoidingView></SafeAreaView></View></Modal>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  backButton: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
  body: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest }, bold: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest },
  small: { fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, color: colors.muted },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, minHeight: 60, borderBottomWidth: 1, borderColor: colors.border }, headerTitle: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, color: colors.forest },
  progress: { flexDirection: 'row', gap: 6, marginHorizontal: 20, marginTop: 18 }, segment: { flex: 1, height: 4, borderRadius: 4, backgroundColor: colors.timelinePending }, activeSegment: { backgroundColor: colors.forest },
  content: { padding: 20, paddingTop: 14 }, eyebrow: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, letterSpacing: letterSpacing.eyebrow, color: colors.statusGreen }, heading: { fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle, lineHeight: lineHeights.pageTitle, color: colors.forest, marginTop: 8, marginBottom: 10 }, description: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.body, color: colors.muted, marginVertical: 5 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginVertical: 10 }, row: { flexDirection: 'row', alignItems: 'center', gap: 8 }, card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, padding: 14, borderRadius: 14, marginBottom: 12 }, cart: { width: 40, height: 40, borderRadius: 10, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' }, cartText: { fontSize: fontSizes.sectionTitle }, action: { paddingHorizontal: 6, minHeight: 44, justifyContent: 'center' }, actionText: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, color: colors.statusGreen }, danger: { color: colors.coral },
  add: { borderWidth: 1, borderStyle: 'dashed', borderColor: colors.statusGreen, borderRadius: 12, padding: 14, alignItems: 'center', backgroundColor: colors.chip }, soft: { backgroundColor: colors.requestMeta, padding: 14, borderRadius: 14, marginVertical: 17, width: '100%' }, field: { marginVertical: 12 }, label: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, color: colors.forest, marginBottom: 7 }, input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, minHeight: 46, color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall }, multiline: { minHeight: 70, textAlignVertical: 'top' }, choice: { borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, backgroundColor: colors.surface, minHeight: 44 }, selected: { borderColor: colors.forest, backgroundColor: colors.chip }, wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, clock: { width: 12.59, height: 12.59, marginTop: 18 },
  reviewItem: { marginBottom: 12 }, total: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: colors.border, paddingTop: 12 }, totalText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.sectionTitle, color: colors.forest }, footer: { borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 }, primary: { backgroundColor: colors.forest, borderRadius: 12, padding: 16, minHeight: 50, alignItems: 'center', marginTop: 8 }, primaryText: { color: colors.surface, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.action }, footerHint: { textAlign: 'center', marginTop: 8 }, center: { textAlign: 'center' }, successContent: { alignItems: 'center', paddingTop: 55 }, successIcon: { width: 90, height: 90, borderRadius: 45, backgroundColor: colors.vegetable, justifyContent: 'center', alignItems: 'center', marginBottom: 25 }, check: { fontSize: fontSizes.display, color: colors.forest }, error: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, marginVertical: 12 }, overlay: { flex: 1, backgroundColor: 'rgba(33,58,47,0.5)', justifyContent: 'center', padding: 20 }, modalSafe: { maxHeight: '100%' }, modal: { backgroundColor: colors.background, borderRadius: 20, padding: 20 },
});
