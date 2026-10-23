import { useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import { AddressEditor } from './AddressEditor';
import { a, AddressButton, AddressCard, AddressSheet } from './AddressUI';
import type { SavedAddress } from './api';
import { useAddresses } from './useAddresses';

export function AddressPicker({ currentId, onClose, onSelect }: { currentId?: string; onClose: () => void; onSelect: (address: SavedAddress) => void }) {
  const store = useAddresses();
  const [selected, setSelected] = useState(currentId);
  const [adding, setAdding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => { void store.refresh(); }, [store.refresh]);
  const chosen = store.data?.find(a => a.id === selected);
  function select(address: SavedAddress) {
    try { onSelect(address); onClose(); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Không chọn được địa chỉ.'); }
  }
  return <>{!adding && <AddressSheet visible title="Chọn địa chỉ nhận" onClose={onClose} footer={<><AddressButton disabled={!chosen || store.mutating} onPress={() => { if (chosen) select(chosen); }}>Dùng địa chỉ này</AddressButton><Text style={[a.hint, { textAlign: 'center' }]}>Chọn cho đơn này, không đổi địa chỉ mặc định.</Text></>}><ScrollView contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 16 }} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void store.refresh(true).finally(() => setRefreshing(false)); }} />}><Text style={[a.hint, { marginBottom: 14 }]}>Chọn nơi nhận hàng cho lần nhờ này.</Text>{store.data === undefined && store.fetching && <ActivityIndicator color={colors.forest} />}{store.data?.map(address => <AddressCard key={address.id} address={address} selected={selected === address.id} onPress={() => setSelected(address.id)} />)}{store.data?.length === 0 && <View style={a.empty}><Text style={a.bold}>Chưa có địa chỉ nào</Text><Text style={a.body}>Thêm nơi nhận hàng để dùng cho lần nhờ này.</Text></View>}{!!store.error && <View style={{ gap: 10, marginBottom: 12 }}><Text accessibilityRole="alert" style={a.error}>{store.error}</Text><AddressButton secondary onPress={() => void store.refresh(true)}>Thử tải lại</AddressButton></View>}<AddressButton secondary disabled={store.mutating || store.data === undefined} onPress={() => setAdding(true)}>＋ Thêm địa chỉ mới</AddressButton>{!!error && <Text accessibilityRole="alert" style={a.error}>{error}</Text>}</ScrollView></AddressSheet>}{adding && <AddressEditor initial={null} forRequest onClose={() => setAdding(false)} onSaved={select} />}</>;
}
