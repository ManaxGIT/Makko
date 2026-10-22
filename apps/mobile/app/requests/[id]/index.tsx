import type { ComponentProps, ReactNode } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
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
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EvidenceGallery } from '@/features/orders/EvidenceGallery';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, letterSpacing, lineHeights } from '@/theme/typography';
import {
  getOrderTracking,
  getOrderDetail,
  OrderDetail,
  OrderStatus,
  OrderTracking,
  releaseOrder,
  transitionOrder,
} from '@/features/orders/api';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type TimelineStatus = 'complete' | 'current' | 'pending';

type TimelineStep = {
  description: string;
  status: TimelineStatus;
  title: string;
  message?: string;
  milestone?: OrderStatus;
};

const statusLabels: Record<OrderStatus, string> = {
  draft: 'BẢN NHÁP',
  open: 'ĐANG TÌM NGƯỜI ĐI CHỢ',
  accepted: 'ĐÃ NHẬN ĐƠN',
  shopping: 'ĐANG ĐI CHỢ',
  delivering: 'ĐANG GIAO HÀNG',
  delivered: 'CHỜ XÁC NHẬN NHẬN HÀNG',
  completed: 'ĐÃ HOÀN THÀNH',
  cancelled: 'ĐÃ HỦY',
  disputed: 'ĐANG XỬ LÝ SỰ CỐ',
};

const milestoneTitles: Partial<Record<OrderStatus, string>> = {
  accepted: 'Đã nhận yêu cầu',
  shopping: 'Đang chọn hàng',
  delivering: 'Đang giao đến bạn',
  delivered: 'Đã giao hàng',
  completed: 'Đã nhận hàng · Hoàn thành',
};

const milestones: OrderStatus[] = ['accepted', 'shopping', 'delivering', 'delivered', 'completed'];

const nextMilestone: Partial<Record<OrderStatus, OrderStatus>> = {
  accepted: 'shopping',
  shopping: 'delivering',
  delivering: 'delivered',
  delivered: 'completed',
};

const nextActionLabels: Partial<Record<OrderStatus, string>> = {
  accepted: 'Bắt đầu chọn hàng',
  shopping: 'Hoàn tất mua hàng',
  delivering: 'Xác nhận đã giao hàng',
  delivered: 'Xác nhận đã nhận hàng',
};

function canAdvanceOrder(order: OrderTracking) {
  return order.role === 'shopper'
    ? order.status === 'accepted' || order.status === 'shopping' || order.status === 'delivering'
    : order.status === 'delivered';
}

const TRACKING_REFRESH_INTERVAL_MS = 5_000;

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
  const exceptional = order.status === 'cancelled' || order.status === 'disputed';
  const eventTimes = new Map(order.statusHistory.map(event => [event.toStatus, event.createdAt]));
  if (!eventTimes.has('accepted') && order.assignmentAcceptedAt) eventTimes.set('accepted', order.assignmentAcceptedAt);
  const reachedIndex = exceptional
    ? Math.max(-1, ...milestones.map((status, index) => eventTimes.has(status) ? index : -1))
    : currentIndex;
  const shopper = order.role === 'shopper';
  const descriptions = [
    shopper ? 'Bạn đã nhận đơn và sẵn sàng đi chợ' : 'Người đi chợ đã nhận yêu cầu',
    shopper ? 'Kiểm tra đủ món, đúng yêu cầu' : 'Người đi chợ đang chọn và mua hàng',
    shopper ? 'Bạn đang di chuyển đến nơi nhận' : 'Người đi chợ đang di chuyển đến nơi nhận',
    shopper ? 'Bạn đã xác nhận giao hàng' : 'Người đi chợ đã xác nhận giao hàng',
    shopper ? 'Người đăng đã xác nhận nhận hàng' : 'Bạn đã xác nhận nhận hàng',
  ];
  const pending = ['Chờ nhận yêu cầu', 'Chờ bắt đầu chọn hàng', 'Chờ bắt đầu giao hàng', 'Chờ xác nhận đã giao hàng', 'Chờ xác nhận đã nhận hàng'];
  const steps = milestones.map((status, index): TimelineStep => ({
    milestone: status,
    title: status === 'delivering' && shopper ? 'Đang giao hàng' : milestoneTitles[status] ?? status,
    description: index > reachedIndex ? pending[index]
      : index === 1 && reachedIndex >= 2 ? 'Đã hoàn tất mua hàng'
      : index === 2 && reachedIndex > 2 ? 'Đã bắt đầu giao hàng' : descriptions[index],
    message: formatTime(eventTimes.get(status) ?? null) ?? undefined,
    status: index < reachedIndex || (index <= reachedIndex && (exceptional || order.status === 'completed'))
      ? 'complete' : index === currentIndex ? 'current' : 'pending',
  }));
  if (exceptional) {
    steps.splice(reachedIndex + 1, 0, {
      title: order.status === 'cancelled' ? 'Đơn đã hủy' : 'Đang xử lý sự cố',
      description: order.status === 'cancelled' ? 'Hành trình dừng tại đây.' : 'Chưa có thông tin chi tiết về sự cố.',
      message: formatTime(eventTimes.get(order.status) ?? null) ?? undefined,
      status: 'current',
    });
  }
  return steps;
}

