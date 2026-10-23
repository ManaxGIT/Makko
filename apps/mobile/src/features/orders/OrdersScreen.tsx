import { AvatarImage } from '@/components/ui/AvatarImage';
import { OrderScreenHeader } from './OrderScreenHeader';
import { RecipeLink } from '@/features/meals/RecipeLink';
import type { ComponentProps } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listMyOrders, transitionOrder, OrderStatus, OrderSummary } from '@/features/orders/api';
import { useAuth } from '@/features/auth/AuthProvider';
import { fetchOrderList, orderListEntry, orderListFreshMs, removeCancelledOrder } from './listCache';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights, letterSpacing } from '@/theme/typography';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type OrderTab = 'customer' | 'shopper';
const completedStatuses: OrderStatus[] = ['completed', 'cancelled'];
const statusLabels: Record<OrderStatus, string> = {
  draft: 'BẢN NHÁP', open: 'ĐANG TÌM NGƯỜI', accepted: 'ĐÃ CÓ NGƯỜI NHẬN',
  shopping: 'ĐANG ĐI CHỢ', delivering: 'ĐANG GIAO', delivered: 'CHỜ XÁC NHẬN NHẬN HÀNG', completed: 'ĐÃ HOÀN THÀNH',
  cancelled: 'ĐÃ HỦY', disputed: 'ĐANG KHIẾU NẠI',
};

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(-2).map((part) => part[0]).join('').toLocaleUpperCase('vi');
}

function formatDeadline(value: string | null) {
  if (!value) return 'Thời gian linh hoạt';
  return `Giao trước ${new Date(value).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })}`;
}

function relativeTime(value: string) {
  const minutes = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 60000));
  if (minutes < 60) return `${minutes} phút trước`;
  if (minutes < 1440) return `${Math.round(minutes / 60)} giờ trước`;
  return `${Math.round(minutes / 1440)} ngày trước`;
}

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

