import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, ScrollView, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { DeliveryAddressFields } from '@/features/create-request/DeliveryAddressFields';
import { ApiError } from '@/lib/api';
import { colors } from '@/theme/colors';
import { a, AddressButton } from './AddressUI';
import { DeliveryAddress, fromSavedAddress, isDeliveryAddressComplete } from './addressForm';
import type { SavedAddress } from './api';
import { useAddresses } from './useAddresses';

export function AddressEditor({ initial, forRequest = false, onClose, onSaved }: { initial: SavedAddress | null; forRequest?: boolean; onClose: () => void; onSaved?: (saved: SavedAddress) => void }) {
  const store = useAddresses();
  const [address, setAddress] = useState<DeliveryAddress>(() => initial ? { ...fromSavedAddress(initial), savedAddress: null } : { phone: '', line1: '', province: null, ward: null });
  const [label, setLabel] = useState(initial?.label ?? '');
  const [name, setName] = useState(initial?.recipientName ?? '');
  const [note, setNote] = useState(initial?.deliveryNote ?? '');
  const first = store.data?.length === 0;
  const [isDefault, setIsDefault] = useState(initial?.isDefault ?? first);
  const [error, setError] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // Prevent a late save from applying to a form that has already unmounted.
  // The shared cache still receives confirmed results for the same account.
  async function save() {
    if (lock.current) return;
    if (!label.trim() || !name.trim() || !isDeliveryAddressComplete(address) || !address.province || !address.ward) { setError('Vui lòng nhập nhãn, người nhận, số điện thoại và địa chỉ đầy đủ.'); return; }
    lock.current = true; setError('');
    try {
      const body = { label: label.trim(), recipientName: name.trim(), recipientPhone: address.phone.trim(), line1: address.line1.trim(), line2: initial?.line2 ?? null, provinceCode: address.province.code, wardCode: address.ward.code, latitude: address.coordinates?.latitude ?? null, longitude: address.coordinates?.longitude ?? null, deliveryNote: note.trim() || null, isDefault: isDefault || first };
      const saved = initial ? (await store.update(initial.id, body)).find(a => a.id === initial.id)! : await store.create(body);
      if (alive.current) { onSaved?.(saved); onClose(); }
    } catch (failure) {
      if (alive.current) {
        if (!(failure instanceof ApiError) || failure.status >= 500 || failure.status === 408) {
          setUncertain(true);
          setError('Chưa xác nhận được kết quả lưu. Đóng form và kiểm tra danh sách đã cập nhật trước khi thử lại.');
          void store.refresh(true);
        } else setError(failure.message);
      }
    }
    finally { lock.current = false; }
  }
  return <Modal animationType="slide" onRequestClose={() => { if (!store.mutating) onClose(); }}><SafeAreaView style={a.safe} edges={['top', 'bottom', 'left', 'right']}><KeyboardAvoidingView style={a.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={[a.content, a.row, a.between]}><Text style={a.title}>{initial ? 'Sửa địa chỉ' : 'Thêm địa chỉ'}</Text><AddressButton secondary onPress={onClose} disabled={store.mutating}>Đóng</AddressButton></View><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={a.content}><View pointerEvents={store.mutating ? 'none' : 'auto'}><EditorField label="Tên địa chỉ" value={label} onChangeText={setLabel} placeholder="Nhà, Công ty, Nhà bố mẹ…" maxLength={60} /><EditorField label="Người nhận" value={name} onChangeText={setName} placeholder="Họ và tên" maxLength={160} /><DeliveryAddressFields value={address} onChange={setAddress} /><EditorField label="Ghi chú giao hàng · Không bắt buộc" value={note} onChangeText={setNote} placeholder="Ví dụ: Gọi mình khi đến cổng" maxLength={500} multiline /><View style={[a.row, { marginVertical: 16 }]}><Switch accessibilityLabel="Đặt làm địa chỉ mặc định" value={isDefault || first} disabled={first || !!initial?.isDefault} onValueChange={setIsDefault} /><Text style={a.body}>Đặt làm địa chỉ mặc định</Text></View>{!!initial && <Text style={a.hint}>Thay đổi này không sửa địa chỉ trên các đơn đã đăng.</Text>}</View>{!!error && <Text accessibilityRole="alert" style={a.error}>{error}</Text>}</ScrollView><View style={a.footer}><AddressButton onPress={() => void save()} disabled={store.mutating || uncertain}>{store.mutating ? 'Đang lưu…' : forRequest ? 'Lưu và dùng địa chỉ' : 'Lưu địa chỉ'}</AddressButton><Text style={[a.hint, { textAlign: 'center' }]}>Địa chỉ được lưu độc lập với việc đăng yêu cầu.</Text></View></KeyboardAvoidingView></SafeAreaView></Modal>;
}
function EditorField({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  return <View style={a.field}><Text style={a.smallBold}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor={colors.mutedLight} {...props} style={a.input} /></View>;
}
