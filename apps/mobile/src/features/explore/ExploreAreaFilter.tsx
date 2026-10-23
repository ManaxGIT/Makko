import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AdministrativeDropdown } from '@/components/addresses/AdministrativeDropdown';
import { getProvinces, getWards, Province, Ward } from '@/features/addresses/api';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';

export type ExploreArea = { province: Province | null; ward: Ward | null };

export function ExploreAreaFilter({ mode, onModeChange, value, onChange, locating, hasCoordinates, locate, locationError }: {
  mode: 'nearby' | 'area'; onModeChange: (mode: 'nearby' | 'area') => void;
  value: ExploreArea; onChange: (value: ExploreArea) => void;
  locating: boolean; hasCoordinates: boolean; locate: () => void; locationError: string | null;
}) {
  const [provinces, setProvinces] = useState<Province[]>([]);
  const [wards, setWards] = useState<{ code: string; rows: Ward[] } | null>(null);
  const [provinceError, setProvinceError] = useState('');
  const [wardError, setWardError] = useState('');
  const [provinceLoading, setProvinceLoading] = useState(false);
  const [wardLoading, setWardLoading] = useState(false);
  const [provinceAttempt, setProvinceAttempt] = useState(0);
  const [wardAttempt, setWardAttempt] = useState(0);
  const [open, setOpen] = useState<'province' | 'ward' | null>(null);
  const wardCache = useRef(new Map<string, Ward[]>());
  const code = value.province?.code;

  useEffect(() => {
    if (mode !== 'area' || provinces.length) return;
    let active = true;
    setProvinceLoading(true); setProvinceError('');
    getProvinces().then(rows => { if (active) setProvinces(rows); })
      .catch(() => { if (active) setProvinceError('Không tải được tỉnh/thành. Vui lòng thử lại.'); })
      .finally(() => { if (active) setProvinceLoading(false); });
    return () => { active = false; };
  }, [mode, provinceAttempt, provinces.length]);

  useEffect(() => {
    setWardError('');
    if (!code) { setWardLoading(false); return; }
    const cached = wardCache.current.get(code);
    if (cached) { setWards({ code, rows: cached }); setWardLoading(false); return; }
    let active = true;
    setWardLoading(true);
    getWards(code).then(rows => {
      if (!active) return;
      const matches = rows.filter(row => row.provinceCode === code);
      wardCache.current.set(code, matches);
      setWards({ code, rows: matches });
    }).catch(() => { if (active) setWardError('Không tải được xã/phường. Vui lòng thử lại.'); })
      .finally(() => { if (active) setWardLoading(false); });
    return () => { active = false; };
  }, [code, wardAttempt]);

  return <View style={styles.card}>
    <View style={styles.modes}>
      {(['nearby', 'area'] as const).map(item => <Pressable key={item} accessibilityRole="button" accessibilityState={{ selected: mode === item }} onPress={() => { setOpen(null); onModeChange(item); }} style={[styles.mode, mode === item && styles.selected]}><Text style={[styles.modeText, mode === item && styles.bold]}>{item === 'nearby' ? 'Gần tôi' : 'Chọn khu vực'}</Text></Pressable>)}
    </View>
    {mode === 'nearby' ? <>
      <Pressable accessibilityRole="button" disabled={locating} onPress={locate} style={styles.locate}>
        <Text style={styles.title}>{locating ? 'Đang lấy vị trí…' : hasCoordinates ? 'Vị trí hiện tại · trong 3 km' : 'Bật vị trí để tìm đơn gần bạn'}</Text>
        <Text style={styles.hint}>{hasCoordinates ? 'Khoảng cách theo đường chim bay · Nhấn để cập nhật vị trí' : 'Hoặc chọn tỉnh/thành, xã/phường để tìm đơn.'}</Text>
      </Pressable>
      {!!locationError && <Text accessibilityRole="alert" style={styles.error}>{locationError}</Text>}
    </> : <>
      <Text style={styles.title}>{[value.ward?.fullName, value.province?.fullName].filter(Boolean).join(' · ') || 'Chọn khu vực muốn tìm đơn'}</Text>
      <Text style={styles.hint}>Tìm trong khu vực đã chọn</Text>
      <AdministrativeDropdown label="Tỉnh / Thành phố" value={value.province} options={provinces} placeholder="Chọn tỉnh / thành phố" loading={provinceLoading} error={provinceError} expanded={open === 'province'} onToggle={() => setOpen(open === 'province' ? null : 'province')} onRetry={() => setProvinceAttempt(n => n + 1)} onSelect={province => { onChange({ province, ward: province.code === code ? value.ward : null }); setOpen(null); }} />
      <AdministrativeDropdown label="Xã / Phường" value={value.ward} options={wards && wards.code === code ? wards.rows : []} placeholder={code ? 'Tất cả xã / phường' : 'Chọn tỉnh / thành phố trước'} disabled={!code} loading={wardLoading || (!!code && wards?.code !== code && !wardError)} error={wardError} expanded={open === 'ward'} onToggle={() => setOpen(open === 'ward' ? null : 'ward')} onRetry={() => setWardAttempt(n => n + 1)} onSelect={ward => { onChange({ ...value, ward }); setOpen(null); }} />
      {value.ward && <Pressable accessibilityRole="button" onPress={() => { onChange({ ...value, ward: null }); setOpen(null); }}><Text style={styles.clear}>Xem tất cả xã / phường</Text></Pressable>}
    </>}
  </View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.cream, borderRadius: 15, marginHorizontal: 20, padding: 12, marginBottom: 14 },
  modes: { flexDirection: 'row', backgroundColor: colors.border, padding: 4, borderRadius: 11, marginBottom: 12 },
  mode: { flex: 1, alignItems: 'center', justifyContent: 'center', minHeight: 42, borderRadius: 8, padding: 6 },
  selected: { backgroundColor: colors.surface },
  modeText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall },
  bold: { fontFamily: fontFamilies.bodyBold },
  locate: { minHeight: 48, justifyContent: 'center' },
  title: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall },
  hint: { color: colors.brown, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, marginTop: 4 },
  clear: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, paddingVertical: 10 },
  error: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, marginTop: 8 },
});
