import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { AdministrativeDropdown } from '@/components/addresses/AdministrativeDropdown';

import { getProvinces, getWards, Province, Ward } from '@/features/addresses/api';
import { useCurrentLocation, Coordinates } from '@/features/location/LocationProvider';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';

import type { DeliveryAddress } from '@/features/addresses/addressForm';
export { type DeliveryAddress, formatDeliveryAddress, isDeliveryAddressComplete } from '@/features/addresses/addressForm';

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
    <View style={styles.field}><Text style={styles.label}>Số điện thoại liên hệ</Text><TextInput accessibilityLabel="Số điện thoại liên hệ" value={value.phone} onChangeText={phone => onChange({ ...value, phone })} placeholder="Số điện thoại để người giao liên hệ" placeholderTextColor={colors.mutedLight} style={styles.input} keyboardType="phone-pad" autoComplete="tel" maxLength={21} /></View>
    <AdministrativeDropdown label="Tỉnh / Thành phố" value={value.province} options={provinces} placeholder="Chọn tỉnh / thành phố" loading={provinceLoading} error={provinceError} expanded={open === 'province'} onToggle={() => setOpen(open === 'province' ? null : 'province')} onRetry={() => setProvinceAttempt(n => n + 1)} onSelect={province => {
      onChange({ ...value, province, ward: province.code === provinceCode ? value.ward : null });
      setOpen('ward');
    }} />
    <AdministrativeDropdown label="Xã / Phường" value={value.ward} options={wardResult?.provinceCode === provinceCode ? wardResult?.rows ?? [] : []} placeholder={provinceCode ? 'Chọn xã / phường' : 'Chọn tỉnh / thành phố trước'} disabled={!provinceCode} loading={wardLoading || (!!provinceCode && wardResult?.provinceCode !== provinceCode && !wardError)} error={wardError} expanded={open === 'ward'} onToggle={() => setOpen(open === 'ward' ? null : 'ward')} onRetry={() => setWardAttempt(n => n + 1)} onSelect={ward => { onChange({ ...value, ward }); setOpen(null); }} />
    <View style={styles.field}><Text style={styles.label}>Số nhà, tên đường</Text><TextInput accessibilityLabel="Số nhà, tên đường" value={value.line1} onChangeText={line1 => onChange({ ...value, line1 })} placeholder="Ví dụ: 12 Nguyễn Huệ, tầng 2" placeholderTextColor={colors.mutedLight} style={styles.input} maxLength={300} autoComplete="street-address" /></View>


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
  </>;
}

const styles = StyleSheet.create({
  field: { marginVertical: 10 },
  label: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest, marginBottom: 7 },
  text: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, padding: 12, minHeight: 48, color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall },
  error: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.coral },
});
