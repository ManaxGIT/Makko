import type { ComponentProps } from 'react';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EvidenceGallery } from '@/features/orders/EvidenceGallery';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';
import { ExploreRequest, ExploreRequestItem, getExploreRequest } from '@/features/explore/api';
import { markExploreRequestUnavailable } from '@/features/explore/unavailableRequests';
import { useCurrentLocation } from '@/features/location/LocationProvider';
import { acceptOrder, getOrderDetail, OrderStatus } from '@/features/orders/api';

type SymbolName = ComponentProps<typeof SymbolView>['name'];

const itemColors = [colors.vegetable, colors.meat, colors.egg, colors.softPeach];
const detailStatusLabels: Record<OrderStatus, string> = {
  draft: 'Bản nháp', open: 'Đang tìm người đi chợ', accepted: 'Đã có người nhận',
  shopping: 'Đang đi chợ', delivering: 'Đang giao hàng', delivered: 'Chờ xác nhận nhận hàng', completed: 'Đã hoàn thành',
  cancelled: 'Đã hủy', disputed: 'Đang xử lý sự cố',
};

type DisplayItem = ExploreRequestItem & { color: string; emoji: string };

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toLocaleString('vi-VN');
}

function formatMoney(value: number, currency = 'VND') {
  return new Intl.NumberFormat('vi-VN', {
    currency,
    maximumFractionDigits: 0,
    style: 'currency',
  }).format(value);
}

