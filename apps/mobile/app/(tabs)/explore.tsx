import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ExploreRequest, listExploreRequests } from '@/features/explore/api';
import { clearUnavailableExploreRequests, getUnavailableExploreRequestIds } from '@/features/explore/unavailableRequests';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCurrentLocation } from '@/features/location/LocationProvider';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, letterSpacing, lineHeights } from '@/theme/typography';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type Category = 'Tất cả' | 'Rau củ' | 'Thịt cá' | 'Trái cây' | 'Đồ khô';
type Request = {
  id: string; owner: string; initials: string; rating: string; distance: string;
  deadline: string; title: string; category: Exclude<Category, 'Tất cả'>;
  items: string[]; extra: number; fee: string; avatarColor: string; avatarText: string;
};

const categories: Category[] = ['Tất cả', 'Rau củ', 'Thịt cá', 'Trái cây', 'Đồ khô'];
const categoryKeywords: Record<Exclude<Category, 'Tất cả'>, string[]> = {
  'Rau củ': ['rau', 'củ', 'cải', 'hành', 'khoai'],
  'Thịt cá': ['thịt', 'cá', 'tôm', 'gà', 'bò', 'heo'],
  'Trái cây': ['trái cây', 'cam', 'chuối', 'táo', 'xoài'],
  'Đồ khô': ['gạo', 'đậu', 'mì', 'bún', 'đồ khô'],
};

function formatDistance(distance: number | null) {
  if (distance === null) return 'Chưa rõ khoảng cách';
  if (distance < 1000) return `≈ ${Math.round(distance / 10) * 10}m`;
  return `≈ ${(distance / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}km`;
}

