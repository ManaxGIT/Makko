import type { ComponentProps } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type Market = 'ben-thanh' | 'nearby';

function AppIcon({ name, color = colors.text, size = 16 }: {
  name: SymbolName;
  color?: string;
  size?: number;
}) {
  return (
    <SymbolView
      name={name}
      size={size}
      tintColor={color}
      fallback={<Text style={{ color, fontSize: size }}>•</Text>}
    />
  );
}

function FieldLabel({ children, optional }: { children: string; optional?: boolean }) {
  return (
    <View style={styles.labelRow}>
      <Text style={styles.fieldLabel}>{children}</Text>
      {optional && <Text style={styles.optional}>KHÔNG BẮT BUỘC</Text>}
    </View>
  );
}

function MarketOption({
  active,
  icon,
  onPress,
  subtitle,
  title,
}: {
  active: boolean;
  icon: SymbolName;
  onPress: () => void;
  subtitle: string;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.marketOption,
        active && styles.marketOptionActive,
        pressed && styles.pressed,
      ]}
    >
      <View style={styles.marketIcon}>
        <AppIcon name={icon} color={colors.coral} size={13} />
      </View>
      <View style={styles.marketCopy}>
        <Text style={styles.marketTitle}>{title}</Text>
        <Text style={styles.marketSubtitle}>{subtitle}</Text>
      </View>
      {active ? (
        <AppIcon
          name={{ ios: 'checkmark', android: 'check', web: 'check' }}
          color={colors.statusGreen}
          size={15}
        />
      ) : (
        <AppIcon
          name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
          color={colors.muted}
          size={14}
        />
      )}
    </Pressable>
  );
}