function formatDeadline(value: string | null) {
  if (!value) return 'Thời gian linh hoạt';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Thời gian linh hoạt';
  return `Giao trước ${date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
}

function formatDistance(value: number | null, request: ExploreRequest) {
  if (value === null) {
    return [request.deliveryWard, request.deliveryDistrict, request.deliveryCity].filter(Boolean).join(', ');
  }
  return value < 1000
    ? `Cách bạn ≈ ${Math.round(value / 10) * 10}m (đường chim bay)`
    : `Cách bạn ≈ ${(value / 1000).toLocaleString('vi-VN', { maximumFractionDigits: 1 })}km (đường chim bay)`;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(-2).map((part) => part[0]).join('').toUpperCase();
}

function itemEmoji(name: string) {
  const normalized = name.toLocaleLowerCase('vi');
  if (/thịt|cá|tôm|gà|bò|heo/.test(normalized)) return '🥩';
  if (/trứng/.test(normalized)) return '🥚';
  if (/cà rốt|củ/.test(normalized)) return '🥕';
  if (/cà chua/.test(normalized)) return '🍅';
  if (/rau|cải/.test(normalized)) return '🥬';
  if (/cam|táo|xoài|chuối|trái cây/.test(normalized)) return '🍊';
  return '🧺';
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

function HeaderButton({ accessibilityLabel, icon, onPress }: {
  accessibilityLabel: string;
  icon: SymbolName;
  onPress?: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
    >
      <AppIcon name={icon} size={19} />
    </Pressable>
  );
}

function ShoppingItem({
  color,
  emoji,
  name,
  note,
  price,
}: DisplayItem & { price: string }) {
  return (
    <View style={styles.itemRow}>
      <View style={[styles.itemIcon, { backgroundColor: color }]}>
        <Text style={styles.itemEmoji}>{emoji}</Text>
      </View>
      <View style={styles.itemCopy}>
        <Text style={styles.itemName}>{name}</Text>
        <Text style={styles.itemNote}>{note}</Text>
      </View>
      <Text style={styles.itemPrice}>{price}</Text>
    </View>
  );
}

export default function RequestDetailsScreen() {
  const router = useRouter();
  const { coordinates } = useCurrentLocation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [request, setRequest] = useState<ExploreRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [participantStatus, setParticipantStatus] = useState<OrderStatus | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const readVersion = useRef(0);
  const locationKey = coordinates ? `${coordinates.latitude},${coordinates.longitude}` : 'none';
  const loadedRequest = useRef<{ id: string; at: number; locationKey: string } | null>(null);
  const loadRequest = useCallback(async () => {
    if (!id) {
      setError('Không tìm thấy mã yêu cầu.');
      setLoading(false);
      return;
    }
    const version = ++readVersion.current;
    const hasData = loadedRequest.current?.id === id;
    if (!hasData) { setLoading(true); setParticipantStatus(null); setRequest(null); }
    setError(null);
    setUnavailable(false);
    try {
      const detail = await getExploreRequest(id, coordinates ?? undefined);
      if (version !== readVersion.current) return;
      setRequest(detail);
      loadedRequest.current = { id, at: Date.now(), locationKey };
      setParticipantStatus(null);
    } catch (loadError) {
      if (version !== readVersion.current) return;
      const message = loadError instanceof Error ? loadError.message : '';
      if (message === 'Request not found') {
        try {
          const orderDetail = await getOrderDetail(id, coordinates ?? undefined);
          if (version !== readVersion.current) return;
          setRequest(orderDetail);
          loadedRequest.current = { id, at: Date.now(), locationKey };
          setParticipantStatus(orderDetail.status);
          return;
        } catch (orderError) {
          if (version !== readVersion.current) return;
          const orderMessage = orderError instanceof Error ? orderError.message : '';
          if (orderMessage !== 'Order not found') {
            setError(orderMessage || 'Không thể tải yêu cầu lúc này.');
            return;
          }
        }
      }
      const requestUnavailable = message === 'Request not found';
      if (requestUnavailable && id) markExploreRequestUnavailable(id);
      if (requestUnavailable) { loadedRequest.current = null; setRequest(null); }
      setUnavailable(requestUnavailable);
      setError(requestUnavailable
        ? 'Yêu cầu này vừa được người khác nhận và không còn trong danh sách Khám phá.'
        : message || 'Không thể tải yêu cầu lúc này.');
    } finally {
      if (version === readVersion.current) setLoading(false);
    }
  }, [id, coordinates, locationKey]);

  useFocusEffect(useCallback(() => {
    if (loadedRequest.current?.id !== id || loadedRequest.current.locationKey !== locationKey || Date.now() - loadedRequest.current.at >= 30_000) void loadRequest();
    return () => { readVersion.current += 1; };
  }, [loadRequest, id, locationKey]));

  const shoppingItems = useMemo(() => (request?.items ?? []).map((item, index): DisplayItem => ({
    ...item,
    color: itemColors[index % itemColors.length],
    emoji: itemEmoji(item.name),
  })), [request]);
  const visibleItems = expanded ? shoppingItems : shoppingItems.slice(0, 3);

  const handleAccept = async () => {
    if (!id || accepting) return;
    setAccepting(true);
    try {
      await acceptOrder(id);
      markExploreRequestUnavailable(id);
      router.replace(`/requests/${id}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (message.includes('request_not_available')) {
        markExploreRequestUnavailable(id);
        Alert.alert(
          'Yêu cầu đã có người nhận',
          'Một người khác đã nhận yêu cầu này trước bạn.',
          [{ text: 'Quay lại Khám phá', onPress: () => router.back() }],
        );
      } else {
        Alert.alert('Không thể nhận đơn', message || 'Vui lòng thử lại sau.');
      }
    } finally {
      setAccepting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <HeaderButton
          accessibilityLabel="Quay lại"
          icon={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }}
          onPress={() => router.back()}
        />
        <Text style={styles.headerTitle}>Chi tiết yêu cầu</Text>
        <HeaderButton
          accessibilityLabel="Thêm tùy chọn"
          icon={{ ios: 'ellipsis', android: 'more_horiz', web: 'more_horiz' }}
        />
      </View>

      {loading ? (
        <View style={styles.stateContainer}>
          <ActivityIndicator color={colors.coral} size="large" />
          <Text style={styles.stateDescription}>Đang tải chi tiết yêu cầu...</Text>
        </View>
      ) : !request ? (
        <View style={styles.stateContainer}>
          <Text style={styles.stateTitle}>Không thể tải yêu cầu</Text>
          <Text style={styles.stateDescription}>{error ?? 'Không tìm thấy dữ liệu yêu cầu.'}</Text>
          <Pressable accessibilityRole="button" onPress={unavailable ? () => router.back() : loadRequest} style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}>
            <Text style={styles.retryButtonText}>{unavailable ? 'Quay lại Khám phá' : 'Thử lại'}</Text>
          </Pressable>
        </View>
      ) : <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {error && <Text accessibilityRole="alert" style={styles.stateDescription}>{error}</Text>}
        <LinearGradient
          colors={['#FFE8B4', '#F5A466']}
          end={{ x: 1, y: 1 }}
          start={{ x: 0, y: 0 }}
          style={styles.hero}
        >
          <View style={[styles.heroCircle, styles.leftCircle]} />
          <View style={[styles.heroCircle, styles.rightCircle]} />
          <Text style={styles.produce}>🥬 🥕 🍅</Text>
          <View style={styles.statusPill}>
            <Text style={styles.statusText}>{participantStatus ? detailStatusLabels[participantStatus] : 'Đang tìm người đi chợ'}</Text>
          </View>
        </LinearGradient>

        <View style={styles.content}>
          <View style={styles.ownerRow}>
            <View style={styles.ownerAvatar}>
              <Text style={styles.ownerAvatarText}>{initials(request.ownerDisplayName)}</Text>
            </View>
            <View style={styles.ownerCopy}>
              <Text style={styles.ownerName}>{request.ownerDisplayName}</Text>
              <Text style={styles.ownerMeta}>
                {request.ownerRatingCount
                  ? `★ ${request.ownerAverageRating.toFixed(1)} · ${request.ownerRatingCount} lượt đánh giá`
                  : 'Chưa có đánh giá'}
              </Text>
            </View>
            <Pressable
              accessibilityRole="button"
              disabled={!participantStatus || participantStatus === 'draft' || participantStatus === 'open'}
              accessibilityState={{ disabled: !participantStatus || participantStatus === 'draft' || participantStatus === 'open' }}
              onPress={() => router.push(`/requests/${id}/chat`)}
              style={({ pressed }) => [styles.messageButton, (!participantStatus || participantStatus === 'draft' || participantStatus === 'open') && { opacity: 0.4 }, pressed && styles.pressed]}
            >
              <Text style={styles.messageButtonText}>Nhắn tin</Text>
            </Pressable>
          </View>

          <Text style={styles.title}>{request.title}</Text>
          <Text selectable style={styles.requestId}>UUID: {request.id}</Text>

          <View style={styles.metaChips}>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>◷ {formatDeadline(request.deliverBy)}</Text>
            </View>
            <View style={styles.metaChip}>
              <Text style={styles.metaChipText}>⌖ {formatDistance(request.distanceMeters, request)}</Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.listHeader}>
            <Text style={styles.listTitle}>Danh sách cần mua</Text>
            <Text style={styles.itemCount}>{request.itemCount} món</Text>
          </View>

          <View>
            {visibleItems.map((item) => (
              <ShoppingItem
                key={item.id}
                {...item}
                note={`${formatQuantity(item.quantity)} ${item.unit}${item.note ? ` · ${item.note}` : ''}`}
                price={item.estimatedUnitPrice === null ? 'Chưa có giá' : `~${formatMoney(item.estimatedUnitPrice, request.currency)}`}
              />
            ))}
          </View>

          {shoppingItems.length > 3 ? <Pressable
            accessibilityRole="button"
            onPress={() => setExpanded((current) => !current)}
            style={({ pressed }) => [styles.expandButton, pressed && styles.pressed]}
          >
            <Text style={styles.expandButtonText}>
              {expanded ? 'Thu gọn⌃' : `Xem thêm ${shoppingItems.length - 3} món⌄`}
            </Text>
          </Pressable> : null}
        </View>
        <View style={{ padding: 20, gap: 10, backgroundColor: colors.cream }}>
          <Text style={styles.rewardLabel}>Tiền mua hàng đã thỏa thuận</Text>
          <Text style={styles.reward}>{request.estimatedItemsTotal === null ? 'Chưa chốt' : formatMoney(request.estimatedItemsTotal, request.currency)}</Text>
          <Text style={styles.rewardLabel}>Phí đi chợ: {formatMoney(request.deliveryFee, request.currency)}</Text>
          <Text style={styles.rewardLabel}>Tổng thanh toán: {request.estimatedItemsTotal === null ? 'Chưa chốt' : formatMoney(request.estimatedItemsTotal + request.deliveryFee, request.currency)}</Text>
          <Text style={styles.rewardLabel}>Mua đủ, đúng yêu cầu: người nhận giữ phần tiết kiệm và chịu phần vượt giá. Thiếu hoặc thay món cần hai bên đồng ý và điều chỉnh tiền.</Text>
        </View>
        {!!participantStatus && <EvidenceGallery requestId={id} />}
      </ScrollView>}

      {!loading && request && !participantStatus ? <View style={styles.footer}>
        <View>
          <Text style={styles.rewardLabel}>Phí đi chợ</Text>
          <Text style={styles.reward}>{formatMoney(request.deliveryFee, request.currency)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={accepting}
          onPress={handleAccept}
          style={({ pressed }) => [styles.acceptButton, (pressed || accepting) && styles.pressed]}
        >
          <Text style={styles.acceptButtonText}>{accepting ? 'Đang nhận đơn...' : 'Nhận đi chợ giúp'}</Text>
        </Pressable>
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
  retryButtonText: { color: colors.surface, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
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
  headerButton: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 11,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  headerTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
  scrollContent: { flexGrow: 1 },
  hero: { alignItems: 'center', height: 148, justifyContent: 'center', overflow: 'hidden' },
  heroCircle: {
    borderColor: 'rgba(91,69,28,0.12)',
    borderRadius: 91,
    borderWidth: 1,
    height: 182,
    position: 'absolute',
    top: -17,
    width: 182,
  },
  leftCircle: { left: -80 },
  rightCircle: { right: -60 },
  produce: { fontSize: 23, transform: [{ rotate: '-3deg' }] },
  statusPill: {
    backgroundColor: colors.surface,
    borderRadius: 99,
    bottom: 12,
    left: 16,
    paddingHorizontal: 9,
    paddingVertical: 6,
    position: 'absolute',
  },
  statusText: { color: '#52825D', fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption },
  content: { paddingBottom: 18, paddingHorizontal: 20, paddingTop: 15 },
  ownerRow: { alignItems: 'center', flexDirection: 'row' },
  ownerAvatar: {
    alignItems: 'center',
    backgroundColor: colors.softPeach,
    borderRadius: 12,
    height: 35,
    justifyContent: 'center',
    width: 35,
  },
  ownerAvatarText: {
    color: colors.coral,
    fontFamily: fontFamilies.bodyExtraBold,
    fontSize: fontSizes.bodySmall,
  },
  ownerCopy: { gap: 2, marginLeft: 9 },
  ownerName: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
  ownerMeta: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  messageButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderRadius: 10,
    borderWidth: 1,
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  messageButtonText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  title: {
    color: colors.text,
    fontFamily: fontFamilies.display,
    fontSize: fontSizes.pageTitle,
    lineHeight: 28.6,
    marginTop: 17,
  },
  requestId: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, marginTop: 6 },
  metaChips: { flexDirection: 'row', gap: 7, paddingBottom: 15, paddingTop: 12 },
  metaChip: { backgroundColor: colors.requestMeta, borderRadius: 7, padding: 7 },
  metaChipText: { color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  divider: { backgroundColor: colors.border, height: 1 },
  listHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: 7,
    paddingTop: 14,
  },
  listTitle: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodyLarge },
  itemCount: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  itemRow: { alignItems: 'center', flexDirection: 'row', gap: 10, paddingVertical: 8 },
  itemIcon: {
    alignItems: 'center',
    borderRadius: 10,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  itemEmoji: { fontSize: 17 },
  itemCopy: { flex: 1, gap: 2 },
  itemName: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  itemNote: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption },
  itemPrice: { color: colors.text, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall },
  expandButton: { alignItems: 'center', paddingHorizontal: 6, paddingVertical: 5 },
  expandButtonText: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.body },
  footer: {
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  rewardLabel: {
    color: colors.muted,
    fontFamily: fontFamilies.body,
    fontSize: fontSizes.caption,
    letterSpacing: 0.56,
  },
  reward: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body },
  acceptButton: {
    backgroundColor: colors.orange,
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 13,
  },
  acceptButtonText: { color: colors.forest, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall },
  pressed: { opacity: 0.65 },
});
