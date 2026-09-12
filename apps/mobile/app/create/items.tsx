import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

function AppIcon({ name, color = colors.text, size = 18 }: { name: SymbolName; color?: string; size?: number }) {
  return <SymbolView name={name} size={size} tintColor={color} fallback={<Text style={{ color, fontSize: size }}>•</Text>} />;
}

function FieldLabel({ children }: { children: string }) {
  return <Text style={styles.fieldLabel}>{children}</Text>;
}

export default function CreateScreen() {
  const router = useRouter();
  const [quantity, setQuantity] = useState(2);
  const [estimatedUnitPrice, setEstimatedUnitPrice] = useState('12000');
  const [note, setNote] = useState('Chọn rau non, cọng nhỏ');
  const [allowSubstitution, setAllowSubstitution] = useState(true);

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
        <View style={styles.progressPending} />
        <View style={styles.progressPending} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={styles.step}>BƯỚC 2/4</Text>
        <Text style={styles.title}>Danh sách đi chợ</Text>
        <Text style={styles.subtitle}>Thêm món và ghi chú thật cụ thể để người mua dễ chọn nhé.</Text>

        <View style={styles.itemCard}>
          <FieldLabel>TÊN MÓN</FieldLabel>
          <View style={styles.itemNameRow}>
            <View style={styles.itemEmojiBox}><Text style={styles.itemEmoji}>🥬</Text></View>
            <View>
              <Text style={styles.itemName}>Rau muống</Text>
              <Text style={styles.itemHint}>Ví dụ: rau, thịt, gia vị...</Text>
            </View>
          </View>

          <View style={styles.twoColumns}>
            <View style={styles.column}>
              <FieldLabel>SỐ LƯỢNG</FieldLabel>
              <View style={styles.quantityControl}>
                <Pressable accessibilityLabel="Giảm số lượng" accessibilityRole="button" disabled={quantity === 1} onPress={() => setQuantity((value) => Math.max(1, value - 1))} style={({ pressed }) => [styles.quantityButton, pressed && styles.pressed]}>
                  <Text style={styles.quantitySymbol}>−</Text>
                </Pressable>
                <Text style={styles.quantityValue}>{quantity}</Text>
                <Pressable accessibilityLabel="Tăng số lượng" accessibilityRole="button" onPress={() => setQuantity((value) => value + 1)} style={({ pressed }) => [styles.quantityButton, pressed && styles.pressed]}>
                  <Text style={styles.quantitySymbol}>＋</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.column}>
              <FieldLabel>ĐƠN VỊ</FieldLabel>
              <Pressable accessibilityRole="button" style={({ pressed }) => [styles.unitButton, pressed && styles.pressed]}>
                <Text style={styles.unitText}>Bó</Text>
                <AppIcon name={{ ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' }} size={14} />
              </Pressable>
            </View>
          </View>

          <FieldLabel>GIÁ DỰ KIẾN MỖI ĐƠN VỊ</FieldLabel>
          <View style={styles.priceInputWrap}>
            <TextInput
              accessibilityLabel="Giá dự kiến mỗi đơn vị"
              keyboardType="number-pad"
              onChangeText={(value) => setEstimatedUnitPrice(value.replace(/[^0-9]/g, ''))}
              placeholder="0"
              placeholderTextColor={colors.mutedLight}
              style={styles.priceInput}
              value={estimatedUnitPrice}
            />
            <Text style={styles.currencySuffix}>đ</Text>
          </View>

          <FieldLabel>GHI CHÚ CHO NGƯỜI MUA</FieldLabel>
          <TextInput accessibilityLabel="Ghi chú cho người mua" onChangeText={setNote} placeholder="Thêm ghi chú" placeholderTextColor={colors.mutedLight} style={styles.noteInput} value={note} />

          <View style={styles.substitutionRow}>
            <View>
              <Text style={styles.substitutionTitle}>Cho phép thay thế</Text>
              <Text style={styles.substitutionHint}>Nếu cửa hàng hết món này</Text>
            </View>
            <Switch accessibilityLabel="Cho phép thay thế món" ios_backgroundColor="#DEDBD2" onValueChange={setAllowSubstitution} thumbColor={colors.surface} trackColor={{ false: '#DEDBD2', true: colors.orange }} value={allowSubstitution} />
          </View>
        </View>

        <Pressable accessibilityRole="button" style={({ pressed }) => [styles.addButton, pressed && styles.pressed]}>
          <Text style={styles.addButtonText}>＋ Thêm món khác</Text>
        </Pressable>

        <View style={styles.tipBox}>
          <Text style={styles.tipEmoji}>💡</Text>
          <View>
            <Text style={styles.tipTitle}>Mẹo nhỏ từ Makko</Text>
            <Text style={styles.tipCopy}>Thêm ảnh tham khảo giúp chọn đúng món hơn.</Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable accessibilityRole="button" onPress={() => router.push('/create/delivery')} style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}>
          <Text style={styles.continueText}>Tiếp tục · Chọn thời gian</Text>
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
  title: { color: colors.text, fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle, lineHeight: 35, marginTop: 8 },
  subtitle: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: 16, marginBottom: 8, marginTop: 3 },
  itemCard: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, paddingBottom: 22, paddingHorizontal: 15, paddingTop: 24 },
  fieldLabel: { color: '#8C908A', fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, letterSpacing: 0.7, marginBottom: 7 },
  itemNameRow: { alignItems: 'center', flexDirection: 'row', gap: 10, marginBottom: 12 },
  itemEmojiBox: { alignItems: 'center', backgroundColor: colors.vegetable, borderRadius: 10, height: 36, justifyContent: 'center', width: 36 },
  itemEmoji: { fontSize: 17 },
  itemName: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
  itemHint: { color: '#AAAAAA', fontFamily: fontFamilies.body, fontSize: fontSizes.caption, marginTop: 2 },
  twoColumns: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  column: { flex: 1 },
  quantityControl: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flexDirection: 'row', height: 39, justifyContent: 'space-between', paddingHorizontal: 6 },
  quantityButton: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 7, height: 24, justifyContent: 'center', width: 24 },
  quantitySymbol: { color: colors.text, fontSize: 15 },
  quantityValue: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  unitButton: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flexDirection: 'row', height: 39, justifyContent: 'space-between', paddingHorizontal: 12 },
  unitText: { color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  priceInputWrap: { alignItems: 'center', backgroundColor: colors.background, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flexDirection: 'row', height: 40, marginBottom: 12, paddingHorizontal: 12 },
  priceInput: { color: colors.text, flex: 1, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, padding: 0 },
  currencySuffix: { color: colors.muted, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  noteInput: { backgroundColor: colors.background, borderColor: colors.border, borderRadius: 10, borderWidth: 1, color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, height: 40, marginBottom: 12, paddingHorizontal: 12, paddingVertical: 0 },
  substitutionRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  substitutionTitle: { color: colors.text, fontFamily: fontFamilies.bodyExtraBold, fontSize: fontSizes.bodySmall },
  substitutionHint: { color: '#8C908A', fontFamily: fontFamilies.body, fontSize: fontSizes.caption, marginTop: 3 },
  addButton: { alignItems: 'center', backgroundColor: '#FFF9ED', borderColor: colors.orange, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, height: 42, justifyContent: 'center', marginTop: 9 },
  addButtonText: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  tipBox: { alignItems: 'flex-start', backgroundColor: '#EDF3E9', borderRadius: 12, flexDirection: 'row', gap: 10, marginTop: 12, padding: 11 },
  tipEmoji: { fontSize: 16 },
  tipTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, lineHeight: 12 },
  tipCopy: { color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: 12 },
  footer: { backgroundColor: colors.surface, borderTopColor: colors.border, borderTopWidth: 1, paddingHorizontal: 20, paddingVertical: 12 },
  continueButton: { alignItems: 'center', backgroundColor: colors.orange, borderRadius: 12, height: 44, justifyContent: 'center' },
  continueText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall },
  pressed: { opacity: 0.65 },
});
