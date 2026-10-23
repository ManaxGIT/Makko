import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/AuthProvider';
import { getReceivedReviews, type AccountReputation, type ReceivedReview } from '@/features/orders/api';
import { appendReputation, fetchReputation, reputationEntry, reputationFreshMs } from '@/features/orders/listCache';
import { OrderScreenHeader } from '@/features/orders/OrderScreenHeader';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights, letterSpacing } from '@/theme/typography';

function Stars({ rating }: { rating: number }) {
  return <View style={s.stars} accessibilityLabel={`${rating} trên 5 sao`}>{[1, 2, 3, 4, 5].map(value => {
    const fraction = Math.max(0, Math.min(1, rating - (value - 1)));
    return <View key={value} style={s.starSlot}>
      <SymbolView name={{ ios: 'star', android: 'star_border', web: 'star_border' }} size={23} tintColor={colors.timelinePending} fallback={<Text style={[s.starFallback, { color: colors.timelinePending }]}>☆</Text>} />
      {fraction > 0 && <View style={[s.starFill, { width: fraction * 23 }]}><View style={s.starSlot}><SymbolView name={{ ios: 'star.fill', android: 'star', web: 'star' }} size={23} tintColor={colors.coral} fallback={<Text style={[s.starFallback, { color: colors.coral }]}>★</Text>} /></View></View>}
    </View>;
  })}</View>;
}
function ReviewCard({ review }: { review: ReceivedReview }) {
  const router = useRouter();
  return <View style={s.card}>
    <View style={s.person}><View style={s.avatar}><Text style={s.initials}>{review.reviewerName.trim().split(/\s+/).slice(-2).map(word => word[0]).join('')}</Text></View><View style={s.flex}><Text style={s.bold}>{review.reviewerName}</Text><Text style={s.small}>{review.reviewerRole === 'customer' ? 'Khách hàng' : 'Người đi chợ'}</Text></View><Text style={s.date}>{new Date(review.createdAt).toLocaleDateString('vi-VN')}</Text></View>
    <Stars rating={review.rating} />
    {!!review.comment && <Text style={s.body}>{review.comment}</Text>}
    <Pressable accessibilityRole="button" accessibilityLabel={`Xem đơn ${review.requestTitle}`} onPress={() => router.push(`/requests/${review.requestId}/details`)} style={s.order}><Text style={[s.small, s.flex]}>{review.requestTitle}</Text><Text style={s.link}>Xem đơn ›</Text></Pressable>
  </View>;
}
export default function ReputationRoute() {
  const { session, isLoading } = useAuth();
  if (isLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;
  return <ReputationScreen key={session.user.id} userId={session.user.id} />;
}
function ReputationScreen({ userId }: { userId: string }) {
  const entry = reputationEntry(userId);
  const [data, setData] = useState<AccountReputation | undefined>(entry.data);
  const [error, setError] = useState('');
  const [fetching, setFetching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const alive = useRef(false);
  const generation = useRef(0);
  const paging = useRef(false);
  const load = useCallback(async (manual = false) => {
    const version = ++generation.current;
    setFetching(true); if (manual) setRefreshing(true);
    try {
      const result = await fetchReputation(userId, () => getReceivedReviews());
      if (alive.current && generation.current === version && result) { setData(result); setError(''); }
    } catch (failure) { if (alive.current && generation.current === version) setError(failure instanceof Error ? failure.message : 'Không thể tải đánh giá.'); }
    finally { if (alive.current && generation.current === version) { setFetching(false); setRefreshing(false); } }
  }, [userId]);
  useFocusEffect(useCallback(() => {
    alive.current = true;
    setFetching(false); setRefreshing(false); setMore(false);
    const cached = reputationEntry(userId);
    if (cached.data) setData(cached.data);
    if (!cached.data || Date.now() - cached.updatedAt >= reputationFreshMs) void load();
    return () => { alive.current = false; generation.current += 1; };
  }, [userId, load]));
  const loadMore = async () => {
    if (!data?.hasMore || paging.current || fetching) return;
    const version = generation.current;
    const expected = data;
    paging.current = true; setMore(true);
    try {
      const page = await getReceivedReviews(expected.reviews.length);
      if (!alive.current || version !== generation.current) return;
      const result = appendReputation(userId, expected, page);
      if (result) { setData(result); setError(''); }
    } catch (failure) { if (alive.current && version === generation.current) setError(failure instanceof Error ? failure.message : 'Không thể tải thêm đánh giá.'); }
    finally { paging.current = false; if (alive.current) setMore(false); }
  };
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <OrderScreenHeader title="Đánh giá & uy tín" />
    <FlatList data={data?.reviews ?? []} keyExtractor={item => item.id} renderItem={({ item }) => <ReviewCard review={item} />} contentContainerStyle={s.content} ItemSeparatorComponent={() => <View style={s.separator} />} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} tintColor={colors.coral} />}
      ListHeaderComponent={<>
        {!data && fetching && <ActivityIndicator color={colors.coral} />}
        {data && <><View style={s.summary}><Text style={s.eyebrow}>ĐÁNH GIÁ TỪ NGƯỜI CÙNG ĐƠN</Text>{data.ratingCount ? <><Text style={s.score}>{data.averageRating.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}<Text style={s.small}> / 5</Text></Text><Stars rating={data.averageRating} /><Text style={s.small}>Dựa trên {data.ratingCount} lượt đánh giá đã nhận</Text></> : <><Text style={s.newMember}>Thành viên mới</Text><Stars rating={0} /><Text style={s.small}>Chưa có lượt đánh giá nào</Text></>}</View>{data.ratingCount > 0 && <View style={s.listHeading}><Text style={s.sectionTitle}>Đánh giá đã nhận</Text><Text style={s.small}>Mới nhất</Text>{fetching && !refreshing && <ActivityIndicator color={colors.coral} size="small" />}</View>}</>}
        {!!error && <View style={s.error} accessibilityRole="alert"><Text style={s.small}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void load(true)}><Text style={s.link}>Thử lại</Text></Pressable></View>}
      </>}
      ListEmptyComponent={data?.ratingCount === 0 ? <View style={s.empty}><View style={s.emptyIcon}><Text style={s.emptyStar}>☆</Text></View><Text style={s.emptyTitle}>{'Mỗi chuyến đi chợ,\nthêm một niềm tin'}</Text><Text style={[s.small, s.center]}>Sau khi đơn hoàn thành, người cùng đơn có thể gửi đánh giá cho bạn. Các đánh giá sẽ xuất hiện tại đây.</Text></View> : null}
      ListFooterComponent={data && data.ratingCount > 0 ? <View style={s.listFooter}>{data.hasMore && <Pressable accessibilityRole="button" disabled={more || fetching} onPress={() => void loadMore()} style={s.more}><Text style={s.link}>{more ? 'Đang tải…' : 'Xem thêm đánh giá'}</Text></Pressable>}<Text style={[s.note, s.center]}>{'Đánh giá được gửi sau khi đơn hoàn thành.\nĐiểm trung bình tính từ các đánh giá bạn đã nhận.'}</Text></View> : null}
    />
  </SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, content: { padding: 20, flexGrow: 1 }, separator: { height: 12 }, center: { textAlign: 'center' },
  summary: { alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 20, backgroundColor: colors.surface, paddingVertical: 26, paddingHorizontal: 16 },
  eyebrow: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, letterSpacing: letterSpacing.eyebrow, color: colors.coral, textAlign: 'center' }, score: { fontFamily: fontFamilies.display, fontSize: fontSizes.display, lineHeight: lineHeights.display, color: colors.forest }, newMember: { fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle, lineHeight: lineHeights.pageTitle, textAlign: 'center', color: colors.forest },
  starSlot: { width: 23, height: 25 }, starFill: { position: 'absolute', left: 0, top: 0, height: 25, overflow: 'hidden' },
  stars: { flexDirection: 'row', gap: 4 }, starFallback: { fontSize: fontSizes.pageTitle }, small: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall }, note: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption },
  bold: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, lineHeight: lineHeights.body }, body: { color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.body, lineHeight: lineHeights.body }, link: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall },
  listHeading: { marginTop: 26, marginBottom: 14, flexDirection: 'row', alignItems: 'center', gap: 8 }, sectionTitle: { flex: 1, color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodyLarge, lineHeight: lineHeights.bodyLarge },
  card: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 18, padding: 16, gap: 12 }, person: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, initials: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall }, date: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption }, order: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  empty: { paddingHorizontal: 20, paddingVertical: 40, alignItems: 'center', gap: 16 }, emptyIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: colors.cream, alignItems: 'center', justifyContent: 'center' }, emptyStar: { color: colors.coral, fontSize: fontSizes.display }, emptyTitle: { color: colors.forest, fontFamily: fontFamilies.display, fontSize: fontSizes.sectionTitle, lineHeight: lineHeights.sectionTitle, textAlign: 'center' }, error: { paddingVertical: 14, gap: 8 }, listFooter: { paddingVertical: 18, gap: 18 }, more: { paddingVertical: 12, alignItems: 'center', backgroundColor: colors.cream, borderRadius: 12 },
});
