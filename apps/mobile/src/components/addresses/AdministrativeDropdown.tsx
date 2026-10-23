import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SymbolView } from 'expo-symbols';
import type { Province } from '@/features/addresses/api';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';

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

export function AdministrativeDropdown<T extends Province>({ label, value, options, placeholder, disabled, loading, error, expanded, onToggle, onRetry, onSelect }: DropdownProps<T>) {
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
