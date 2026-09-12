import type { ComponentProps } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type TimelineStatus = 'complete' | 'current' | 'pending';

const timelineSteps: Array<{
  description: string;
  status: TimelineStatus;
  title: string;
  message?: string;
}> = [
  { title: 'Đã nhận yêu cầu', description: '16:02', status: 'complete' },
  { title: 'Đã đến chợ Bến Thành', description: '16:18', status: 'complete' },
  {
    title: 'Đang chọn hàng',
    description: 'Chú Tư vừa gửi 1 ảnh',
    status: 'current',
    message: '“Rau hôm nay rất tươi nha con!”',
  },
  { title: 'Giao đến bạn', description: 'Dự kiến 17:15', status: 'pending' },
];

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

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.statusSection}>
          <View style={styles.statusPill}>
            <Text style={styles.statusLabel}>ĐANG ĐI CHỢ</Text>
          </View>
          <Text style={styles.heading}>Chú Tư đang chọn{`\n`}đồ giúp bạn</Text>
          <Text style={styles.eta}>Dự kiến giao lúc 17:15</Text>

          <View style={styles.shopperCard}>
            <View style={styles.shopperAvatar}>
              <Text style={styles.shopperAvatarText}>TƯ</Text>
            </View>
            <View style={styles.shopperCopy}>
              <Text style={styles.shopperName}>Nguyễn Văn Tư</Text>
              <Text style={styles.shopperMeta}>★ 4.95 · 126 đơn</Text>
            </View>
            <View style={styles.contactActions}>
              <RoundButton
                accessibilityLabel="Gọi cho chú Tư"
                icon={{ ios: 'phone.fill', android: 'call', web: 'call' }}
              />
              <RoundButton
                accessibilityLabel="Nhắn tin cho chú Tư"
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
      </ScrollView>

      <View style={styles.footer}>
        <Pressable
          accessibilityRole="button"
          onPress={() => router.push(`/requests/${id}/details`)}
          style={({ pressed }) => [styles.detailButton, pressed && styles.pressed]}
        >
          <Text style={styles.detailButtonLabel}>Xem chi tiết đơn</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
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
  pressed: { opacity: 0.65 },
});