function trackingHeading(order: OrderTracking) {
  const name = order.counterpart?.displayName ?? (order.role === 'shopper' ? 'người đăng' : 'Người đi chợ');
  if (order.status === 'cancelled') return 'Đơn hàng đã được hủy';
  if (order.status === 'disputed') return 'Đơn hàng đang có sự cố';
  if (order.status === 'open') return 'Đang tìm người đi chợ giúp bạn';
  if (order.status === 'draft') return 'Yêu cầu chưa được đăng';
  if (order.role === 'shopper') {
    if (order.status === 'delivering') return `Bạn đang giao đơn cho ${name}`;
    if (order.status === 'delivered') return 'Bạn đã giao hàng, chờ người nhận xác nhận';
    if (order.status === 'completed') return `Bạn đã hoàn thành đơn của ${name}`;
    return order.status === 'shopping'
      ? `Bạn đang chọn đồ cho ${name}`
      : `Bạn đã nhận đơn của ${name}`;
  }
  if (order.status === 'accepted') return `${name} đã nhận yêu cầu của bạn`;
  if (order.status === 'delivering') return `${name} đang giao đến bạn`;
  if (order.status === 'delivered') return `${name} đã giao hàng, bạn hãy kiểm tra và xác nhận`;
  if (order.status === 'completed') return 'Bạn đã xác nhận nhận hàng';
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
      disabled={!onPress}
      accessibilityState={{ disabled: !onPress }}
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
  children,
}: {
  children?: ReactNode;
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
        <View style={styles.timelineTitleRow}><Text style={styles.timelineTitle}>{title}</Text>{message ? <Text style={styles.timelineMeta}>{message}</Text> : null}</View>
        <Text style={styles.timelineDescription}>{description}</Text>
        {children}
      </View>
    </View>
  );
}

