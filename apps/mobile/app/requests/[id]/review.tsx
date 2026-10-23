import { AvatarImage } from '@/components/ui/AvatarImage';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/features/auth/AuthProvider';
import { getOrderReview, submitOrderReview, type OrderReviewContext } from '@/features/orders/api';
import { OrderScreenHeader } from '@/features/orders/OrderScreenHeader';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights } from '@/theme/typography';

export default function ReviewRoute() {
  const { session, isLoading } = useAuth();
  const { id } = useLocalSearchParams<{ id: string }>();
  if (isLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;
  return <ReviewScreen key={`${session.user.id}:${id}`} id={id} />;
}

function ReviewScreen({ id }: { id: string }) {
  const router = useRouter();
  const [context, setContext] = useState<OrderReviewContext | null>(null);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [fetching, setFetching] = useState(false);
  const current = useRef(true);
  const pendingSend = useRef(false);
  const lastLoad = useRef(0);
  const readVersion = useRef(0);
  const pendingRead = useRef<Promise<OrderReviewContext> | null>(null);
  const load = useCallback(async () => {
    const version = ++readVersion.current;
    setFetching(true);
    try {
      if (!pendingRead.current) pendingRead.current = getOrderReview(id).finally(() => { pendingRead.current = null; });
      const result = await pendingRead.current;
      if (current.current && version === readVersion.current) { setContext(result); setError(''); lastLoad.current = Date.now(); }
    } catch (failure) {
      if (current.current && version === readVersion.current) setError(failure instanceof Error ? failure.message : 'Không thể tải đánh giá.');
    } finally { if (current.current && version === readVersion.current) setFetching(false); }
  }, [id]);
  useEffect(() => { current.current = true; return () => { current.current = false; }; }, []);
  useFocusEffect(useCallback(() => {
    if (Date.now() - lastLoad.current > 30_000) void load();
    return () => { readVersion.current += 1; };
  }, [load]));
  const send = async () => {
    if (!context?.canReview || rating < 1 || pendingSend.current) return;
    readVersion.current += 1; setFetching(false); pendingSend.current = true; setSending(true); setError('');
    try {
      const review = await submitOrderReview(id, rating, comment);
      readVersion.current += 1; lastLoad.current = Date.now();
      if (current.current) setContext({ ...context, canReview: false, review });
    } catch (failure) {
      // Reconcile a lost response or another device's submission without resending.
      try {
        const result = await getOrderReview(id);
        readVersion.current += 1; lastLoad.current = Date.now();
        if (current.current) setContext(result);
        if (result.review) return;
      } catch { /* Keep the form and its content for an explicit retry. */ }
      if (current.current) setError(failure instanceof Error ? failure.message : 'Không thể gửi đánh giá. Vui lòng thử lại.');
    } finally {
      pendingSend.current = false;
      if (current.current) setSending(false);
    }
  };
  const review = context?.review;
  const labels = ['', 'Rất không hài lòng', 'Không hài lòng', 'Bình thường', 'Hài lòng', 'Rất hài lòng'];
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <OrderScreenHeader title={review ? 'Đánh giá của bạn' : 'Đánh giá đơn hàng'} />
    <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={[s.content, !!review && s.savedContent]} keyboardShouldPersistTaps="handled">
        {!context && fetching ? <ActivityIndicator color={colors.coral} /> : null}
        {!!error && <View accessibilityRole="alert" style={s.notice}><Text style={s.body}>{error}</Text>{!sending && <Pressable accessibilityRole="button" onPress={() => void load()}><Text style={s.link}>Tải lại đánh giá</Text></Pressable>}</View>}
        {context && <>
          {review ? <View style={s.savedHero}>
            <View style={s.successIcon}><SymbolView name={{ ios: 'checkmark', android: 'check', web: 'check' }} size={26} tintColor={colors.forest} fallback={<Text style={s.successFallback}>✓</Text>} /></View>
            <Text style={[s.title, s.center]}>Cảm ơn bạn đã chia sẻ!</Text>
            <Text style={[s.small, s.center]}>{context.title}</Text>
          </View> : <><Text style={s.title}>{'Trải nghiệm của bạn\nthế nào?'}</Text><Text style={s.small}>{context.title}</Text></>}
          <View style={s.card}>
            <View style={s.person}><View style={s.avatar}><Text style={s.bold}>{context.counterpart.displayName.split(/\s+/).slice(-2).map(part => part[0]).join('')}</Text><AvatarImage path={context.counterpart.avatarPath} borderRadius={23} /></View><View style={s.flex}><Text style={s.bold}>{context.counterpart.displayName}</Text><Text style={s.small}>{context.role === 'customer' ? 'Người đi chợ' : 'Khách hàng'}</Text></View></View>
            {review && <View style={s.savedReview}>
              <View style={s.reviewMeta}><Text style={s.small}>Đánh giá của bạn</Text><Text style={s.date}>{new Date(review.createdAt).toLocaleDateString('vi-VN')}</Text></View>
              <View accessibilityLabel={`${review.rating} trên 5 sao`} style={s.savedStarRow}>{[1, 2, 3, 4, 5].map(value => <SymbolView key={value} name={value <= review.rating ? { ios: 'star.fill', android: 'star', web: 'star' } : { ios: 'star', android: 'star_border', web: 'star_border' }} size={25} tintColor={value <= review.rating ? colors.coral : colors.timelinePending} fallback={<Text style={[s.savedStarFallback, { color: value <= review.rating ? colors.coral : colors.timelinePending }]}>{value <= review.rating ? '★' : '☆'}</Text>} />)}</View>
              {!!review.comment && <Text style={s.body}>{review.comment}</Text>}
            </View>}
          </View>
          {!review && context.canReview && <>
            <View style={s.stars}>{[1, 2, 3, 4, 5].map(value => <Pressable key={value} disabled={sending} accessibilityRole="radio" accessibilityLabel={`${value} sao`} accessibilityState={{ selected: rating === value, disabled: sending }} onPress={() => setRating(value)} style={s.starButton}><Text style={[s.star, value <= rating && s.selectedStar]}>★</Text></Pressable>)}</View>
            <Text accessibilityLiveRegion="polite" style={s.ratingLabel}>{labels[rating] || 'Chạm vào sao để đánh giá'}</Text>
            <Text style={s.label}>Nhận xét <Text style={s.small}>· Không bắt buộc</Text></Text>
            <TextInput accessibilityLabel="Nhận xét" editable={!sending} value={comment} onChangeText={setComment} maxLength={1000} multiline textAlignVertical="top" placeholder="Điều gì khiến bạn hài lòng hoặc cần cải thiện?" placeholderTextColor={colors.muted} style={s.input} />
            <Text style={s.count}>{comment.length}/1.000 ký tự</Text>
          </>}
          {review ? <Text style={[s.small, s.center, s.savedHint]}>Đánh giá đã được lưu. Bạn không thể sửa hoặc xóa đánh giá này.</Text> : <View style={s.notice}><Text style={s.body}>{context.canReview ? 'Đánh giá đã gửi không thể sửa hoặc xóa. Hãy kiểm tra trước khi gửi nhé.' : 'Bạn chỉ có thể đánh giá sau khi đơn hàng đã hoàn thành.'}</Text></View>}
        </>}
      </ScrollView>
      {context && <View style={s.footer}><Pressable accessibilityRole="button" disabled={sending || (!review && (!context.canReview || !rating))} accessibilityState={{ disabled: sending || (!review && (!context.canReview || !rating)), busy: sending }} onPress={review ? () => router.back() : () => void send()} style={[s.primary, (sending || (!review && (!rating || !context.canReview))) && s.disabled]}><Text style={s.bold}>{review ? 'Về đơn hàng' : sending ? 'Đang gửi…' : 'Gửi đánh giá'}</Text></Pressable></View>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  savedContent: { paddingTop: 32, gap: 22 },
  savedHero: { alignItems: 'center', gap: 12, paddingHorizontal: 12, paddingBottom: 4 },
  center: { textAlign: 'center' },
  successIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.vegetable, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  successFallback: { fontSize: fontSizes.pageTitle, color: colors.forest },
  savedReview: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16, gap: 14 },
  reviewMeta: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 8 },
  date: { fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, color: colors.muted },
  savedStarRow: { flexDirection: 'row', gap: 7, alignItems: 'center' },
  savedStarFallback: { fontSize: fontSizes.pageTitle },
  savedHint: { paddingHorizontal: 14 },
  flex: { flex: 1 }, safe: { flex: 1, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 60, borderBottomWidth: 1, borderBottomColor: colors.border },
  back: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }, backText: { color: colors.forest, fontSize: fontSizes.pageTitle }, spacer: { width: 34 },
  content: { padding: 20, gap: 14, flexGrow: 1 }, title: { color: colors.forest, fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle, lineHeight: lineHeights.pageTitle },
  bold: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, lineHeight: lineHeights.body }, body: { color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.body, lineHeight: lineHeights.body },
  small: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall },
  card: { padding: 18, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: colors.surface, gap: 14 }, person: { flexDirection: 'row', alignItems: 'center', gap: 12 }, avatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.vegetable, justifyContent: 'center', alignItems: 'center' },
  stars: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 }, starButton: { minWidth: 48, minHeight: 48, alignItems: 'center', justifyContent: 'center' }, star: { fontSize: fontSizes.display, color: colors.timelinePending }, selectedStar: { color: colors.coral }, savedStars: { color: colors.coral, fontSize: fontSizes.pageTitle },
  ratingLabel: { textAlign: 'center', color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall }, label: { marginTop: 14, color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
  input: { minHeight: 146, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 14, backgroundColor: colors.surface, color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.body, lineHeight: lineHeights.body }, count: { textAlign: 'right', color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  notice: { borderRadius: 14, backgroundColor: colors.cream, padding: 14, gap: 10 }, link: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body }, check: { alignSelf: 'center', color: colors.forest, backgroundColor: colors.vegetable, borderRadius: 30, padding: 14, fontSize: fontSizes.pageTitle },
  footer: { padding: 20, borderTopWidth: 1, borderTopColor: colors.border }, primary: { padding: 15, alignItems: 'center', backgroundColor: colors.orange, borderRadius: 14 }, disabled: { opacity: 0.5 },
});
