import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type DateChoice = 'today' | 'tomorrow' | 'custom';
type TimeChoice = '16:00' | '17:30' | '18:30' | 'custom';

function AppIcon({ name, color = colors.text, size = 16 }: {
  name: SymbolName;
  color?: string;
  size?: number;
}) {
  return <SymbolView name={name} size={size} tintColor={color} fallback={<Text style={{ color, fontSize: size }}>•</Text>} />;
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

function ChoiceButton({
  active,
  label,
  onPress,
  sublabel,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
  sublabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => [styles.choiceButton, active && styles.choiceButtonActive, pressed && styles.pressed]}
    >
      <Text style={[styles.choiceLabel, active && styles.choiceLabelActive]}>{label}</Text>
      {sublabel && <Text style={[styles.choiceSublabel, active && styles.choiceSublabelActive]}>{sublabel}</Text>}
    </Pressable>
  );
}

export default function DeliveryScreen() {
  const router = useRouter();
  const [dateChoice, setDateChoice] = useState<DateChoice>('tomorrow');
  const [customDate, setCustomDate] = useState('');
  const [timeChoice, setTimeChoice] = useState<TimeChoice>('17:30');
  const [customTime, setCustomTime] = useState('');
  const [fee, setFee] = useState(32000);
  const [deliveryNote, setDeliveryNote] = useState('Gọi mình khi đến sảnh chung cư');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable accessibilityLabel="Quay lại" accessibilityRole="button" onPress={() => router.back()} style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}>
          <AppIcon name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} size={18} />
        </Pressable>
        <Text style={styles.headerTitle}>Tạo yêu cầu</Text>
        <Pressable accessibilityRole="button" style={({ pressed }) => [styles.draftButton, pressed && styles.pressed]}>
          <Text style={styles.draftText}>Lưu nháp</Text>
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        <View style={styles.progressDone} />
        <View style={styles.progressDone} />
        <View style={styles.progressDone} />
        <View style={styles.progressPending} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.step}>BƯỚC 3/4 · GIAO HÀNG</Text>
        <Text style={styles.heading}>Thời gian & địa chỉ</Text>
        <Text style={styles.subtitle}>Chọn lúc bạn tiện nhận và mức phí phù hợp.</Text>

        <View style={styles.formCard}>
          <FieldLabel>GIAO ĐẾN</FieldLabel>
          <Pressable accessibilityRole="button" style={({ pressed }) => [styles.addressButton, pressed && styles.pressed]}>
            <View style={styles.addressIcon}>
              <AppIcon name={{ ios: 'house', android: 'home', web: 'home' }} color={colors.coral} size={13} />
            </View>
            <View style={styles.addressCopy}>
              <Text style={styles.addressTitle}>Nhà · Hoài An</Text>
              <Text style={styles.addressSubtitle}>12 Nguyễn Huệ, P. Bến Nghé, Q.1</Text>
            </View>
            <AppIcon name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} color={colors.statusGreen} size={14} />
          </Pressable>

          <FieldLabel>THỜI GIAN NHẬN</FieldLabel>
          <View style={styles.dateChoices}>
            <ChoiceButton active={dateChoice === 'today'} label="Hôm nay" onPress={() => setDateChoice('today')} sublabel="12/09" />
            <ChoiceButton active={dateChoice === 'tomorrow'} label="Ngày mai" onPress={() => setDateChoice('tomorrow')} sublabel="13/09" />
            <ChoiceButton active={dateChoice === 'custom'} label="Ngày khác" onPress={() => setDateChoice('custom')} sublabel={customDate || 'Tự chọn'} />
          </View>

          {dateChoice === 'custom' && (
            <View style={styles.customInputRow}>
              <AppIcon name={{ ios: 'calendar', android: 'calendar_month', web: 'calendar_month' }} color={colors.coral} size={16} />
              <TextInput
                accessibilityLabel="Ngày nhận tùy chọn"
                keyboardType="numbers-and-punctuation"
                maxLength={10}
                onChangeText={setCustomDate}
                placeholder="DD/MM/YYYY"
                placeholderTextColor={colors.mutedLight}
                style={styles.customInput}
                value={customDate}
              />
            </View>
          )}

          <View style={styles.timeChoices}>
            {(['16:00', '17:30', '18:30'] as const).map((time) => (
              <ChoiceButton active={timeChoice === time} key={time} label={time} onPress={() => setTimeChoice(time)} />
            ))}
            <ChoiceButton active={timeChoice === 'custom'} label="Giờ khác" onPress={() => setTimeChoice('custom')} />
          </View>

          {timeChoice === 'custom' && (
            <View style={styles.customInputRow}>
              <AppIcon name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} color={colors.coral} size={16} />
              <TextInput
                accessibilityLabel="Giờ nhận tùy chọn"
                keyboardType="numbers-and-punctuation"
                maxLength={5}
                onChangeText={setCustomTime}
                placeholder="HH:mm"
                placeholderTextColor={colors.mutedLight}
                style={styles.customInput}
                value={customTime}
              />
            </View>
          )}

          <FieldLabel>PHÍ ĐI CHỢ</FieldLabel>
          <View style={styles.feeControl}>
            <Pressable accessibilityLabel="Giảm phí" accessibilityRole="button" onPress={() => setFee((value) => Math.max(25000, value - 1000))} style={({ pressed }) => [styles.feeButton, pressed && styles.pressed]}>
              <Text style={styles.feeSymbol}>−</Text>
            </Pressable>
            <View style={styles.feeCopy}>
              <Text style={styles.feeValue}>{fee.toLocaleString('vi-VN')}đ</Text>
              <Text style={styles.feeHint}>Makko đề xuất 25.000đ – 40.000đ</Text>
            </View>
            <Pressable accessibilityLabel="Tăng phí" accessibilityRole="button" onPress={() => setFee((value) => Math.min(40000, value + 1000))} style={({ pressed }) => [styles.feeButton, pressed && styles.pressed]}>
              <Text style={styles.feeSymbol}>＋</Text>
            </Pressable>
          </View>

          <View style={styles.tipBox}>
            <Text style={styles.heart}>♥</Text>
            <Text style={styles.tipText}>Phí cao hơn giúp yêu cầu được nhận nhanh hơn, đặc biệt vào giờ cao điểm.</Text>
          </View>

          <FieldLabel>GHI CHÚ GIAO HÀNG</FieldLabel>
          <TextInput accessibilityLabel="Ghi chú giao hàng" onChangeText={setDeliveryNote} placeholder="Thêm ghi chú" placeholderTextColor={colors.mutedLight} style={styles.noteInput} value={deliveryNote} />
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/create/review')} style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}>
          <Text style={styles.continueText}>Tiếp tục · Kiểm tra lại</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: { alignItems: 'center', borderBottomColor: colors.border, borderBottomWidth: 1, flexDirection: 'row', height: 64, justifyContent: 'space-between', paddingHorizontal: 20 },
  backButton: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 11, height: 34, justifyContent: 'center', width: 34 },
  headerTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
  draftButton: { alignItems: 'flex-end', justifyContent: 'center', minHeight: 34, width: 78 },
  draftText: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.actionLarge },
  progressTrack: { flexDirection: 'row', gap: 3, height: 3, paddingHorizontal: 20 },
  progressDone: { backgroundColor: colors.orange, flex: 1 },
  progressPending: { backgroundColor: '#DEDBD2', flex: 1 },
  scrollContent: { paddingBottom: 24, paddingHorizontal: 20, paddingTop: 22 },
  step: { color: colors.coral, fontFamily: fontFamilies.bodyExtraBold, fontSize: fontSizes.caption, letterSpacing: 1.04 },
  heading: { color: colors.text, fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle, lineHeight: 35, marginTop: 7 },
  subtitle: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: 16, marginBottom: 7, marginTop: 3 },
  formCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: 7, paddingBottom: 15, paddingHorizontal: 15, paddingTop: 22 },
  fieldLabel: { color: '#8C908A', fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, letterSpacing: 0.7, marginTop: 5 },
  addressButton: { alignItems: 'center', backgroundColor: '#FFF9ED', borderColor: '#EFB36E', borderRadius: 12, borderWidth: 1, flexDirection: 'row', gap: 10, minHeight: 51, padding: 10 },
  addressIcon: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 9, height: 29, justifyContent: 'center', width: 29 },
  addressCopy: { flex: 1, gap: 3 },
  addressTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  addressSubtitle: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  dateChoices: { flexDirection: 'row', gap: 6 },
  choiceButton: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 30, paddingHorizontal: 5, paddingVertical: 7 },
  choiceButtonActive: { backgroundColor: colors.forest, borderColor: colors.forest },
  choiceLabel: { color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.body, textAlign: 'center' },
  choiceLabelActive: { color: colors.surface },
  choiceSublabel: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, marginTop: 3 },
  choiceSublabelActive: { color: '#DBE6DF' },
  timeChoices: { flexDirection: 'row', gap: 6 },
  customInputRow: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.orange, borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 8, height: 38, paddingHorizontal: 12 },
  customInput: { color: colors.text, flex: 1, fontFamily: fontFamilies.body, fontSize: fontSizes.body, padding: 0 },
  feeControl: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: 11, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', padding: 8 },
  feeButton: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 8, height: 28, justifyContent: 'center', width: 28 },
  feeSymbol: { color: colors.text, fontSize: 15 },
  feeCopy: { alignItems: 'center' },
  feeValue: { color: colors.coral, fontFamily: fontFamilies.display, fontSize: 16 },
  feeHint: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, marginTop: 2 },
  tipBox: { alignItems: 'center', backgroundColor: '#EDF3E9', borderRadius: 9, flexDirection: 'row', gap: 7, minHeight: 45, padding: 8 },
  heart: { color: colors.forest, fontSize: 16 },
  tipText: { color: colors.forest, flex: 1, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: 11 },
  noteInput: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 11, borderWidth: 1, color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, height: 42, paddingHorizontal: 12, paddingVertical: 0 },
  footer: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, paddingHorizontal: 20, paddingVertical: 12 },
  continueButton: { alignItems: 'center', backgroundColor: colors.orange, borderRadius: 12, height: 44, justifyContent: 'center' },
  continueText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall },
  pressed: { opacity: 0.65 },
});
