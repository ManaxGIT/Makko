import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExploreRequest } from '@/features/explore/api';
import { getHomeDashboard, HomeDashboard } from '@/features/home/api';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

const filters = ['Tất cả', 'Rau củ', 'Thịt cá', 'Đồ khô'];
const normalize = (value: string) => value.toLocaleLowerCase('vi');

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi');
}

function firstName(name: string) {
  return name.trim().split(/\s+/).at(-1) ?? name;
}

function deadline(value: string | null) {
  if (!value) return 'Linh hoạt';
  const minutes = Math.max(0, Math.round((new Date(value).getTime() - Date.now()) / 60000));
  if (minutes < 60) return `${minutes} phút`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} giờ`;
  return new Date(value).toLocaleDateString('vi-VN');
}

function distance(value: number | null) {
  if (value === null) return 'Chưa rõ';
  return value < 1000 ? `${Math.round(value / 10) * 10}m` : `${(value / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}km`;
}

function isInFilter(request: ExploreRequest, filter: string) {
  if (filter === 'Tất cả') return true;
  const value = normalize(request.items.map((item) => item.name).join(' '));
  if (filter === 'Rau củ') return ['rau', 'củ', 'cải', 'khoai'].some((word) => value.includes(word));
  if (filter === 'Thịt cá') return ['thịt', 'cá', 'tôm', 'gà', 'bò', 'heo'].some((word) => value.includes(word));
  return ['gạo', 'đậu', 'mì', 'bún', 'khô'].some((word) => value.includes(word));
}

function AppIcon({ name, color = colors.forest, size = 20 }: {
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

function ActionCard({
  backgroundColor,
  icon,
  iconBackground,
  onPress,
  subtitle,
  textColor,
  title,
}: {
  backgroundColor: string;
  icon: SymbolName;
  iconBackground: string;
  onPress: () => void;
  subtitle: string;
  textColor: string;
  title: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.actionCard,
        { backgroundColor },
        pressed && styles.pressed,
      ]}
    >
      <View style={[styles.actionIcon, { backgroundColor: iconBackground }]}>
        <AppIcon name={icon} color={textColor} size={20} />
      </View>
      <Text style={[styles.actionTitle, { color: textColor }]}>{title}</Text>
      <Text style={[styles.actionSubtitle, { color: textColor }]}>{subtitle}</Text>
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState(filters[0]);
  const [query, setQuery] = useState('');
  const [dashboard, setDashboard] = useState<HomeDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDashboard(await getHomeDashboard({ nearbyLimit: 5 }));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải trang chủ lúc này.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadDashboard(); }, [loadDashboard]);

  const nearbyRequest = useMemo(() => {
    const needle = normalize(query.trim());
    return dashboard?.nearbyRequests.find((request) =>
      isInFilter(request, activeFilter)
      && (!needle || normalize([request.title, request.ownerDisplayName, ...request.items.map((item) => item.name)].join(' ')).includes(needle)),
    );
  }, [activeFilter, dashboard, query]);

  const displayName = dashboard?.profile.displayName ?? 'bạn';
  const locationName = dashboard?.location?.ward ?? dashboard?.location?.district ?? 'Chọn khu vực';

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.eyebrow}>GIAO ĐẾN</Text>
            <Pressable accessibilityRole="button" style={styles.locationButton}>
              <Text style={styles.location}>{locationName}</Text>
              <AppIcon
                name={{ ios: 'chevron.down', android: 'keyboard_arrow_down', web: 'keyboard_arrow_down' }}
                size={15}
              />
            </Pressable>
          </View>

          <Pressable
            accessibilityLabel="Mở tài khoản"
            onPress={() => router.push('/(tabs)/profile')}
            style={({ pressed }) => [styles.avatar, pressed && styles.pressed]}
          >
            <Text style={styles.avatarText}>{initials(displayName)}</Text>
            <View style={styles.onlineDot} />
          </Pressable>
        </View>

        <View style={styles.hero}>
          <Text style={styles.greeting}>Xin chào, {firstName(displayName)}</Text>
          <Text style={styles.heading}>Hôm nay bạn cần{`\n`}mua gì ở chợ?</Text>
        </View>

        <View style={styles.searchBox}>
          <AppIcon
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={20}
          />
          <TextInput
            accessibilityLabel="Tìm mặt hàng"
            onChangeText={setQuery}
            placeholder="Tìm rau, thịt, đồ khô..."
            placeholderTextColor={colors.mutedLight}
            style={styles.searchInput}
            value={query}
          />
          <Pressable
            accessibilityLabel="Bộ lọc tìm kiếm"
            style={({ pressed }) => [styles.filterButton, pressed && styles.pressed]}
          >
            <AppIcon
              name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }}
              color={colors.coral}
              size={16}
            />
          </Pressable>
        </View>

        <View style={styles.actions}>
          <ActionCard
            backgroundColor={colors.forest}
            icon={{ ios: 'plus', android: 'add', web: 'add' }}
            iconBackground="rgba(255,255,255,0.15)"
            onPress={() => router.push('/create/items')}
            subtitle="Nhờ người gần bạn"
            textColor={colors.surface}
            title="Tạo yêu cầu"
          />
          <ActionCard
            backgroundColor={colors.orange}
            icon={{ ios: 'arrow.up.right', android: 'north_east', web: 'north_east' }}
            iconBackground="rgba(255,255,255,0.3)"
            onPress={() => router.push('/(tabs)/explore')}
            subtitle="Kiếm thêm thu nhập"
            textColor={colors.forest}
            title="Đi chợ giúp"
          />
        </View>

        <View style={styles.nearbyHeader}>
          <Text style={styles.sectionTitle}>Gần bạn</Text>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push('/(tabs)/explore')}
          >
            <Text style={styles.seeAll}>Xem tất cả</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.filters}
          horizontal
          showsHorizontalScrollIndicator={false}
        >
          {filters.map((filter) => {
            const selected = filter === activeFilter;

            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={filter}
                onPress={() => setActiveFilter(filter)}
                style={({ pressed }) => [
                  styles.filterChip,
                  selected && styles.activeFilterChip,
                  pressed && styles.pressed,
                ]}
              >
                <Text style={[styles.filterLabel, selected && styles.activeFilterLabel]}>
                  {filter}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>

        {loading ? <View style={styles.statusCard}><ActivityIndicator color={colors.coral} /><Text style={styles.statusText}>Đang tải yêu cầu gần bạn...</Text></View> : error ? (
          <View style={styles.statusCard}>
            <Text style={styles.statusTitle}>Không thể tải trang chủ</Text>
            <Text style={styles.statusText}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void loadDashboard()} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}><Text style={styles.retryText}>Thử lại</Text></Pressable>
          </View>
        ) : nearbyRequest ? <View style={styles.requestCard}>
          <View style={styles.requestOwnerRow}>
            <View style={styles.requestAvatar}>
              <Text style={styles.requestAvatarText}>{initials(nearbyRequest.ownerDisplayName)}</Text>
            </View>
            <View style={styles.requestOwnerCopy}>
              <Text style={styles.requestOwner}>{nearbyRequest.ownerDisplayName}</Text>
              <Text style={styles.requestMeta}>★ {nearbyRequest.ownerRatingCount ? nearbyRequest.ownerAverageRating.toFixed(1) : 'Mới'} · {distance(nearbyRequest.distanceMeters)}</Text>
            </View>
            <View style={styles.timePill}>
              <Text style={styles.timeText}>{deadline(nearbyRequest.deliverBy)}</Text>
            </View>
          </View>

          <Text style={styles.requestTitle}>{nearbyRequest.title}</Text>

          <View style={styles.items}>
            {nearbyRequest.items.slice(0, 2).map((item) => <View key={item.id} style={styles.itemChip}><Text style={styles.itemText}>{item.name} {item.quantity.toLocaleString('vi-VN')} {item.unit}</Text></View>)}
            {nearbyRequest.itemCount > 2 && <View style={styles.itemChip}><Text style={styles.itemText}>＋ {nearbyRequest.itemCount - 2} món</Text></View>}
          </View>

          <View style={styles.requestFooter}>
            <View>
              <Text style={styles.feeLabel}>PHÍ ĐI CHỢ</Text>
              <Text style={styles.fee}>{nearbyRequest.deliveryFee.toLocaleString('vi-VN')}đ</Text>
            </View>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push(`/requests/${nearbyRequest.id}/details`)}
              style={({ pressed }) => [styles.acceptButton, pressed && styles.pressed]}
            >
              <Text style={styles.acceptLabel}>Nhận đơn</Text>
            </Pressable>
          </View>
        </View> : <View style={styles.statusCard}><Text style={styles.statusTitle}>Chưa có yêu cầu phù hợp</Text><Text style={styles.statusText}>Thử đổi từ khóa hoặc danh mục nhé.</Text></View>}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  content: { paddingBottom: 24 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 64,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  eyebrow: {
    color: colors.coral,
    fontFamily: fontFamilies.bodyExtraBold,
    fontSize: fontSizes.body,
    letterSpacing: 1.76,
  },
  locationButton: { alignItems: 'center', flexDirection: 'row', marginTop: 2 },
  location: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
  avatar: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 15,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  avatarText: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
  onlineDot: {
    backgroundColor: colors.success,
    borderColor: colors.surface,
    borderRadius: 6,
    borderWidth: 2,
    bottom: 1,
    height: 10,
    position: 'absolute',
    right: -1,
    width: 10,
  },
  hero: { paddingBottom: 16, paddingHorizontal: 20, paddingTop: 19 },
  greeting: { color: '#626961', fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  heading: {
    color: colors.text,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.display,
    lineHeight: 35.64,
    marginTop: 5,
  },
  searchBox: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 15,
    borderWidth: 1,
    flexDirection: 'row',
    height: 48,
    paddingHorizontal: 15,
    width: '83%',
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.body,
    marginLeft: 10,
    paddingVertical: 0,
  },
  filterButton: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 9,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  actions: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 15 },
  actionCard: { borderRadius: 18, flex: 1, minHeight: 103, padding: 15 },
  actionIcon: {
    alignItems: 'center',
    borderRadius: 9,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  actionTitle: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, marginTop: 8 },
  actionSubtitle: {
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySmall,
    marginTop: 4,
    opacity: 0.7,
  },
  nearbyHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 20,
    paddingTop: 19,
  },
  sectionTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodyLarge },
  seeAll: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  filters: { gap: 7, paddingBottom: 13, paddingHorizontal: 20 },
  filterChip: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 99,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: 13,
    paddingVertical: 8,
  },
  activeFilterChip: { backgroundColor: colors.forest, borderColor: colors.forest },
  filterLabel: { color: '#000000', fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall },
  activeFilterLabel: { color: colors.surface },
  requestCard: {
    alignSelf: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 20,
    borderWidth: 1,
    gap: 8,
    padding: 15,
    width: '83%',
  },
  requestOwnerRow: { alignItems: 'center', flexDirection: 'row' },
  requestAvatar: {
    alignItems: 'center',
    backgroundColor: colors.softPeach,
    borderRadius: 12,
    height: 35,
    justifyContent: 'center',
    width: 35,
  },
  requestAvatarText: {
    color: colors.coral,
    fontFamily: fontFamilies.bodyExtraBold,
    fontSize: fontSizes.bodySmall,
  },
  requestOwnerCopy: { gap: 2, marginLeft: 9 },
  requestOwner: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
  requestMeta: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  timePill: {
    backgroundColor: colors.cream,
    borderRadius: 99,
    marginLeft: 'auto',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  timeText: { color: colors.brown, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption },
  requestTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.body,
    marginTop: 5,
  },
  items: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, paddingBottom: 5 },
  itemChip: {
    backgroundColor: colors.chip,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 7,
  },
  itemText: { color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  requestFooter: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  feeLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
    letterSpacing: 0.56,
  },
  fee: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, marginTop: 2 },
  acceptButton: {
    backgroundColor: colors.orange,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  acceptLabel: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  statusCard: { alignItems: 'center', alignSelf: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 20, borderWidth: 1, gap: 7, padding: 22, width: '83%' },
  statusTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
  statusText: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, textAlign: 'center' },
  retryButton: { backgroundColor: colors.orange, borderRadius: 10, marginTop: 5, paddingHorizontal: 16, paddingVertical: 9 },
  retryText: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  pressed: { opacity: 0.65 },
});