export default function OrderTrackingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [order, setOrder] = useState<OrderTracking | null>(null);
  const [detail, setDetail] = useState<OrderDetail | null>(null);
  const [detailError, setDetailError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [advancing, setAdvancing] = useState(false);

  const trackingLoaded = useRef<string | null>(null);
  const detailLoaded = useRef<{ id: string; at: number } | null>(null);
  const loadTracking = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? (trackingLoaded.current === id);
    if (!id) {
      setError('Không tìm thấy mã đơn hàng.');
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    try {
      const tracking = await getOrderTracking(id);
      trackingLoaded.current = id;
      setOrder(tracking);
      setError(null);
    } catch (loadError) {
      if (!silent) {
        setError(loadError instanceof Error ? loadError.message : 'Không thể tải trạng thái đơn hàng.');
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useFocusEffect(useCallback(() => {
    void loadTracking();
    const refreshInterval = setInterval(() => {
      void loadTracking({ silent: true });
    }, TRACKING_REFRESH_INTERVAL_MS);
    return () => clearInterval(refreshInterval);
  }, [loadTracking]));
  useFocusEffect(useCallback(() => {
    let active = true;
    if (detailLoaded.current?.id === id && Date.now() - detailLoaded.current.at < 30_000) return;
    if (detailLoaded.current?.id !== id) setDetail(null);
    setDetailError(false);
    if (id) void getOrderDetail(id).then(result => { if (active) { detailLoaded.current = { id, at: Date.now() }; setDetail(result); } })
      .catch(() => { if (active) setDetailError(true); });
    return () => { active = false; };
  }, [id]));
  const timelineSteps = useMemo(() => order ? buildTimeline(order) : [], [order]);
  const counterpartName = order?.counterpart?.displayName ?? 'Chưa có thông tin';
  const eta = formatTime(order?.deliverBy ?? null);
  const lastStatusTime = order ? formatTime(order.statusHistory.filter(event => event.toStatus === order.status).at(-1)?.createdAt ?? null) : null;
  const showEvidence = !!order && (order.status === 'delivering' || order.status === 'delivered' || order.status === 'completed'
    || ((order.status === 'cancelled' || order.status === 'disputed') && order.statusHistory.some(event => ['delivering', 'delivered', 'completed'].includes(event.toStatus))));
  const money = (value: number | null, currency = detail?.currency ?? 'VND') => value === null ? 'Chưa có thông tin' : new Intl.NumberFormat('vi-VN', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value);
  const currentMilestoneIndex = order ? milestones.indexOf(order.status) : -1;

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadTracking({ silent: true });
    if (id) {
      try { setDetail(await getOrderDetail(id)); setDetailError(false); }
      catch { setDetailError(true); }
    }
    setRefreshing(false);
  }, [id, loadTracking]);

  const handleRelease = () => {
    if (!id || releasing) return;
    Alert.alert(
      'Hủy nhận đơn?',
      'Đơn sẽ quay lại danh sách yêu cầu để người khác có thể nhận. Lịch sử chat của đơn sẽ bị xóa.',
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

  const handleAdvance = async () => {
    if (!id || !order || advancing || releasing || !canAdvanceOrder(order)) return;
    if (order.status === 'delivering' && order.role === 'shopper') { router.push(`/requests/${id}/evidence?stage=delivery`); return; }
    if (order.status === 'shopping' && order.role === 'shopper') { router.push(`/requests/${id}/evidence`); return; }
    const targetStatus = nextMilestone[order.status];
    if (!targetStatus) return;
    setAdvancing(true);
    try {
      await transitionOrder(id, targetStatus);
      await loadTracking();
    } catch (transitionError) {
      Alert.alert(
        'Không thể cập nhật giai đoạn',
        transitionError instanceof Error ? transitionError.message : 'Vui lòng thử lại sau.',
      );
    } finally {
      setAdvancing(false);
    }
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
          <Pressable accessibilityRole="button" onPress={() => { void loadTracking(); }} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <Text style={styles.retryButtonLabel}>Thử lại</Text>
          </Pressable>
        </View>
      ) : <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={(
          <RefreshControl
            colors={[colors.orange]}
            onRefresh={handleRefresh}
            refreshing={refreshing}
            tintColor={colors.orange}
          />
        )}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusSection}>
          <View style={styles.statusRow}>
            <View style={styles.statusPill}>
              <Text style={styles.statusLabel}>{statusLabels[order.status]}</Text>
            </View>
            {currentMilestoneIndex >= 0 ? (
              <Text style={styles.stageLabel}>GIAI ĐOẠN {currentMilestoneIndex + 1}/{milestones.length}</Text>
            ) : null}
          </View>
          <Text style={styles.heading}>{trackingHeading(order)}</Text>
          <Text style={styles.eta}>{order.status === 'delivered' ? (lastStatusTime ? `Đã giao lúc ${lastStatusTime}` : 'Chờ xác nhận nhận hàng') : order.status === 'completed' ? (lastStatusTime ? `Hoàn thành lúc ${lastStatusTime}` : 'Đơn đã hoàn thành') : order.status === 'cancelled' ? (lastStatusTime ? `Đã hủy lúc ${lastStatusTime}` : 'Đơn đã hủy') : order.status === 'disputed' ? (lastStatusTime ? `Sự cố ghi nhận lúc ${lastStatusTime}` : 'Đang xử lý sự cố') : eta ? `Giao trước ${eta}` : 'Thời gian giao linh hoạt'}</Text>

          <View style={styles.shopperCard}>
            <View style={styles.shopperAvatar}>
              <Text style={styles.shopperAvatarText}>{initials(counterpartName)}</Text>
            </View>
            <View style={styles.shopperCopy}>
              <Text style={styles.recipientLabel}>
                {order.role === 'shopper' ? 'GIAO CHO' : 'NGƯỜI ĐI CHỢ'}
              </Text>
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
                onPress={() => router.push(`/requests/${id}/chat`)}
                icon={{ ios: 'envelope.fill', android: 'mail', web: 'mail' }}
              />
            </View>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>{detail?.title ?? 'Thông tin đơn hàng'}</Text>
          {detail ? <>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>{detail.itemCount} món · Tiền hàng</Text><Text style={styles.summaryValue}>{money(detail.estimatedItemsTotal)}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryLabel}>Phí đi chợ</Text><Text style={styles.summaryValue}>{money(detail.deliveryFee)}</Text></View>
            <View style={styles.summaryRow}><Text style={styles.summaryValue}>Tổng tiền đã chốt</Text><Text style={styles.summaryValue}>{money(detail.estimatedItemsTotal === null ? null : detail.estimatedItemsTotal + detail.deliveryFee)}</Text></View>
            <Text style={styles.summaryNote}>Tổng tiền giữ nguyên khi mua đủ, đúng yêu cầu.</Text>
            {order.status === 'delivering' && <Text style={styles.summaryNote}>Khu vực giao: {[detail.deliveryWard, detail.deliveryDistrict, detail.deliveryCity].filter(Boolean).join(', ') || 'Chưa có thông tin'}</Text>}
          </> : <Text style={styles.summaryNote}>{detailError ? 'Chưa tải được thông tin đơn. Kéo xuống để thử lại.' : 'Đang tải thông tin đơn…'}</Text>}
        </View>
        <View style={styles.journeySection}>
          <View style={styles.journeyHeadingRow}>
            <Text style={styles.sectionTitle}>Hành trình đơn hàng</Text>
            {currentMilestoneIndex >= 0 ? (
              <Text style={styles.progressLabel}>{currentMilestoneIndex + 1} trên {milestones.length}</Text>
            ) : null}
          </View>
          <View style={styles.progressBar}>
            {milestones.map((status) => (
              <View
                key={status}
                style={[styles.progressSegment, timelineSteps.some(step => step.milestone === status && step.status !== 'pending') && styles.progressSegmentActive]}
              />
            ))}
          </View>
          <View style={styles.timeline}>
            {timelineSteps.map((step, index) => (
              <TimelineItem
                key={step.title}
                {...step}
                isLast={index === timelineSteps.length - 1}
              >
                {step.milestone === 'shopping' && showEvidence && <View style={styles.evidence}><EvidenceGallery requestId={order.id} category="purchase" /></View>}
                {step.milestone === 'delivered' && showEvidence && (order.status === 'delivered' || order.status === 'completed' || order.statusHistory.some(event => event.toStatus === 'delivered')) && <View style={styles.evidence}><EvidenceGallery requestId={order.id} category="delivery" /></View>}
                {step.milestone === 'shopping' && order.status === 'shopping' && <View style={styles.shoppingHint}><Text style={styles.summaryNote}>{order.role === 'shopper' ? 'Khi mua xong: kiểm tra từng món, thêm ít nhất 1 ảnh hàng và xác nhận trước khi giao. Hóa đơn không bắt buộc.' : 'Ảnh hàng đã mua sẽ xuất hiện tại đây khi người đi chợ hoàn tất mua hàng.'}</Text></View>}
              </TimelineItem>
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
        {canAdvanceOrder(order) ? (
          <View style={styles.actionRow}>
            {order.role === 'shopper' && order.status === 'accepted' ? (
              <Pressable
                accessibilityRole="button"
                disabled={releasing || advancing}
                onPress={handleRelease}
                style={({ pressed }) => [styles.releaseButton, (pressed || releasing) && styles.pressed]}
              >
                <Text style={styles.releaseButtonLabel}>{releasing ? 'Đang hủy...' : 'Hủy nhận đơn'}</Text>
              </Pressable>
            ) : null}
            <Pressable
              accessibilityRole="button"
              disabled={advancing || releasing}
              onPress={handleAdvance}
              style={({ pressed }) => [styles.advanceButton, (pressed || advancing) && styles.pressed]}
            >
              <Text style={styles.advanceButtonLabel}>
                {advancing ? 'Đang cập nhật...' : `${nextActionLabels[order.status]}  →`}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {order.role === 'shopper' && order.status === 'delivered' ? (
          <Text style={styles.waitingMessage}>Chờ người đăng xác nhận nhận hàng</Text>
        ) : null}
      </View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  waitingMessage: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, textAlign: 'center', paddingVertical: 8 },
  summaryCard: { marginHorizontal: 20, marginTop: 16, padding: 14, gap: 8, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 14 },
  summaryTitle: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, color: colors.forest, marginBottom: 2 },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  summaryLabel: { fontFamily: fontFamilies.body, fontSize: fontSizes.caption, color: colors.text },
  summaryValue: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, color: colors.text },
  summaryNote: { fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, color: colors.muted },
  evidence: { marginTop: 8 },
  shoppingHint: { backgroundColor: colors.cream, borderRadius: 12, padding: 12, marginTop: 8 },
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
    paddingTop: 18,
  },
  statusRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
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
    letterSpacing: letterSpacing.label,
  },
  stageLabel: {
    color: colors.forestLight,
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.caption,
    letterSpacing: letterSpacing.label,
  },
  heading: {
    color: colors.surface,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.sectionTitle,
    lineHeight: lineHeights.sectionTitle,
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
  shopperCopy: { flex: 1, gap: 1, marginLeft: 9 },
  recipientLabel: {
    color: colors.forestLight,
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.caption,
    letterSpacing: letterSpacing.label,
  },
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
  journeyHeadingRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  sectionTitle: {
    color: colors.text,
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.body,
  },
  progressLabel: { color: colors.muted, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  progressBar: { flexDirection: 'row', gap: 5, marginTop: 12 },
  progressSegment: { backgroundColor: colors.timelinePending, borderRadius: 99, flex: 1, height: 4 },
  progressSegmentActive: { backgroundColor: colors.forest },
  timeline: { marginTop: 18 },
  timelineItem: { flexDirection: 'row', minHeight: 68 },
  timelineItemWithMessage: { minHeight: 82 },
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
  timelineCopy: { flex: 1, gap: 4, marginLeft: 13, paddingBottom: 22 },
  timelineTitleRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 },
  timelineTitle: {
    flexShrink: 1,
    color: colors.text,
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.bodySmall,
  },
  timelineDescription: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
  },
  timelineMeta: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
  },
  tipCard: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 14,
    flexDirection: 'row',
    gap: 11,
    marginTop: 2,
    padding: 12,
  },
  tipIcon: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 12,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  tipCopy: { flex: 1, gap: 2 },
  tipTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  tipDescription: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
    lineHeight: lineHeights.caption,
  },
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
    minHeight: 48,
  },
  detailButtonLabel: {
    color: colors.forest,
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.body,
  },
  actionRow: { flexDirection: 'row', gap: 10 },
  releaseButton: {
    alignItems: 'center',
    borderColor: colors.coral,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 46,
  },
  releaseButtonLabel: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  advanceButton: {
    alignItems: 'center',
    backgroundColor: colors.orange,
    borderRadius: 12,
    flex: 1.35,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 10,
  },
  advanceButtonLabel: {
    color: colors.forest,
    fontFamily: fontFamilies.bodyBold,
    fontSize: fontSizes.bodySmall,
    textAlign: 'center',
  },
  pressed: { opacity: 0.65 },
});
