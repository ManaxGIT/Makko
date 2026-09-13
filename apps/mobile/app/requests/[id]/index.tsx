import type { ComponentProps } from 'react';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';
import { getOrderTracking, OrderStatus, OrderTracking, releaseOrder } from '@/features/orders/api';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type TimelineStatus = 'complete' | 'current' | 'pending';

type TimelineStep = {
  description: string;
  status: TimelineStatus;
  title: string;
  message?: string;
};

const statusLabels: Record<OrderStatus, string> = {
  draft: 'BẢN NHÁP',
  open: 'ĐANG TÌM NGƯỜI ĐI CHỢ',
  accepted: 'ĐÃ NHẬN ĐƠN',
  shopping: 'ĐANG ĐI CHỢ',
  delivering: 'ĐANG GIAO HÀNG',
  completed: 'ĐÃ HOÀN THÀNH',
  cancelled: 'ĐÃ HỦY',
  disputed: 'ĐANG XỬ LÝ SỰ CỐ',
};

const milestoneTitles: Partial<Record<OrderStatus, string>> = {
  accepted: 'Đã nhận yêu cầu',
  shopping: 'Đang chọn hàng',
  delivering: 'Đang giao đến bạn',
  completed: 'Đã giao hàng',
};

const milestones: OrderStatus[] = ['accepted', 'shopping', 'delivering', 'completed'];

function formatTime(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? null
    : date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase();
}

function buildTimeline(order: OrderTracking): TimelineStep[] {
  const currentIndex = milestones.indexOf(order.status);
  const eventTimes = new Map(order.statusHistory.map((event) => [event.toStatus, event.createdAt]));
  if (!eventTimes.has('accepted') && order.assignmentAcceptedAt) {
    eventTimes.set('accepted', order.assignmentAcceptedAt);
  }

  const steps = milestones.map((status, index): TimelineStep => {
    const eventTime = formatTime(eventTimes.get(status) ?? null);
    const pendingEta = status === 'delivering' ? formatTime(order.deliverBy) : null;
    return {
      title: milestoneTitles[status] ?? status,
      description: eventTime ?? (pendingEta ? `Dự kiến ${pendingEta}` : 'Đang chờ cập nhật'),
      status: index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'pending',
    };
  });

  if (order.status === 'cancelled' || order.status === 'disputed') {
    const event = order.statusHistory.find((item) => item.toStatus === order.status);
    steps.push({
      title: order.status === 'cancelled' ? 'Đơn đã hủy' : 'Đang xử lý sự cố',
      description: formatTime(event?.createdAt ?? null) ?? 'Vừa cập nhật',
      status: 'current',
    });
  }
  return steps;
}

function trackingHeading(order: OrderTracking) {
  const name = order.counterpart?.displayName ?? 'Người đi chợ';
  if (order.role === 'shopper') {
    if (order.status === 'delivering') return `Bạn đang giao đơn cho ${name}`;
    if (order.status === 'completed') return `Bạn đã hoàn thành đơn của ${name}`;
    return `Bạn đang mua giúp ${name}`;
  }
  if (order.status === 'accepted') return `${name} đã nhận yêu cầu của bạn`;
  if (order.status === 'delivering') return `${name} đang giao đến bạn`;
  if (order.status === 'completed') return `${name} đã giao hàng`;
  if (order.status === 'cancelled') return 'Đơn hàng đã được hủy';
  if (order.status === 'disputed') return 'Đơn hàng đang được hỗ trợ';
  return `${name} đang chọn đồ giúp bạn`;
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

function RoundButton({ accessibilityLabel, icon, onPress }: {
  accessibilityLabel: string;
  icon: SymbolName;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.roundButton, pressed && styles.pressed]}
    >
      <AppIcon name={icon} size={18} />
    </Pressable>
  );
}

function TimelineMarker({ status }: { status: TimelineStatus }) {
  if (status === 'complete') {
    return (
      <View style={[styles.marker, styles.completeMarker]}>
        <Text style={styles.check}>✓</Text>
      </View>
    );
  }

  if (status === 'current') {
    return (
      <View style={[styles.marker, styles.currentMarker, styles.currentMarkerGlow]}>
        <View style={styles.currentDot} />
      </View>
    );
  }

  return <View style={[styles.marker, styles.pendingMarker]} />;
}

