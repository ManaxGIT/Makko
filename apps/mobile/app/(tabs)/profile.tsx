import type { ComponentProps } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

const stats = [
  { value: '4.9', label: 'Đánh giá' },
  { value: '18', label: 'Đơn đã nhờ' },
  { value: '7', label: 'Lần đi giúp' },
];

const menuItems: Array<{
  title: string;
  subtitle: string;
  symbol: SymbolName;
}> = [
  {
    title: 'Địa chỉ của tôi',
    subtitle: 'Nhà, Công ty',
    symbol: { ios: 'house', android: 'home', web: 'home' },
  },
  {
    title: 'Đánh giá & uy tín',
    subtitle: 'Xem 18 lượt đánh giá',
    symbol: { ios: 'heart', android: 'favorite', web: 'favorite' },
  },
  {
    title: 'Thanh toán',
    subtitle: 'Tiền mặt',
    symbol: { ios: 'creditcard', android: 'payments', web: 'payments' },
  },
  {
    title: 'Trợ giúp',
    subtitle: 'Makko luôn ở đây',
    symbol: { ios: 'questionmark', android: 'question_mark', web: 'question_mark' },
  },
];

function AppIcon({ name, size = 18, color = colors.coral }: {
  name: SymbolName;
  size?: number;
  color?: string;
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

function MenuRow({ title, subtitle, symbol, isLast }: {
  title: string;
  subtitle: string;
  symbol: SymbolName;
  isLast: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      style={({ pressed }) => [styles.menuRow, !isLast && styles.menuDivider, pressed && styles.pressed]}
    >
      <View style={styles.menuIcon}>
        <AppIcon name={symbol} size={17} />
      </View>
      <View style={styles.menuCopy}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSubtitle}>{subtitle}</Text>
      </View>
      <AppIcon
        name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
        size={17}
        color="#A8AAA4"
      />
    </Pressable>
  );
}

export default function ProfileScreen() {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>GÓC CỦA BẠN</Text>
            <Text style={styles.heading}>Tài khoản</Text>
          </View>
          <Pressable accessibilityLabel="Mở cài đặt" style={({ pressed }) => [styles.settings, pressed && styles.pressed]}>
            <AppIcon
              name={{ ios: 'gearshape.fill', android: 'settings', web: 'settings' }}
              size={21}
              color={colors.forestMuted}
            />
          </Pressable>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>AN</Text>
            <View style={styles.onlineDot} />
          </View>
          <View style={styles.profileCopy}>
            <Text style={styles.name}>Nguyễn Hoài An</Text>
            <Text style={styles.memberSince}>Thành viên từ tháng 6, 2026</Text>
            <View style={styles.verifiedPill}>
              <Text style={styles.verifiedText}>✓ Đã xác thực</Text>
            </View>
          </View>
        </View>

        <View style={styles.statsCard}>
          {stats.map((item, index) => (
            <View key={item.label} style={[styles.stat, index < stats.length - 1 && styles.statDivider]}>
              <Text style={styles.statValue}>{item.value}</Text>
              <Text style={styles.statLabel}>{item.label}</Text>
            </View>
          ))}
        </View>

        <View style={styles.kindnessCard}>
          <Text style={styles.sparkle}>✦</Text>
          <View style={styles.kindnessCopy}>
            <Text style={styles.kindnessTitle}>Hạt tử tế của bạn</Text>
            <Text style={styles.kindnessDescription}>
              Bạn đã giúp 7 người hàng xóm đi chợ.
            </Text>
            <View style={styles.progressTrack}>
              <View style={styles.progressValue} />
            </View>
            <Text style={styles.progressCaption}>
              3 lần nữa để nhận huy hiệu “Người quen của chợ”
            </Text>
          </View>
        </View>

        <View style={styles.menuCard}>
          {menuItems.map((item, index) => (
            <MenuRow
              key={item.title}
              {...item}
              isLast={index === menuItems.length - 1}
            />
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { paddingBottom: 28, paddingHorizontal: 20, paddingTop: 21 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 18,
  },
  eyebrow: {
    color: colors.coral,
    fontFamily: fontFamilies.bodyExtraBold,
    fontSize: fontSizes.body,
    letterSpacing: 1.76,
  },
  heading: {
    color: colors.text,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.display,
    lineHeight: 37,
    marginTop: 3,
  },
  settings: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 11,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  profileCard: {
    alignItems: 'center',
    backgroundColor: colors.forest,
    borderRadius: 19,
    flexDirection: 'row',
    minHeight: 90,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  avatar: {
    alignItems: 'center',
    backgroundColor: '#FFF2D6',
    borderRadius: 18,
    height: 55,
    justifyContent: 'center',
    width: 55,
  },
  avatarText: {
    color: colors.forestMuted,
    fontFamily: fontFamilies.bodyExtraBold,
    fontSize: fontSizes.bodyLarge,
  },
  onlineDot: {
    backgroundColor: colors.success,
    borderColor: colors.surface,
    borderRadius: 6,
    borderWidth: 2,
    bottom: -1,
    height: 10,
    position: 'absolute',
    right: -1,
    width: 10,
  },
  profileCopy: { marginLeft: 14 },
  name: {
    color: colors.surface,
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.body,
  },
  memberSince: {
    color: '#C9D3CE',
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
    marginTop: 4,
  },
  verifiedPill: {
    alignSelf: 'flex-start',
    backgroundColor: '#315544',
    borderRadius: 999,
    marginTop: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  verifiedText: {
    color: '#FFD993',
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
  },
  statsCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 14,
    paddingVertical: 14,
  },
  stat: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  statDivider: { borderRightColor: colors.border, borderRightWidth: 1 },
  statValue: {
    color: colors.coral,
    fontFamily: fontFamilies.display,
    fontSize: 20,
    lineHeight: 25,
  },
  statLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
  },
  kindnessCard: {
    backgroundColor: colors.cream,
    borderRadius: 15,
    flexDirection: 'row',
    marginTop: 14,
    minHeight: 96,
    padding: 13,
  },
  sparkle: { color: colors.forest, fontSize: 19, lineHeight: 22, marginRight: 10 },
  kindnessCopy: { flex: 1 },
  kindnessTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.bodySmall,
  },
  kindnessDescription: {
    color: colors.text,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
    marginTop: 4,
  },
  progressTrack: {
    backgroundColor: '#EED8AD',
    borderRadius: 99,
    height: 5,
    marginTop: 12,
    overflow: 'hidden',
  },
  progressValue: { backgroundColor: colors.coral, borderRadius: 99, height: 5, width: '70%' },
  progressCaption: {
    color: '#8F7754',
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
    marginTop: 8,
  },
  menuCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 17,
    borderWidth: 1,
    marginTop: 14,
    paddingHorizontal: 13,
    paddingVertical: 4,
  },
  menuRow: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 56,
    paddingHorizontal: 6,
  },
  menuDivider: { borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
  menuIcon: {
    alignItems: 'center',
    backgroundColor: colors.creamIcon,
    borderRadius: 9,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  menuCopy: { flex: 1, marginLeft: 12 },
  menuTitle: {
    color: '#000000',
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.bodySmall,
  },
  menuSubtitle: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
    marginTop: 3,
  },
  pressed: { opacity: 0.65 },
});