function formatDeadline(value: string | null) {
  if (!value) return 'Linh hoạt';
  const minutes = Math.max(0, Math.round((new Date(value).getTime() - Date.now()) / 60000));
  if (minutes < 60) return `${minutes} phút`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} giờ`;
  return new Date(value).toLocaleDateString('vi-VN');
}

function formatQuantity(quantity: number) {
  return Number.isInteger(quantity) ? String(quantity) : quantity.toLocaleString('vi-VN');
}

function getCategory(request: ExploreRequest): Exclude<Category, 'Tất cả'> {
  const haystack = request.items.map((item) => item.name).join(' ').toLocaleLowerCase('vi');
  return (Object.entries(categoryKeywords).find(([, words]) => words.some((word) => haystack.includes(word)))?.[0]
    ?? 'Đồ khô') as Exclude<Category, 'Tất cả'>;
}

function toCardRequest(request: ExploreRequest): Request {
  const initials = request.ownerDisplayName.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi');
  const palette = [
    [colors.softPeach, colors.coral], [colors.cream, colors.brown], [colors.forestLight, colors.forest],
  ];
  const colorIndex = request.ownerDisplayName.length % palette.length;
  return {
    id: request.id,
    owner: request.ownerDisplayName,
    initials,
    rating: request.ownerRatingCount > 0 ? request.ownerAverageRating.toFixed(1) : 'Mới',
    distance: formatDistance(request.distanceMeters),
    deadline: formatDeadline(request.deliverBy),
    title: request.title,
    category: getCategory(request),
    items: request.items.slice(0, 2).map((item) => `${item.name} ${formatQuantity(item.quantity)} ${item.unit}`),
    extra: Math.max(0, request.itemCount - 2),
    fee: `${request.deliveryFee.toLocaleString('vi-VN')}đ`,
    avatarColor: palette[colorIndex][0],
    avatarText: palette[colorIndex][1],
  };
}

function Icon({ name, color = colors.forest, size = 20 }: { name: SymbolName; color?: string; size?: number }) {
  return <SymbolView fallback={<Text style={{ color, fontSize: size }}>•</Text>} name={name} size={size} tintColor={color} />;
}

function RequestCard({ request }: { request: Request }) {
  const router = useRouter();
  const openRequest = () => router.push(`/requests/${request.id}/details`);

  return (
    <View style={styles.card}>
      <View style={styles.ownerRow}>
        <View style={[styles.avatar, { backgroundColor: request.avatarColor }]}>
          <Text style={[styles.avatarText, { color: request.avatarText }]}>{request.initials}</Text>
        </View>
        <View style={styles.ownerCopy}>
          <Text style={styles.owner}>{request.owner}</Text>
          <Text style={styles.ownerMeta}>★ {request.rating} · {request.distance}</Text>
        </View>
        <View style={styles.deadlinePill}>
          <Icon color={colors.brown} name={{ ios: 'clock', android: 'schedule', web: 'schedule' }} size={12} />
          <Text style={styles.deadline}>{request.deadline}</Text>
        </View>
      </View>

      <Pressable accessibilityRole="button" onPress={openRequest} style={({ pressed }) => pressed && styles.pressed}>
        <Text style={styles.cardTitle}>{request.title}</Text>
        <View style={styles.itemList}>
          {request.items.map((item) => <View key={item} style={styles.itemChip}><Text style={styles.itemText}>{item}</Text></View>)}
          {request.extra > 0 && <View style={styles.itemChip}><Text style={styles.itemText}>＋ {request.extra} món</Text></View>}
        </View>
      </Pressable>

      <View style={styles.cardFooter}>
        <View><Text style={styles.feeLabel}>PHÍ ĐI CHỢ</Text><Text style={styles.fee}>{request.fee}</Text></View>
        <Pressable accessibilityRole="button" onPress={openRequest} style={({ pressed }) => [styles.acceptButton, pressed && styles.pressed]}>
          <Text style={styles.acceptText}>Xem yêu cầu</Text>
          <Icon name={{ ios: 'arrow.right', android: 'arrow_forward', web: 'arrow_forward' }} size={14} />
        </Pressable>
      </View>
    </View>
  );
}

export default function ExploreScreen() {
  const { session } = useAuth();
  return <AccountExploreScreen key={session?.user.id ?? 'signed-out'} />;
}

function AccountExploreScreen() {
  const { coordinates, locating, error: locationError, locate } = useCurrentLocation();
  const [category, setCategory] = useState<Category>('Tất cả');
  const [query, setQuery] = useState('');
  const [nearest, setNearest] = useState(true);
  const [requests, setRequests] = useState<ExploreRequest[]>([]);
  const [unavailableRequestIds, setUnavailableRequestIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loaded = useRef(false);
  const pendingReads = useRef(new Map<string, Promise<ExploreRequest[]>>());
  const searchVersion = useRef(0);
  const [refreshing, setRefreshing] = useState(false);
  const [pullRefreshing, setPullRefreshing] = useState(false);
  const loadRequests = useCallback(async (searchQuery: string) => {
    const version = ++searchVersion.current;
    if (!loaded.current) setLoading(true);
    setRefreshing(true);
    setError(null);
    try {
      const params = { query: searchQuery, ...(coordinates ?? {}) };
      const key = JSON.stringify(params);
      let pending = pendingReads.current.get(key);
      if (!pending) {
        pending = listExploreRequests(params).finally(() => { pendingReads.current.delete(key); });
        pendingReads.current.set(key, pending);
      }
      const result = await pending;
      if (searchVersion.current !== version) return;
      loaded.current = true;
      setRequests(result);
      return true;
    } catch (loadError) {
      if (searchVersion.current !== version) return;
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải yêu cầu lúc này.');
    } finally {
      if (searchVersion.current === version) { setLoading(false); setRefreshing(false); }
    }
  }, [coordinates]);

  useEffect(() => {
    const timer = setTimeout(() => { void loadRequests(query); }, 300);
    return () => { clearTimeout(timer); searchVersion.current += 1; };
  }, [loadRequests, query]);

  useFocusEffect(useCallback(() => {
    setUnavailableRequestIds(getUnavailableExploreRequestIds());
  }, []));

  const refreshRequests = useCallback(async () => {
    if (await loadRequests(query)) {
      clearUnavailableExploreRequests();
      setUnavailableRequestIds(new Set());
    }
  }, [loadRequests, query]);

  const visibleRequests = useMemo(() => {
    const cards = requests
      .filter((request) => !unavailableRequestIds.has(request.id))
      .map(toCardRequest)
      .filter((request) => category === 'Tất cả' || request.category === category);
    return nearest ? cards : cards.sort((a, b) => {
      const first = requests.find((request) => request.id === a.id)?.publishedAt ?? '';
      const second = requests.find((request) => request.id === b.id)?.publishedAt ?? '';
      return second.localeCompare(first);
    });
  }, [category, nearest, requests, unavailableRequestIds]);

  return (
    <SafeAreaView edges={['top']} style={styles.safeArea}>
      <ScrollView refreshControl={<RefreshControl refreshing={pullRefreshing} onRefresh={() => { setPullRefreshing(true); void refreshRequests().finally(() => setPullRefreshing(false)); }} tintColor={colors.forest} />} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View><Text style={styles.eyebrow}>KHÁM PHÁ QUANH BẠN</Text><Text style={styles.heading}>Ai đang cần giúp?</Text></View>
          <Pressable accessibilityLabel="Xem thông báo" style={styles.iconButton}>
            <Icon name={{ ios: 'bell', android: 'notifications_none', web: 'notifications_none' }} />
            <View style={styles.notificationDot} />
          </Pressable>
        </View>

        <Pressable accessibilityRole="button" disabled={locating} onPress={() => void locate()} style={styles.locationCard}>
          <View style={styles.locationIcon}><Icon color={colors.coral} name={{ ios: 'location.fill', android: 'location_on', web: 'location_on' }} size={18} /></View>
          <View style={styles.locationCopy}><Text style={styles.locationLabel}>KHU VỰC ĐANG TÌM</Text><Text style={styles.location}>{locating ? 'Đang lấy vị trí…' : coordinates ? 'Vị trí hiện tại · trong 3km' : 'Bật vị trí để tìm đơn gần bạn'}</Text></View>
          <Icon color={colors.muted} name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={16} />
        </Pressable>

        {!!locationError && <Text accessibilityRole="alert" style={styles.emptyText}>{locationError}</Text>}
        {coordinates && <Text style={styles.emptyText}>Khoảng cách ước tính theo đường chim bay</Text>}
        <View style={styles.searchBox}>
          <Icon name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={19} />
          <TextInput accessibilityLabel="Tìm yêu cầu" onChangeText={setQuery} placeholder="Tìm món đồ hoặc người đăng..." placeholderTextColor={colors.mutedLight} style={styles.searchInput} value={query} />
          {query ? <Pressable accessibilityLabel="Xóa tìm kiếm" onPress={() => setQuery('')}><Icon color={colors.muted} name={{ ios: 'xmark.circle.fill', android: 'cancel', web: 'cancel' }} size={18} /></Pressable> : <View style={styles.filterIcon}><Icon color={colors.coral} name={{ ios: 'slider.horizontal.3', android: 'tune', web: 'tune' }} size={16} /></View>}
        </View>

        <ScrollView contentContainerStyle={styles.categories} horizontal showsHorizontalScrollIndicator={false}>
          {categories.map((item) => {
            const selected = item === category;
            return <Pressable accessibilityRole="button" accessibilityState={{ selected }} key={item} onPress={() => setCategory(item)} style={({ pressed }) => [styles.categoryChip, selected && styles.activeCategoryChip, pressed && styles.pressed]}><Text style={[styles.categoryText, selected && styles.activeCategoryText]}>{item}</Text></Pressable>;
          })}
        </ScrollView>

        <View style={styles.resultsHeader}>
          <View><Text style={styles.resultTitle}>Yêu cầu gần bạn</Text><Text style={styles.resultCount}>{visibleRequests.length} yêu cầu phù hợp</Text></View>
          <View style={styles.resultActions}>
            <Pressable accessibilityLabel="Tải lại danh sách yêu cầu" accessibilityRole="button" disabled={refreshing} onPress={refreshRequests} style={({ pressed }) => [styles.reloadButton, (pressed || loading) && styles.pressed]}>
              {refreshing ? <ActivityIndicator color={colors.coral} size="small" /> : <Icon color={colors.coral} name={{ ios: 'arrow.clockwise', android: 'refresh', web: 'refresh' }} size={15} />}
            </Pressable>
            <Pressable accessibilityRole="button" onPress={() => setNearest((value) => !value)} style={({ pressed }) => [styles.sortButton, pressed && styles.pressed]}>
              <Icon color={colors.coral} name={{ ios: 'arrow.up.arrow.down', android: 'sort', web: 'sort' }} size={14} />
              <Text style={styles.sortText}>{nearest ? 'Gần nhất' : 'Mới nhất'}</Text>
            </Pressable>
          </View>
        </View>

        {error && loaded.current && <Text accessibilityRole="alert" style={styles.emptyText}>{error}</Text>}
        <View style={styles.list}>
          {loading ? <View style={styles.loadingState}><ActivityIndicator color={colors.coral} /><Text style={styles.emptyText}>Đang tìm yêu cầu quanh bạn...</Text></View> : error && !loaded.current ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>Không thể tải yêu cầu</Text>
              <Text style={styles.emptyText}>{error}</Text>
              <Pressable accessibilityRole="button" onPress={() => void loadRequests(query)} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}><Text style={styles.retryText}>Thử lại</Text></Pressable>
            </View>
          ) : visibleRequests.length ? visibleRequests.map((request) => <RequestCard key={request.id} request={request} />) : (
            <View style={styles.emptyState}>
              <View style={styles.emptyIcon}><Icon color={colors.coral} name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} size={24} /></View>
              <Text style={styles.emptyTitle}>Chưa tìm thấy yêu cầu</Text>
              <Text style={styles.emptyText}>Thử đổi từ khóa hoặc chọn một danh mục khác nhé.</Text>
            </View>
          )}
        </View>

        <View style={styles.communityBanner}><Text style={styles.communityIcon}>♧</Text><View style={styles.communityCopy}><Text style={styles.communityTitle}>Một chuyến đi, thêm một kết nối.</Text><Text style={styles.communityText}>Chọn yêu cầu tiện đường và giúp một người hàng xóm.</Text></View></View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 }, content: { paddingBottom: 28 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 16, paddingHorizontal: 20, paddingTop: 22 },
  eyebrow: { color: colors.coral, fontFamily: fontFamilies.bodyExtraBold, fontSize: fontSizes.caption, letterSpacing: letterSpacing.eyebrow },
  heading: { color: colors.text, fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle, lineHeight: lineHeights.pageTitle, marginTop: 4 },
  iconButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 12, borderWidth: 1, height: 42, justifyContent: 'center', position: 'relative', width: 42 },
  notificationDot: { backgroundColor: colors.coral, borderColor: colors.surface, borderRadius: 5, borderWidth: 2, height: 9, position: 'absolute', right: 8, top: 7, width: 9 },
  locationCard: { alignItems: 'center', backgroundColor: colors.cream, borderRadius: 15, flexDirection: 'row', marginHorizontal: 20, padding: 12 },
  locationIcon: { alignItems: 'center', backgroundColor: colors.surface, borderRadius: 10, height: 36, justifyContent: 'center', width: 36 },
  locationCopy: { flex: 1, gap: 2, marginLeft: 10 }, locationLabel: { color: colors.brown, fontFamily: fontFamilies.bodyExtraBold, fontSize: fontSizes.caption, letterSpacing: letterSpacing.label },
  location: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall },
  searchBox: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 15, borderWidth: 1, flexDirection: 'row', height: 49, marginHorizontal: 20, marginTop: 14, paddingHorizontal: 14 },
  searchInput: { color: colors.text, flex: 1, fontFamily: fontFamilies.body, fontSize: fontSizes.body, marginLeft: 9, paddingVertical: 0 },
  filterIcon: { alignItems: 'center', backgroundColor: colors.cream, borderRadius: 8, height: 29, justifyContent: 'center', width: 29 },
  categories: { gap: 7, paddingHorizontal: 20, paddingVertical: 14 }, categoryChip: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 99, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 8 },
  activeCategoryChip: { backgroundColor: colors.forest, borderColor: colors.forest }, categoryText: { color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall }, activeCategoryText: { color: colors.surface, fontFamily: fontFamilies.bodyBold },
  resultsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingBottom: 10, paddingHorizontal: 20, paddingTop: 3 },
  resultTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodyLarge, lineHeight: lineHeights.bodyLarge }, resultCount: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, marginTop: 2 },
  resultActions: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  reloadButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, height: 34, justifyContent: 'center', width: 34 },
  sortButton: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 10, borderWidth: 1, flexDirection: 'row', gap: 5, paddingHorizontal: 10, paddingVertical: 8 }, sortText: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption },
  list: { gap: 11, paddingHorizontal: 20 }, card: { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, gap: 10, padding: 15 },
  ownerRow: { alignItems: 'center', flexDirection: 'row' }, avatar: { alignItems: 'center', borderRadius: 12, height: 38, justifyContent: 'center', width: 38 }, avatarText: { fontFamily: fontFamilies.bodyExtraBold, fontSize: fontSizes.bodySmall },
  ownerCopy: { gap: 1, marginLeft: 9 }, owner: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body }, ownerMeta: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  deadlinePill: { alignItems: 'center', backgroundColor: colors.cream, borderRadius: 99, flexDirection: 'row', gap: 4, marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 6 }, deadline: { color: colors.brown, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption },
  cardTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodyLarge, lineHeight: lineHeights.bodyLarge, marginBottom: 8 }, itemList: { flexDirection: 'row', flexWrap: 'wrap', gap: 5 }, itemChip: { backgroundColor: colors.chip, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 7 }, itemText: { color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  cardFooter: { alignItems: 'center', borderTopColor: colors.border, borderTopWidth: 1, flexDirection: 'row', justifyContent: 'space-between', paddingTop: 11 }, feeLabel: { color: colors.muted, fontFamily: fontFamilies.bodyExtraBold, fontSize: fontSizes.caption, letterSpacing: letterSpacing.label }, fee: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, lineHeight: lineHeights.body, marginTop: 1 },
  acceptButton: { alignItems: 'center', backgroundColor: colors.orange, borderRadius: 11, flexDirection: 'row', gap: 7, paddingHorizontal: 13, paddingVertical: 10 }, acceptText: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  emptyState: { alignItems: 'center', backgroundColor: colors.surface, borderColor: colors.border, borderRadius: 18, borderWidth: 1, padding: 28 }, emptyIcon: { alignItems: 'center', backgroundColor: colors.cream, borderRadius: 18, height: 52, justifyContent: 'center', width: 52 }, emptyTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodyLarge, marginTop: 12 }, emptyText: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, marginTop: 5, textAlign: 'center' },
  loadingState: { alignItems: 'center', gap: 8, padding: 28 }, retryButton: { backgroundColor: colors.orange, borderRadius: 10, marginTop: 14, paddingHorizontal: 16, paddingVertical: 10 }, retryText: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  communityBanner: { backgroundColor: colors.activityBanner, borderRadius: 14, flexDirection: 'row', gap: 10, marginHorizontal: 20, marginTop: 13, padding: 14 }, communityIcon: { color: colors.forest, fontSize: fontSizes.bodyLarge }, communityCopy: { flex: 1 }, communityTitle: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall }, communityText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, marginTop: 2 },
  pressed: { opacity: 0.65 },
});
