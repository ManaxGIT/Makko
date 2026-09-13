import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { listMyOrders, OrderStatus, OrderSummary } from '@/features/orders/api';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type OrderTab = 'active' | 'completed';
const completedStatuses: OrderStatus[] = ['completed', 'cancelled'];
const statusLabels: Record<OrderStatus, string> = {
  draft: 'BẢN NHÁP', open: 'ĐANG TÌM NGƯỜI', accepted: 'ĐÃ CÓ NGƯỜI NHẬN',
  shopping: 'ĐANG ĐI CHỢ', delivering: 'ĐANG GIAO', completed: 'ĐÃ HOÀN THÀNH',
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
  order,
}: {
  order: OrderSummary;
}) {
  const router = useRouter();
  const isWaiting = order.status === 'draft' || order.status === 'open';
  const isProgress = ['accepted', 'shopping', 'delivering', 'disputed'].includes(order.status);
  const isCompleted = completedStatuses.includes(order.status);
  const counterpartLabel = order.role === 'customer' ? 'Người đi chợ' : 'Người nhờ mua';

  return (
    <View style={[styles.orderCard, isProgress && styles.activeOrderCard]}>
      <View style={styles.orderTopRow}>
        <Text style={[styles.status, isProgress ? styles.shoppingStatus : styles.waitingStatus]}>
          {statusLabels[order.status]}
        </Text>
      </View>

      <Text style={styles.orderTitle}>{order.title}</Text>
      <Text style={styles.orderSummary}>{order.itemCount} món · {formatDeadline(order.deliverBy)}</Text>

      {!isWaiting && order.counterpart ? (
        <View style={styles.shopperRow}>
          <View style={styles.shopperAvatar}>
            <Text style={styles.shopperAvatarText}>{initials(order.counterpart.displayName)}</Text>
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
          <Pressable
            accessibilityRole="button"
            style={({ pressed }) => [styles.editButton, pressed && styles.pressed]}
          >
            <Text style={styles.editButtonText}>Chỉnh sửa</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

export default function OrdersScreen() {
  const [activeTab, setActiveTab] = useState<OrderTab>('active');
  const [orders, setOrders] = useState<OrderSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOrders(await listMyOrders());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải đơn hàng lúc này.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void loadOrders(); }, [loadOrders]));

  const activeOrders = useMemo(() => orders.filter((order) => !completedStatuses.includes(order.status)), [orders]);
  const completedOrders = useMemo(() => orders.filter((order) => completedStatuses.includes(order.status)), [orders]);
  const visibleOrders = activeTab === 'active' ? activeOrders : completedOrders;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.header}>
        <View>
          <Text style={styles.eyebrow}>HOẠT ĐỘNG</Text>
          <Text style={styles.heading}>Đơn hàng</Text>
        </View>
        <Pressable
          accessibilityLabel="Tìm kiếm đơn hàng"
          style={({ pressed }) => [styles.searchButton, pressed && styles.pressed]}
        >
          <AppIcon
            name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }}
            size={20}
          />
        </Pressable>
      </View>

      <View accessibilityRole="tablist" style={styles.tabs}>
        <TabButton
          active={activeTab === 'active'}
          count={activeOrders.length}
          label="Đang diễn ra"
          onPress={() => setActiveTab('active')}
        />
        <TabButton
          active={activeTab === 'completed'}
          label="Đã xong"
          onPress={() => setActiveTab('completed')}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
      >
        {loading ? <View style={styles.emptyState}><ActivityIndicator color={colors.coral} /><Text style={styles.emptyDescription}>Đang tải đơn hàng...</Text></View> : error ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Không thể tải đơn hàng</Text>
            <Text style={styles.emptyDescription}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={() => void loadOrders()} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}><Text style={styles.retryText}>Thử lại</Text></Pressable>
          </View>
        ) : visibleOrders.length ? visibleOrders.map((order) => <OrderCard key={order.id} order={order} />) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>{activeTab === 'active' ? 'Chưa có đơn đang diễn ra' : 'Chưa có đơn đã hoàn thành'}</Text>
            <Text style={styles.emptyDescription}>{activeTab === 'active' ? 'Các đơn mới sẽ xuất hiện tại đây.' : 'Các đơn đã xong sẽ xuất hiện tại đây.'}</Text>
          </View>
        )}

        <View style={styles.communityBanner}>
          <Text style={styles.communityIcon}>♧</Text>
          <View>
            <Text style={styles.communityTitle}>Mỗi chuyến chợ, thêm một kết nối.</Text>
            <Text style={styles.communityDescription}>
              Makko giữ bạn gần hơn với những người hàng xóm.
            </Text>
          </View>
        </View>
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
    letterSpacing: 1.76,
  },
  heading: {
    color: colors.text,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.display,
    lineHeight: 37,
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
    letterSpacing: 0.56,
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
    marginLeft: 'auto',
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
  pressed: { opacity: 0.65 },
});
