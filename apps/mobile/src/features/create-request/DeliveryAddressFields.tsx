import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { getProvinces, getWards, Province, Ward } from '@/features/addresses/api';
import { useCurrentLocation, Coordinates } from '@/features/location/LocationProvider';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';

import type { DeliveryAddress } from '@/features/addresses/addressForm';
export { type DeliveryAddress, formatDeliveryAddress, isDeliveryAddressComplete } from '@/features/addresses/addressForm';

const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();

type DropdownProps<T extends Province> = {
  label: string;
  value: T | null;
  options: T[];
  placeholder: string;
  disabled?: boolean;
  loading: boolean;
  error: string;
  expanded: boolean;
  onToggle: () => void;
  onRetry: () => void;
  onSelect: (value: T) => void;
};

function Dropdown<T extends Province>({ label, value, options, placeholder, disabled, loading, error, expanded, onToggle, onRetry, onSelect }: DropdownProps<T>) {
  const [query, setQuery] = useState('');
  useEffect(() => { if (!expanded) setQuery(''); }, [expanded]);
  const matches = options.filter(option => normalize(option.fullName).includes(normalize(query.trim())));
  return <View style={styles.field}>
    <Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${value?.fullName || placeholder}`} accessibilityState={{ expanded, disabled: !!disabled }} disabled={disabled} onPress={onToggle} style={[styles.input, styles.selector, disabled && styles.disabled]}>
      <Text style={[styles.text, styles.flex, !value && styles.muted]}>{value?.fullName || placeholder}</Text>
      <SymbolView name={{ ios: expanded ? 'chevron.up' : 'chevron.down', android: expanded ? 'expand_less' : 'expand_more', web: expanded ? 'expand_less' : 'expand_more' }} size={18} tintColor={colors.forest} />
    </Pressable>
    {expanded && <View style={styles.dropdown}>
      {loading ? <View style={styles.loading}><ActivityIndicator color={colors.forest} /><Text style={styles.text}>Đang tải danh sách…</Text></View>
        : error ? <View style={styles.feedback}><Text accessibilityRole="alert" style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={onRetry} style={styles.option}><Text style={styles.label}>Thử lại</Text></Pressable></View>
        : <>
          <TextInput accessibilityLabel={`Tìm ${label.toLowerCase()}`} value={query} onChangeText={setQuery} placeholder="Tìm nhanh, có thể gõ không dấu" placeholderTextColor={colors.mutedLight} style={[styles.input, styles.search]} autoCorrect={false} />
          <ScrollView nestedScrollEnabled keyboardShouldPersistTaps="handled" style={styles.options}>
            {matches.map(option => <Pressable key={option.code} accessibilityRole="button" accessibilityState={{ selected: option.code === value?.code }} onPress={() => onSelect(option)} style={[styles.option, option.code === value?.code && styles.selected]}><Text style={styles.text}>{option.fullName}</Text></Pressable>)}
            {!matches.length && <Text style={[styles.text, styles.feedback]}>Không tìm thấy kết quả.</Text>}
          </ScrollView>
        </>}
    </View>}
  </View>;
}

export function DeliveryAddressFields({ value, onChange }: { value: DeliveryAddress; onChange: (address: DeliveryAddress) => void }) {
  const { locate, locating, error: locationError } = useCurrentLocation();
  const currentValue = useRef(value);
  currentValue.current = value;
  function selectPoint(point: Coordinates) {
    onChange({ ...currentValue.current, coordinates: point });
  }
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [wardResult, setWardResult] = useState<{ provinceCode: string; rows: Ward[] } | null>(null);
  const [provinceLoading, setProvinceLoading] = useState(true);
  const [wardLoading, setWardLoading] = useState(false);
  const [provinceError, setProvinceError] = useState('');
  const [wardError, setWardError] = useState('');
  const [provinceAttempt, setProvinceAttempt] = useState(0);
  const [wardAttempt, setWardAttempt] = useState(0);
  const [open, setOpen] = useState<'province' | 'ward' | null>(null);
  const provinceCode = value.province?.code;

  useEffect(() => {
    let active = true;
    setProvinceLoading(true); setProvinceError('');
    getProvinces().then(rows => { if (active) setProvinces(rows); })
      .catch(() => { if (active) setProvinceError('Không tải được tỉnh/thành. Kiểm tra kết nối và thử lại.'); })
      .finally(() => { if (active) setProvinceLoading(false); });
    return () => { active = false; };
  }, [provinceAttempt]);

  useEffect(() => {
    let active = true;
    setWardResult(null); setWardError('');
    if (!provinceCode) { setWardLoading(false); return; }
    setWardLoading(true);
    getWards(provinceCode).then(rows => {
      if (active) setWardResult({ provinceCode, rows: rows.filter(row => row.provinceCode === provinceCode) });
    }).catch(() => { if (active) setWardError('Không tải được xã/phường. Kiểm tra kết nối và thử lại.'); })
      .finally(() => { if (active) setWardLoading(false); });
    return () => { active = false; };
  }, [provinceCode, wardAttempt]);

  return <>
    <View style={styles.field}>
      <Text style={styles.label}>Vị trí nhận hàng · Không bắt buộc</Text>
      <Text style={styles.text}>Nếu nhận hàng tại nơi bạn đang đứng, dùng GPS để lưu vị trí. Địa chỉ chữ vẫn nhập thủ công bên dưới.</Text>
      <Pressable accessibilityRole="button" disabled={locating} onPress={async () => { const point = await locate(); if (point) selectPoint(point); }} style={styles.input}><Text style={styles.label}>{locating ? 'Đang lấy vị trí…' : 'Dùng vị trí hiện tại'}</Text></Pressable>
      {!!locationError && <Text accessibilityRole="alert" style={styles.error}>{locationError}</Text>}
      {value.coordinates && <>
        <Text style={styles.text}>Đã lưu tọa độ: {value.coordinates.latitude.toFixed(5)}, {value.coordinates.longitude.toFixed(5)}. Chỉ dùng tọa độ này nếu đúng nơi nhận hàng.</Text>
        <Pressable accessibilityRole="button" onPress={() => onChange({ ...value, coordinates: null })}><Text style={styles.label}>Bỏ vị trí đã lưu</Text></Pressable>
      </>}
      {!value.coordinates && <Text style={styles.text}>Chưa chọn điểm: đơn vẫn đăng được nhưng chưa có khoảng cách.</Text>}
    </View>
    <Dropdown label="Tỉnh / Thành phố" value={value.province} options={provinces} placeholder="Chọn tỉnh / thành phố" loading={provinceLoading} error={provinceError} expanded={open === 'province'} onToggle={() => setOpen(open === 'province' ? null : 'province')} onRetry={() => setProvinceAttempt(n => n + 1)} onSelect={province => {
      onChange({ ...value, province, ward: province.code === provinceCode ? value.ward : null });
      setOpen('ward');
    }} />
    <Dropdown label="Xã / Phường" value={value.ward} options={wardResult?.provinceCode === provinceCode ? wardResult?.rows ?? [] : []} placeholder={provinceCode ? 'Chọn xã / phường' : 'Chọn tỉnh / thành phố trước'} disabled={!provinceCode} loading={wardLoading || (!!provinceCode && wardResult?.provinceCode !== provinceCode && !wardError)} error={wardError} expanded={open === 'ward'} onToggle={() => setOpen(open === 'ward' ? null : 'ward')} onRetry={() => setWardAttempt(n => n + 1)} onSelect={ward => { onChange({ ...value, ward }); setOpen(null); }} />
    <View style={styles.field}><Text style={styles.label}>Số nhà, tên đường</Text><TextInput accessibilityLabel="Số nhà, tên đường" value={value.line1} onChangeText={line1 => onChange({ ...value, line1 })} placeholder="Ví dụ: 12 Nguyễn Huệ, tầng 2" placeholderTextColor={colors.mutedLight} style={styles.input} maxLength={300} autoComplete="street-address" /></View>
    <View style={styles.field}><Text style={styles.label}>Số điện thoại liên hệ</Text><TextInput accessibilityLabel="Số điện thoại liên hệ" value={value.phone} onChangeText={phone => onChange({ ...value, phone })} placeholder="Số điện thoại để người giao liên hệ" placeholderTextColor={colors.mutedLight} style={styles.input} keyboardType="phone-pad" autoComplete="tel" maxLength={21} /></View>
  </>;
}

const styles = StyleSheet.create({
  field: { marginVertical: 10 },
  label: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest, marginBottom: 7 },
  text: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, minHeight: 48, color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall },
  selector: { flexDirection: 'row', alignItems: 'center', gap: 8 }, flex: { flex: 1 },
  muted: { color: colors.muted }, disabled: { opacity: 0.5 },
  dropdown: { marginTop: 6, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, overflow: 'hidden' },
  search: { margin: 8 }, options: { maxHeight: 200 },
  option: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 10 },
  selected: { backgroundColor: colors.chip }, feedback: { padding: 12 },
  loading: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 8 },
  error: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.coral },
});