export default function CreateRequestInfoScreen() {
  const router = useRouter();
  const [title, setTitle] = useState('Bữa cơm chiều cho gia đình');
  const [description, setDescription] = useState(
    'Nhờ mua đồ tươi, ưu tiên hàng Việt Nam. Nếu giá chênh nhiều vui lòng nhắn mình trước nhé.',
  );
  const [market, setMarket] = useState<Market>('ben-thanh');

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Đóng"
          accessibilityRole="button"
          onPress={() => router.back()}
          style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
        >
          <AppIcon name={{ ios: 'xmark', android: 'close', web: 'close' }} size={16} />
        </Pressable>
        <Text style={styles.headerTitle}>Tạo yêu cầu</Text>
        <Pressable
          accessibilityRole="button"
          style={({ pressed }) => [styles.draftButton, pressed && styles.pressed]}
        >
          <Text style={styles.draftText}>Lưu nháp</Text>
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        <View style={styles.progressDone} />
        <View style={styles.progressPending} />
        <View style={styles.progressPending} />
        <View style={styles.progressPending} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.step}>BƯỚC 1/4 · THÔNG TIN</Text>
        <Text style={styles.heading}>Bạn cần mua gì?</Text>
        <Text style={styles.subtitle}>
          Đặt tên ngắn gọn để hàng xóm hiểu ngay yêu cầu của bạn.
        </Text>

        <View style={styles.formCard}>
          <FieldLabel>TÊN YÊU CẦU</FieldLabel>
          <View style={styles.titleInputWrap}>
            <TextInput
              accessibilityLabel="Tên yêu cầu"
              maxLength={120}
              onChangeText={setTitle}
              placeholder="Nhập tên yêu cầu"
              placeholderTextColor={colors.mutedLight}
              style={styles.titleInput}
              value={title}
            />
            <Text style={styles.counter}>{title.length}/120</Text>
          </View>

          <FieldLabel optional>MÔ TẢ THÊM</FieldLabel>
          <TextInput
            accessibilityLabel="Mô tả thêm"
            multiline
            onChangeText={setDescription}
            placeholder="Thêm mô tả"
            placeholderTextColor={colors.mutedLight}
            style={styles.descriptionInput}
            textAlignVertical="top"
            value={description}
          />

          <FieldLabel>MUA Ở ĐÂU?</FieldLabel>
          <MarketOption
            active={market === 'ben-thanh'}
            icon={{ ios: 'building.2', android: 'location_city', web: 'location_city' }}
            onPress={() => setMarket('ben-thanh')}
            subtitle="Phường Bến Thành · cách 1,2 km"
            title="Chợ Bến Thành"
          />
          <MarketOption
            active={market === 'nearby'}
            icon={{ ios: 'location', android: 'my_location', web: 'my_location' }}
            onPress={() => setMarket('nearby')}
            subtitle="Người đi chợ tự chọn nơi phù hợp"
            title="Bất kỳ chợ nào gần đây"
          />

          <FieldLabel>ẢNH THAM KHẢO</FieldLabel>
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.uploadButton, pressed && styles.pressed]}
          >
            <View style={styles.uploadIcon}>
              <AppIcon name={{ ios: 'plus', android: 'add', web: 'add' }} color={colors.coral} size={15} />
            </View>
            <View>
              <Text style={styles.uploadTitle}>Thêm ảnh</Text>
              <Text style={styles.uploadSubtitle}>Tối đa 4 ảnh · JPG, PNG</Text>
            </View>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/create/items')}
          style={({ pressed }) => [styles.continueButton, pressed && styles.pressed]}
        >
          <Text style={styles.continueText}>Tiếp tục · Thêm món</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: {
    alignItems: 'center',
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 11,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  headerTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
  draftButton: { alignItems: 'flex-end', justifyContent: 'center', minHeight: 34, width: 78 },
  draftText: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.actionLarge },
  progressTrack: { flexDirection: 'row', gap: 3, height: 3, paddingHorizontal: 20 },
  progressDone: { backgroundColor: colors.orange, flex: 1 },
  progressPending: { backgroundColor: '#DEDBD2', flex: 1 },
  scrollContent: { paddingBottom: 24, paddingHorizontal: 20, paddingTop: 22 },
  step: {
    color: colors.coral,
    fontFamily: fontFamilies.bodyExtraBold,
    fontSize: fontSizes.caption,
    letterSpacing: 1.04,
  },
  heading: {
    color: colors.text,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.pageTitle,
    lineHeight: 35,
    marginTop: 7,
  },
  subtitle: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySmall,
    lineHeight: 16,
    marginBottom: 7,
    marginTop: 3,
  },
  formCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 7,
    paddingBottom: 15,
    paddingHorizontal: 15,
    paddingTop: 24,
  },
  labelRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 5,
  },
  fieldLabel: {
    color: '#8C908A',
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.caption,
    letterSpacing: 0.7,
  },
  optional: {
    color: '#AAAAAA',
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.caption,
    letterSpacing: 0.7,
  },
  titleInputWrap: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    flexDirection: 'row',
    height: 42,
    paddingHorizontal: 12,
  },
  titleInput: {
    color: colors.text,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySmall,
    padding: 0,
  },
  counter: { color: '#AAAAAA', fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  descriptionInput: {
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 11,
    borderWidth: 1,
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySmall,
    height: 70,
    lineHeight: 14,
    padding: 12,
  },
  marketOption: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 51,
    padding: 10,
  },
  marketOptionActive: { backgroundColor: '#FFF9ED', borderColor: '#EFB36E' },
  marketIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 9,
    height: 29,
    justifyContent: 'center',
    width: 29,
  },
  marketCopy: { flex: 1, gap: 3 },
  marketTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  marketSubtitle: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  uploadButton: {
    alignItems: 'center',
    backgroundColor: '#FFFAF1',
    borderColor: '#EAB777',
    borderRadius: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    height: 54,
    padding: 10,
  },
  uploadIcon: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 9,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  uploadTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  uploadSubtitle: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, marginTop: 3 },
  footer: {
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  continueButton: {
    alignItems: 'center',
    backgroundColor: colors.orange,
    borderRadius: 12,
    height: 44,
    justifyContent: 'center',
  },
  continueText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall },
  pressed: { opacity: 0.65 },
});
