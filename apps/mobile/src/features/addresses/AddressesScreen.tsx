import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '@/theme/colors';
import { AddressEditor } from './AddressEditor';
import { a, AddressButton, AddressCard, AddressSheet } from './AddressUI';
import type { SavedAddress } from './api';
import { useAddresses } from './useAddresses';

export default function AddressesScreen() {
  const router = useRouter();
  const store = useAddresses();
  const [editing, setEditing] = useState<SavedAddress | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<SavedAddress | null>(null);
  const [replacement, setReplacement] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  useFocusEffect(useCallback(() => { void store.refresh(); }, [store.refresh]));
  async function changeDefault(address: SavedAddress) {
    setError('');
    try { await store.setDefault(address.id); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Không đổi được địa chỉ mặc định.'); }
  }
  async function remove() {
    if (!deleting) return;
    setError('');
    try { await store.remove(deleting.id, replacement); setDeleting(null); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Không xóa được địa chỉ.'); }
  }
  const alternatives = store.data?.filter(a => a.id !== deleting?.id) ?? [];
  const needsReplacement = !!deleting?.isDefault && alternatives.length > 0;
  return <SafeAreaView style={a.safe} edges={['top', 'bottom', 'left', 'right']}><View style={[a.content, a.row]}><Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => router.back()} style={a.close}><Text style={a.closeText}>‹</Text></Pressable><Text style={[a.title, a.flex]}>Địa chỉ của tôi</Text></View><ScrollView contentContainerStyle={a.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void store.refresh(true).finally(() => setRefreshing(false)); }} />}><Text style={[a.body, { marginBottom: 8 }]}>Những nơi bạn thường nhận hàng. Địa chỉ mặc định được điền cho yêu cầu mới.</Text>{store.fetching && <View style={a.row}><ActivityIndicator color={colors.forest} /><Text style={a.hint}>{store.data ? 'Đang cập nhật địa chỉ…' : 'Đang tải địa chỉ…'}</Text></View>}{store.data?.length === 0 && <View style={a.empty}><Text style={a.title}>⌂</Text><Text style={a.bold}>Chưa có địa chỉ nào</Text><Text style={a.body}>Thêm nơi nhận hàng để dùng nhanh cho lần sau.</Text></View>}{store.data?.map(address => <AddressCard key={address.id} address={address}><View style={a.actions}>{address.isDefault ? <Text style={[a.hint, a.flex]}>Địa chỉ cho yêu cầu mới</Text> : <Pressable accessibilityRole="button" disabled={store.mutating} onPress={() => void changeDefault(address)} style={[a.touch, a.flex]}><Text style={a.link}>Đặt mặc định</Text></Pressable>}<Pressable accessibilityRole="button" disabled={store.mutating} onPress={() => setEditing(address)} style={a.touch}><Text style={a.link}>Sửa</Text></Pressable><Pressable accessibilityRole="button" disabled={store.mutating} onPress={() => { setDeleting(address); setReplacement(null); setError(''); }} style={a.touch}><Text style={[a.link, a.danger]}>Xóa</Text></Pressable></View></AddressCard>)}{!deleting && !!(error || store.error) && <Text accessibilityRole="alert" style={a.error}>{error || store.error}</Text>}{!!store.error && <AddressButton secondary onPress={() => void store.refresh(true)}>Thử tải lại</AddressButton>}</ScrollView><View style={a.footer}><AddressButton disabled={store.mutating || store.data === undefined} onPress={() => setEditing(null)}>＋ Thêm địa chỉ mới</AddressButton><Text style={[a.hint, { textAlign: 'center' }]}>{store.data?.length ? `${store.data.length} địa chỉ đã lưu` : 'Địa chỉ đầu tiên sẽ là địa chỉ mặc định'}</Text></View>{editing !== undefined && <AddressEditor initial={editing} onClose={() => setEditing(undefined)} />}{deleting && <AddressSheet visible title="Xóa địa chỉ?" onClose={() => { if (!store.mutating) setDeleting(null); }} footer={<><AddressButton disabled={store.mutating || (needsReplacement && !replacement)} onPress={() => void remove()}>{store.mutating ? 'Đang xóa…' : 'Xóa địa chỉ'}</AddressButton><AddressButton secondary disabled={store.mutating} onPress={() => setDeleting(null)}>Giữ lại</AddressButton></>}><ScrollView contentContainerStyle={a.content}><Text style={a.body}>Xóa “{deleting.label}” khỏi sổ địa chỉ? Địa chỉ trên các đơn đã đăng vẫn được giữ nguyên.</Text>{needsReplacement && <><Text style={a.bold}>Chọn địa chỉ mặc định thay thế</Text>{alternatives.map(address => <AddressCard key={address.id} address={address} selected={replacement === address.id} onPress={() => { if (!store.mutating) setReplacement(address.id); }} />)}</>}{!!error && <Text accessibilityRole="alert" style={a.error}>{error}</Text>}</ScrollView></AddressSheet>}</SafeAreaView>;
}
