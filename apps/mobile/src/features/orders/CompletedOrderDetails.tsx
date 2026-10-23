import { AvatarImage } from '@/components/ui/AvatarImage';
import { useCallback, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OrderScreenHeader } from './OrderScreenHeader';
import { EvidenceGallery } from './EvidenceGallery';
import { getOrderReview, type OrderDetail, type OrderReviewContext } from './api';
import { useAuth } from '@/features/auth/AuthProvider';
import { orderListEntry } from './listCache';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights, letterSpacing } from '@/theme/typography';

export function CompletedOrderDetails({ order }: { order: OrderDetail }) {
  const router = useRouter();
  const [context, setContext] = useState<OrderReviewContext | null>(null);
  const [error, setError] = useState('');
  const loadedAt = useRef(0);
  const loadedVersion = useRef(-1);
  const { session } = useAuth();
  const load = useCallback(async (active: () => boolean) => {
    try { const value = await getOrderReview(order.id); if (active()) { setContext(value); setError(''); loadedAt.current = Date.now(); } }
    catch { if (active()) setError('Chưa tải được thông tin người cùng đơn.'); }
  }, [order.id]);
  useFocusEffect(useCallback(() => {
    let active = true;
    const version = session ? orderListEntry(session.user.id, 'history').version : 0;
    // Reuse usable data on return; the review screen always checks the authoritative result.
    if (Date.now() - loadedAt.current > 30_000 || loadedVersion.current !== version) {
      loadedVersion.current = version; void load(() => active);
    }
    return () => { active = false; };
  }, [load, session]));
  const money = (value: number | null) => value === null ? 'Chưa chốt' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency: order.currency, maximumFractionDigits: 0 }).format(value);
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <OrderScreenHeader title="Chi tiết yêu cầu" />
    <ScrollView contentContainerStyle={s.scroll}>
      <LinearGradient colors={[colors.cream, colors.orange]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.hero}><Text style={s.produce}>🥬 🥕 🍅</Text><Text style={s.status}>✓ Đã hoàn thành</Text></LinearGradient>
      <View style={s.content}>
        <Text style={s.title}>{order.title}</Text><Text selectable style={s.small}>Đơn #{order.id.slice(0, 8)}{order.publishedAt ? ` · ${new Date(order.publishedAt).toLocaleDateString('vi-VN')}` : ''}</Text>
        <View style={[s.card, s.reviewCard]}>
          {context ? <View style={s.person}><View style={s.avatar}><Text style={s.bold}>{context.counterpart.displayName.split(/\s+/).slice(-2).map(part => part[0]).join('')}</Text><AvatarImage path={context.counterpart.avatarPath} borderRadius={23} /></View><View style={s.flex}><Text style={s.small}>{order.role === 'customer' ? 'Người đi chợ' : 'Khách hàng'}</Text><Text style={s.bold}>{context.counterpart.displayName}</Text></View><Pressable accessibilityRole="button" onPress={() => router.push(`/requests/${order.id}/chat`)} style={s.chat}><Text style={s.accent}>Xem trò chuyện</Text></Pressable></View> : <Text style={s.small}>{error || 'Đang tải người cùng đơn…'}</Text>}
          <Text style={s.small}>{context?.review ? 'Bạn đã gửi đánh giá cho đơn hàng này.' : 'Đơn đã hoàn thành. Chia sẻ trải nghiệm của bạn với người cùng đơn.'}</Text>
          <Pressable accessibilityRole="button" onPress={() => router.push(`/requests/${order.id}/review`)} style={s.primary}><Text style={s.bold}>{context?.review ? 'Xem đánh giá của bạn' : order.role === 'customer' ? '★ Đánh giá người đi chợ' : '★ Đánh giá khách hàng'}</Text></Pressable>
        </View>
        <View style={s.row}><Text style={s.bold}>Danh sách mua hàng</Text><Text style={s.accent}>{order.itemCount} món</Text></View>
        {order.items.map(item => <View key={item.id} style={s.item}><View style={s.food}><Text>🧺</Text></View><View style={s.flex}><Text style={s.bold}>{item.name}</Text>{!!item.note && <Text style={s.small}>{item.note}</Text>}</View><Text style={s.small}>{item.quantity} {item.unit}</Text></View>)}
        <View style={s.card}><Text style={s.bold}>Thông tin giao hàng</Text><Text style={s.body}>{[order.deliveryLine1, order.deliveryWard, order.deliveryDistrict, order.deliveryCity].filter(Boolean).join(', ')}</Text>{order.deliverBy && <Text style={s.small}>Giao trước {new Date(order.deliverBy).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })}</Text>}<Text style={s.small}>Thanh toán: {order.paymentMethod === 'cash' ? 'Tiền mặt' : order.paymentMethod === 'bank_transfer' ? 'Chuyển khoản' : 'Chưa có thông tin'}</Text></View>
        <View style={s.card}><View style={s.row}><Text style={s.body}>Tiền hàng đã thỏa thuận</Text><Text style={s.bold}>{money(order.estimatedItemsTotal)}</Text></View><View style={s.row}><Text style={s.body}>Phí đi chợ</Text><Text style={s.bold}>{money(order.deliveryFee)}</Text></View><View style={[s.row, s.total]}><Text style={s.bold}>Tổng thanh toán</Text><Text style={s.accent}>{money(order.estimatedItemsTotal === null ? null : order.estimatedItemsTotal + order.deliveryFee)}</Text></View></View>
        <Text style={s.small}>Mua đủ, đúng yêu cầu: người nhận giữ phần tiết kiệm và chịu phần vượt giá. Thiếu hoặc thay món cần hai bên đồng ý và điều chỉnh tiền.</Text>
        <EvidenceGallery requestId={order.id} />
      </View>
    </ScrollView>
  </SafeAreaView>;
}
const s = StyleSheet.create({
  chat: { padding: 8, borderRadius: 10, backgroundColor: colors.cream },
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 }, header: { height: 60, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomColor: colors.border, borderBottomWidth: 1 }, back: { width: 34, height: 34, borderRadius: 11, backgroundColor: colors.surface, justifyContent: 'center', alignItems: 'center' }, backText: { fontSize: fontSizes.pageTitle, color: colors.forest }, spacer: { width: 34 }, scroll: { paddingBottom: 20 },
  hero: { height: 112, justifyContent: 'center', alignItems: 'center' }, produce: { fontSize: fontSizes.display }, status: { position: 'absolute', bottom: 12, left: 20, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: colors.surface, color: colors.statusGreen, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, letterSpacing: letterSpacing.label },
  content: { padding: 20, gap: 14 }, title: { fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle, lineHeight: lineHeights.pageTitle, color: colors.forest }, small: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall }, body: { color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.body, lineHeight: lineHeights.body }, bold: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, lineHeight: lineHeights.body }, accent: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  card: { padding: 18, borderRadius: 18, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, gap: 12 }, reviewCard: { borderColor: colors.orange }, person: { flexDirection: 'row', gap: 12, alignItems: 'center' }, avatar: { width: 46, height: 46, borderRadius: 23, justifyContent: 'center', alignItems: 'center', backgroundColor: colors.vegetable }, primary: { backgroundColor: colors.orange, padding: 14, borderRadius: 14, alignItems: 'center' }, row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, item: { flexDirection: 'row', gap: 10, paddingVertical: 10, borderBottomColor: colors.border, borderBottomWidth: 1, alignItems: 'center' }, food: { backgroundColor: colors.vegetable, width: 38, height: 38, borderRadius: 10, justifyContent: 'center', alignItems: 'center' }, total: { paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.border },
});