function TabButton({
  active,
  count,
  label,
  onPress,
}: {
  active: boolean;
  count?: number;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.tabButton, active && styles.activeTabButton]}
    >
      <Text style={[styles.tabLabel, active && styles.activeTabLabel]}>{label}</Text>
      {count ? (
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{count}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function OrderCard({
  order, onDeleted, onConflict,
}: {
  order: OrderSummary;
  onDeleted: (id: string) => void;
  onConflict: () => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const confirmDelete = () => {
    if (deleting) return;
    Alert.alert(`Xóa đơn “${order.title}”?`, 'Đơn sẽ ngừng tìm người và không thể được nhận nữa. Đơn được ghi nhận là đã hủy trong lịch sử.', [
      { text: 'Giữ lại đơn', style: 'cancel' },
      { text: 'Xóa đơn', style: 'destructive', onPress: () => {
        setDeleting(true);
        void transitionOrder(order.id, 'cancelled').then(() => onDeleted(order.id)).catch(error => {
          Alert.alert('Không thể xóa đơn', error instanceof Error ? error.message : 'Vui lòng thử lại.');
          onConflict();
        }).finally(() => setDeleting(false));
      } },
    ]);
  };
  const isWaiting = order.status === 'draft' || order.status === 'open';
  const isProgress = ['accepted', 'shopping', 'delivering', 'delivered', 'disputed'].includes(order.status);
  const isCompleted = completedStatuses.includes(order.status);
  const counterpartLabel = order.role === 'customer' ? 'Người đi chợ' : 'Người nhờ mua';

  return (
    <View style={[styles.orderCard, isProgress && styles.activeOrderCard]}>
      <View style={styles.orderTopRow}>
        <Text style={[styles.status, isProgress ? styles.shoppingStatus : styles.waitingStatus]}>
          {statusLabels[order.status]}
        </Text>
      </View>

      {isCompleted && <Text style={styles.shopperLabel}>{order.role === 'customer' ? 'Bạn là người nhờ mua' : 'Bạn là người đi chợ'}</Text>}
      <Text style={styles.orderTitle}>{order.title}</Text>
      {order.role === 'customer' && order.hasRecipe && <RecipeLink compact onPress={() => router.push(`/requests/${order.id}/recipe`)} />}
      <Text style={styles.orderSummary}>{order.itemCount} món · {formatDeadline(order.deliverBy)}</Text>

      {!isWaiting && order.counterpart ? (
        <View style={styles.shopperRow}>
          <View style={styles.shopperAvatar}>
            <Text style={styles.shopperAvatarText}>{initials(order.counterpart.displayName)}</Text><AvatarImage path={order.counterpart.avatarPath} borderRadius={12} />
          </View>
          <View>
            <Text style={styles.shopperLabel}>{counterpartLabel}</Text>
            <Text style={styles.shopperName}>{order.counterpart.displayName} · ★ {order.counterpart.ratingCount ? order.counterpart.averageRating.toFixed(2) : 'Mới'}</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(isCompleted ? `/requests/${order.id}/details` : `/requests/${order.id}`)}
            style={({ pressed }) => [styles.trackButton, pressed && styles.pressed]}
          >
            <Text style={styles.trackButtonText}>{isCompleted ? 'Chi tiết' : 'Theo dõi'}</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.waitingFooter}>
          <Text style={styles.postedTime}>◷ Đã đăng {relativeTime(order.publishedAt ?? order.createdAt)}</Text>
          {isWaiting && order.role === 'customer' && <Pressable accessibilityRole="button" disabled={deleting} accessibilityLabel={`Xóa đơn ${order.title}`} onPress={confirmDelete} style={styles.deleteButton}>
            <Text style={styles.deleteText}>{deleting ? 'Đang xóa…' : 'Xóa đơn'}</Text>
          </Pressable>}
          {isWaiting && order.role === 'customer' && <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/edit/${order.id}/items`)}
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
          >
            <Text style={styles.editButtonText}>Chỉnh sửa</Text>
          </Pressable>}
        </View>
      )}
    </View>
  );
}

export default function OrdersScreen({ history = false }: { history?: boolean }) {
  const { session } = useAuth();
  if (!session) return null;
  return <OrderList key={`${session.user.id}:${history}`} history={history} userId={session.user.id} />;
}

function OrderList({ history, userId }: { history: boolean; userId: string }) {
  const router = useRouter();
  const scope = history ? 'history' : 'active';
  const initial = orderListEntry(userId, scope).data;
  const [activeTab, setActiveTab] = useState<OrderTab>('customer');
  const [orders, setOrders] = useState<OrderSummary[]>(initial ?? []);
  const [loaded, setLoaded] = useState(initial !== undefined);
  const [loading, setLoading] = useState(initial === undefined);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const loadOrders = useCallback(async (force = false) => {
    const entry = orderListEntry(userId, scope);
    if (entry.data !== undefined) { setOrders(entry.data); setLoaded(true); setLoading(false); }
    if (!force && entry.data !== undefined && Date.now() - entry.updatedAt < orderListFreshMs) return;
    if (entry.data === undefined) setLoading(true);
    setError(null);
    try {
      const result = await fetchOrderList(userId, scope, () => listMyOrders(100, scope));
      if (alive.current && result !== null) { setOrders(result); setLoaded(true); }
    } catch (loadError) {
      if (alive.current) setError(loadError instanceof Error ? loadError.message : 'Không thể tải đơn hàng lúc này.');
    } finally {
      if (alive.current) { setLoading(false); setRefreshing(false); }
    }
  }, [userId, scope]);

  useFocusEffect(useCallback(() => { void loadOrders(); }, [loadOrders]));
  const onDeleted = (id: string) => {
    removeCancelledOrder(userId, id);
    setOrders(rows => rows.filter(order => order.id !== id));
  };

  const scopedOrders = useMemo(
    () => orders.filter(order => completedStatuses.includes(order.status) === history),
    [orders, history],
  );
  const posted = scopedOrders.filter(order => order.role === 'customer');
  const received = scopedOrders.filter(order => order.role === 'shopper');
  const visibleOrders = activeTab === 'customer' ? posted : received;

  return (
    <SafeAreaView style={styles.safeArea} edges={history ? ['top', 'bottom'] : ['top']}>
      {history ? <OrderScreenHeader title="Lịch sử đơn hàng" backLabel="Quay lại Tài khoản" onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} /> : <View style={styles.header}><View><Text style={styles.eyebrow}>HOẠT ĐỘNG</Text><Text style={styles.heading}>Đơn hàng</Text></View></View>}

      <View accessibilityRole="tablist" style={styles.tabs}>
        <TabButton
          active={activeTab === 'customer'}
          count={posted.length}
          label="Đơn đã đăng"
          onPress={() => setActiveTab('customer')}
        />
        <TabButton
          active={activeTab === 'shopper'}
          label="Đơn đã nhận"
          count={received.length}
          onPress={() => setActiveTab('shopper')}
        />
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadOrders(true); }} tintColor={colors.forest} />}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {loading ? <View style={styles.emptyState}><ActivityIndicator color={colors.coral} /><Text style={styles.emptyDescription}>Đang tải đơn hàng...</Text></View> : error && !loaded ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Không thể tải đơn hàng</Text>
            <Text style={styles.emptyDescription}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void loadOrders(true)} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}><Text style={styles.retryText}>Thử lại</Text></Pressable>
          </View>
        ) : visibleOrders.length ? visibleOrders.map((order) => <OrderCard key={order.id} order={order} onDeleted={onDeleted} onConflict={() => void loadOrders(true)} />) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{history ? (activeTab === 'customer' ? 'Chưa có lịch sử đơn đã đăng' : 'Chưa có lịch sử đơn đã nhận') : activeTab === 'customer' ? 'Chưa có đơn đã đăng' : 'Chưa có đơn đã nhận'}</Text>
            <Text style={styles.emptyDescription}>{history ? (activeTab === 'customer' ? 'Các đơn bạn đăng đã hoàn tất hoặc đã hủy sẽ xuất hiện tại đây.' : 'Các đơn bạn nhận đi giúp đã hoàn tất hoặc đã hủy sẽ xuất hiện tại đây.') : activeTab === 'customer' ? 'Các yêu cầu bạn đăng sẽ xuất hiện tại đây.' : 'Các yêu cầu bạn nhận đi giúp sẽ xuất hiện tại đây.'}</Text>
          </View>
        )}

        {error && loaded && <Text accessibilityRole="alert" style={styles.deleteText}>{error} Kéo xuống để thử lại.</Text>}
        {!history && <Pressable accessibilityRole="button" onPress={() => router.push('/account/order-history')} style={styles.communityBanner}>
          <Text style={styles.emptyDescription}>Đơn đã hoàn tất và đã hủy nằm trong Tài khoản → Lịch sử đơn hàng.</Text>
        </Pressable>}

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 92,
    justifyContent: 'space-between',
    paddingBottom: 10,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  eyebrow: {
    color: colors.coral,
    fontFamily: fontFamilies.bodyExtraBold,
    fontSize: fontSizes.body,
    letterSpacing: letterSpacing.eyebrow,
  },
  heading: {
    color: colors.text,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.display,
    lineHeight: lineHeights.display,
    marginTop: 3,
  },
  searchButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 11,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  tabs: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    paddingHorizontal: 20,
  },
  tabButton: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 2,
    flex: 1,
    flexDirection: 'row',
    gap: 3,
    justifyContent: 'center',
    minHeight: 44,
  },
  activeTabButton: { borderBottomColor: colors.orange },
  tabLabel: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  activeTabLabel: { color: colors.forest },
  countBadge: {
    alignItems: 'center',
    backgroundColor: colors.orange,
    borderRadius: 99,
    justifyContent: 'center',
    minHeight: 19,
    minWidth: 19,
    paddingHorizontal: 5,
  },
  countText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  list: { gap: 12, padding: 16, paddingHorizontal: 20 },
  orderCard: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 15,
  },
  activeOrderCard: { borderColor: colors.orange, borderTopWidth: 3 },
  orderTopRow: { flexDirection: 'row', justifyContent: 'space-between' },
  status: {
    fontFamily: fontFamilies.bodyExtraBold,
    fontSize: fontSizes.caption,
    letterSpacing: letterSpacing.label,
  },
  shoppingStatus: { color: colors.statusGreen },
  waitingStatus: { color: colors.coral },
  orderTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.body,
    marginTop: 8,
  },
  orderSummary: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
    paddingBottom: 10,
  },
  shopperRow: {
    alignItems: 'center',
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    gap: 8,
    paddingTop: 12,
  },
  shopperAvatar: {
    alignItems: 'center',
    backgroundColor: colors.forest,
    borderRadius: 12,
    height: 35,
    justifyContent: 'center',
    width: 35,
  },
  shopperAvatarText: {
    color: colors.cream,
    fontFamily: fontFamilies.bodyExtraBold,
    fontSize: fontSizes.bodySmall,
  },
  shopperLabel: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  shopperName: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, marginTop: 2 },
  trackButton: {
    backgroundColor: colors.cream,
    borderRadius: 9,
    marginLeft: 'auto',
    padding: 8,
  },
  trackButtonText: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  waitingFooter: { alignItems: 'center', flexDirection: 'row', paddingTop: 11 },
  postedTime: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  editButton: {
    backgroundColor: '#F5F2EB',
    borderRadius: 9,
    padding: 8,
  },
  editButtonText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  communityBanner: {
    backgroundColor: colors.activityBanner,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  communityIcon: { color: colors.forest, fontSize: fontSizes.bodyLarge },
  communityTitle: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption },
  communityDescription: {
    color: colors.forest,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 18,
    borderWidth: 1,
    padding: 28,
  },
  emptyTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
  emptyDescription: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySmall,
    marginTop: 5,
  },
  retryButton: { backgroundColor: colors.orange, borderRadius: 9, marginTop: 12, paddingHorizontal: 14, paddingVertical: 9 },
  retryText: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  deleteButton: { marginLeft: 'auto', paddingVertical: 10, paddingHorizontal: 6 },
  deleteText: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall },
  backText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, paddingBottom: 5 },
  pressed: { opacity: 0.65 },
});
