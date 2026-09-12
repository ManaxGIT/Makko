import type { ComponentProps } from 'react';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

const shoppingItems = [
  { emoji: '🥬', name: 'Rau muống', note: '2 bó · chọn non', price: '~24.000đ', color: colors.vegetable },
  { emoji: '🥩', name: 'Thịt ba chỉ', note: '500g · ít mỡ', price: '~75.000đ', color: colors.meat },
  { emoji: '🥚', name: 'Trứng gà', note: '10 quả', price: '~32.000đ', color: colors.egg },
  { emoji: '🍅', name: 'Cà chua', note: '500g · chọn chín vừa', price: '~18.000đ', color: colors.softPeach },
  { emoji: '🥕', name: 'Cà rốt', note: '3 củ', price: '~20.000đ', color: colors.egg },
];

function AppIcon({ name, color = '#000000', size = 18 }: {
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

function HeaderButton({ accessibilityLabel, icon, onPress }: {
  accessibilityLabel: string;
  icon: SymbolName;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
    >
      <AppIcon name={icon} size={19} />
    </Pressable>
  );
}

function ShoppingItem({
  color,
  emoji,
  name,
  note,
  price,
}: (typeof shoppingItems)[number]) {
  return (
    <View style={styles.itemRow}>
      <View style={[styles.itemIcon, { backgroundColor: color }]}>
        <Text style={styles.itemEmoji}>{emoji}</Text>
      </View>
      <View style={styles.itemCopy}>
        <Text style={styles.itemName}>{name}</Text>
        <Text style={styles.itemNote}>{note}</Text>
      </View>
      <Text style={styles.itemPrice}>{price}</Text>
    </View>
  );
}

export default function RequestDetailsScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? shoppingItems : shoppingItems.slice(0, 3);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <HeaderButton
          accessibilityLabel="Quay lại"
          icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
          onPress={() => router.back()}
        />
        <Text style={styles.headerTitle}>Chi tiết yêu cầu</Text>
        <HeaderButton
          accessibilityLabel="Thêm tùy chọn"
          icon={{ ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient
          colors={['#FFE8B4', '#F5A466']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.hero}
        >
          <View style={[styles.heroCircle, styles.leftCircle]} />
          <View style={[styles.heroCircle, styles.rightCircle]} />
          <Text style={styles.produce}>🥬 🥕 🍅</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>Đang tìm người đi chợ</Text>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.ownerRow}>
            <View style={styles.ownerAvatar}>
              <Text style={styles.ownerAvatarText}>MH</Text>
            </View>
            <View style={styles.ownerCopy}>
              <Text style={styles.ownerName}>Minh Hà</Text>
              <Text style={styles.ownerMeta}>★ 4.9 · 18 lượt đánh giá</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              style={({ pressed }) => [styles.messageButton, pressed && styles.pressed]}
            >
              <Text style={styles.messageButtonText}>Nhắn tin</Text>
            </Pressable>
          </View>

          <Text style={styles.title}>Bữa cơm chiều{`\n`}cho gia đình</Text>
          <Text selectable style={styles.requestId}>UUID: {id}</Text>

          <View style={styles.metaChips}>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>◷ Giao trước 17:30</Text>
            </View>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>⌖ Cách bạn 350m</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Danh sách cần mua</Text>
            <Text style={styles.itemCount}>5 món</Text>
          </View>

          <View>
            {visibleItems.map((item) => <ShoppingItem key={item.name} {...item} />)}
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={() => setExpanded((current) => !current)}
            style={({ pressed }) => [styles.expandButton, pressed && styles.pressed]}
          >
            <Text style={styles.expandButtonText}>
              {expanded ? 'Thu gọn⌃' : 'Xem thêm 2 món⌄'}
            </Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <View>
          <Text style={styles.rewardLabel}>Bạn nhận được</Text>
          <Text style={styles.reward}>32.000đ</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.replace(`/requests/${id}`)}
          style={({ pressed }) => [styles.acceptButton, pressed && styles.pressed]}
        >
          <Text style={styles.acceptButtonText}>Nhận đi chợ giúp</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: {
    alignItems: 'center',
    backgroundColor: colors.background,
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  headerButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 11,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  headerTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
  scrollContent: { flexGrow: 1 },
  hero: { alignItems: 'center', height: 148, justifyContent: 'center', overflow: 'hidden' },
  heroCircle: {
    borderColor: 'rgba(91,69,28,0.12)',
    borderRadius: 91,
    borderWidth: 1,
    height: 182,
    position: 'absolute',
    top: -17,
    width: 182,
  },
  leftCircle: { left: -80 },
  rightCircle: { right: -60 },
  produce: { fontSize: 23, transform: [{ rotate: '-3deg' }] },
  statusPill: {
    backgroundColor: colors.surface,
    borderRadius: 99,
    bottom: 12,
    left: 16,
    paddingHorizontal: 9,
    paddingVertical: 6,
    position: 'absolute',
  },
  statusText: { color: '#52825D', fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption },
  content: { paddingBottom: 18, paddingHorizontal: 20, paddingTop: 15 },
  ownerRow: { alignItems: 'center', flexDirection: 'row' },
  ownerAvatar: {
    alignItems: 'center',
    backgroundColor: colors.softPeach,
    borderRadius: 12,
    height: 35,
    justifyContent: 'center',
    width: 35,
  },
  ownerAvatarText: {
    color: colors.coral,
    fontFamily: fontFamilies.bodyExtraBold,
    fontSize: fontSizes.bodySmall,
  },
  ownerCopy: { gap: 2, marginLeft: 9 },
  ownerName: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
  ownerMeta: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  messageButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  messageButtonText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.pageTitle,
    lineHeight: 28.6,
    marginTop: 17,
  },
  requestId: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, marginTop: 6 },
  metaChips: { flexDirection: 'row', gap: 7, paddingBottom: 15, paddingTop: 12 },
  metaChip: { backgroundColor: colors.requestMeta, borderRadius: 7, padding: 7 },
  metaChipText: { color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  divider: { backgroundColor: colors.border, height: 1 },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 7,
    paddingTop: 14,
  },
  listTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodyLarge },
  itemCount: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  itemRow: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingVertical: 8 },
  itemIcon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  itemEmoji: { fontSize: 17 },
  itemCopy: { flex: 1, gap: 2 },
  itemName: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  itemNote: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  itemPrice: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  expandButton: { alignItems: 'center', paddingHorizontal: 6, paddingVertical: 5 },
  expandButtonText: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  footer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  rewardLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
    letterSpacing: 0.56,
  },
  reward: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
  acceptButton: {
    backgroundColor: colors.orange,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  acceptButtonText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall },
  pressed: { opacity: 0.65 },
});