function TimelineItem({
  description,
  message,
  isLast,
  status,
  title,
}: {
  description: string;
  message?: string;
  isLast: boolean;
  status: TimelineStatus;
  title: string;
}) {
  return (
    <View style={[styles.timelineItem, message ? styles.timelineItemWithMessage : undefined]}>
      <View style={styles.markerColumn}>
        <TimelineMarker status={status} />
        {!isLast && <View style={styles.timelineLine} />}
      </View>
      <View style={styles.timelineCopy}>
        <Text style={styles.timelineTitle}>{title}</Text>
        <Text style={styles.timelineDescription}>{description}</Text>
        {message ? (
          <View style={styles.messageCard}>
            <Text style={styles.basket}>🧺</Text>
            <Text style={styles.message}>{message}</Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

export default function OrderTrackingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderTracking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [releasing, setReleasing] = useState(false);

  const loadTracking = useCallback(async () => {
    if (!id) {
      setError('Không tìm thấy mã đơn hàng.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setOrder(await getOrderTracking(id));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Không thể tải trạng thái đơn hàng.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => { void loadTracking(); }, [loadTracking]));
  const timelineSteps = useMemo(() => order ? buildTimeline(order) : [], [order]);
  const counterpartName = order?.counterpart?.displayName ?? 'Chưa có thông tin';
  const eta = formatTime(order?.deliverBy ?? null);

  const handleRelease = () => {
    if (!id || releasing) return;
    Alert.alert(
      'Hủy nhận đơn?',
      'Đơn sẽ quay lại danh sách yêu cầu để người khác có thể nhận.',
      [
        { text: 'Không', style: 'cancel' },
        {
          text: 'Hủy nhận đơn',
          style: 'destructive',
          onPress: () => {
            setReleasing(true);
            void releaseOrder(id)
              .then(() => router.replace('/(tabs)/orders'))
              .catch((releaseError) => {
                Alert.alert(
                  'Không thể hủy nhận đơn',
                  releaseError instanceof Error ? releaseError.message : 'Vui lòng thử lại sau.',
                );
              })
              .finally(() => setReleasing(false));
          },
        },
      ],
    );
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <RoundButton
          accessibilityLabel="Quay lại"
          icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
          onPress={() => router.back()}
        />
        <Text style={styles.headerTitle}>Theo dõi đơn</Text>
        <RoundButton
          accessibilityLabel="Trợ giúp"
          icon={{ ios: 'questionmark', android: 'question_mark', web: 'question_mark' }}
        />
      </View>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator color={colors.orange} size="large" />
          <Text style={styles.stateDescription}>Đang tải hành trình đơn hàng...</Text>
        </View>
      ) : error || !order ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>Không thể tải đơn hàng</Text>
          <Text style={styles.stateDescription}>{error ?? 'Không tìm thấy dữ liệu đơn hàng.'}</Text>
          <Pressable accessibilityRole="button" onPress={loadTracking} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <Text style={styles.retryButtonLabel}>Thử lại</Text>
          </Pressable>
        </View>
      ) : <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusSection}>
          <View style={styles.statusPill}>
            <Text style={styles.statusLabel}>{statusLabels[order.status]}</Text>
          </View>
          <Text style={styles.heading}>{trackingHeading(order)}</Text>
          <Text style={styles.eta}>{eta ? `Dự kiến giao lúc ${eta}` : 'Thời gian giao đang được cập nhật'}</Text>

          <View style={styles.shopperCard}>
            <View style={styles.shopperAvatar}>
              <Text style={styles.shopperAvatarText}>{initials(counterpartName)}</Text>
            </View>
            <View style={styles.shopperCopy}>
              <Text style={styles.shopperName}>{counterpartName}</Text>
              <Text style={styles.shopperMeta}>
                {order.counterpart?.ratingCount
                  ? `★ ${order.counterpart.averageRating.toFixed(2)} · ${order.counterpart.ratingCount} đánh giá`
                  : 'Chưa có đánh giá'}
              </Text>
            </View>
            <View style={styles.contactActions}>
              <RoundButton
                accessibilityLabel={`Gọi cho ${counterpartName}`}
                icon={{ ios: 'phone.fill', android: 'call', web: 'call' }}
              />
              <RoundButton
                accessibilityLabel={`Nhắn tin cho ${counterpartName}`}
                icon={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
              />
            </View>
          </View>
        </View>

        <View style={styles.journeySection}>
          <Text style={styles.sectionTitle}>Hành trình đơn hàng</Text>
          <View style={styles.timeline}>
            {timelineSteps.map((step, index) => (
              <TimelineItem
                key={step.title}
                {...step}
                isLast={index === timelineSteps.length - 1}
              />
            ))}
          </View>
        </View>
      </ScrollView>}

      {!loading && order ? <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/requests/${id}/details`)}
          style={({ pressed }) => [styles.detailButton, pressed && styles.pressed]}
        >
          <Text style={styles.detailButtonLabel}>Xem chi tiết đơn</Text>
        </Pressable>
        {order.role === 'shopper' && order.status === 'accepted' ? (
          <Pressable
            accessibilityRole="button"
            disabled={releasing}
            onPress={handleRelease}
            style={({ pressed }) => [styles.releaseButton, (pressed || releasing) && styles.pressed]}
          >
            <Text style={styles.releaseButtonLabel}>{releasing ? 'Đang hủy nhận đơn...' : 'Hủy nhận đơn'}</Text>
          </Pressable>
        ) : null}
      </View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  stateContainer: { alignItems: 'center', flex: 1, gap: 10, justifyContent: 'center', paddingHorizontal: 32 },
  stateTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodyLarge },
  stateDescription: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, textAlign: 'center' },
  retryButton: { backgroundColor: colors.forest, borderRadius: 12, marginTop: 6, paddingHorizontal: 22, paddingVertical: 12 },
  retryButtonLabel: { color: colors.surface, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
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
  headerTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.body,
  },
  roundButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 11,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  scrollContent: { flexGrow: 1 },
  statusSection: {
    backgroundColor: colors.forest,
    paddingBottom: 19,
    paddingHorizontal: 20,
    paddingTop: 28,
  },
  statusPill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  statusLabel: {
    color: colors.goldLight,
    fontFamily: fontFamilies.bodyExtraBold,
    fontSize: fontSizes.caption,
    letterSpacing: 0.7,
  },
  heading: {
    color: colors.surface,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.pageTitle,
    lineHeight: 29.38,
    marginTop: 9,
  },
  eta: {
    color: colors.forestLight,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySmall,
    marginBottom: 14,
    marginTop: 6,
  },
  shopperCard: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    flexDirection: 'row',
    padding: 10,
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
  shopperCopy: { gap: 2, marginLeft: 9 },
  shopperName: {
    color: colors.surface,
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.bodySmall,
  },
  shopperMeta: {
    color: colors.forestLight,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
  },
  contactActions: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
  journeySection: { flex: 1, padding: 20 },
  sectionTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.body,
  },
  timeline: { marginTop: 17 },
  timelineItem: { flexDirection: 'row', minHeight: 65 },
  timelineItemWithMessage: { minHeight: 120 },
  markerColumn: { alignItems: 'center', width: 21 },
  marker: {
    alignItems: 'center',
    borderRadius: 99,
    height: 21,
    justifyContent: 'center',
    width: 21,
    zIndex: 1,
  },
  completeMarker: { backgroundColor: colors.forest, borderColor: colors.forest, borderWidth: 2 },
  check: { color: colors.surface, fontSize: fontSizes.bodySmall },
  currentMarker: { backgroundColor: colors.background, borderColor: colors.orange, borderWidth: 2 },
  currentMarkerGlow: {
    shadowColor: '#FDE8C4',
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  currentDot: { backgroundColor: colors.orange, borderRadius: 4, height: 6, width: 6 },
  pendingMarker: {
    backgroundColor: colors.background,
    borderColor: colors.timelinePending,
    borderWidth: 2,
  },
  timelineLine: { backgroundColor: colors.timeline, flex: 1, marginTop: 4, width: 1 },
  timelineCopy: { flex: 1, gap: 3, marginLeft: 13 },
  timelineTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.bodySmall,
  },
  timelineDescription: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
  },
  messageCard: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    marginTop: 7,
    minHeight: 44,
    paddingHorizontal: 9,
  },
  basket: { fontSize: 18, marginRight: 9 },
  message: { color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  footer: {
    backgroundColor: colors.background,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  detailButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderColor: colors.forest,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  detailButtonLabel: {
    color: colors.forest,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.bodySmall,
  },
  releaseButton: { alignItems: 'center', justifyContent: 'center', minHeight: 40 },
  releaseButtonLabel: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  pressed: { opacity: 0.65 },
});
