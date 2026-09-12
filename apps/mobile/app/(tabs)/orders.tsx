import type { ComponentProps } from 'react';
import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes } from '@/theme/typography';

type SymbolName = ComponentProps<typeof SymbolView>['name'];
type OrderTab = 'active' | 'completed';

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
  deadline,
  id,
  itemCount,
  status,
  title,
  type,
}: {
  deadline: string;
  id: string;
  itemCount: number;
  status: string;
  title: string;
  type: 'shopping' | 'waiting';
}) {
  const router = useRouter();
  const isShopping = type === 'shopping';

  return (
    <View style={[styles.orderCard, isShopping && styles.activeOrderCard]}>
      <View style={styles.orderTopRow}>
        <Text style={[styles.status, isShopping ? styles.shoppingStatus : styles.waitingStatus]}>
          {status}
        </Text>
      </View>

      <Text style={styles.orderTitle}>{title}</Text>
      <Text style={styles.orderSummary}>{itemCount} món · {deadline}</Text>

      {isShopping ? (
        <View style={styles.shopperRow}>
          <View style={styles.shopperAvatar}>
            <Text style={styles.shopperAvatarText}>TƯ</Text>
          </View>
          <View>
            <Text style={styles.shopperLabel}>Người đi chợ</Text>
            <Text style={styles.shopperName}>Chú Tư · ★ 4.95</Text>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => router.push(`/requests/${id}`)}
            style={({ pressed }) => [styles.trackButton, pressed && styles.pressed]}
          >
            <Text style={styles.trackButtonText}>Theo dõi</Text>
          </Pressable>
        </View>
      ) : (
        <View style={styles.waitingFooter}>
          <Text style={styles.postedTime}>◷ Đã đăng 8 phút trước</Text>
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
          count={2}
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
        {activeTab === 'active' ? (
          <>
            <OrderCard
              deadline="Giao trước 17:30"
              id="81f83d5e-1f7c-4dcb-a221-b487358a16bb"
              itemCount={5}
              status="ĐANG ĐI CHỢ"
              title="Bữa cơm chiều cho gia đình"
              type="shopping"
            />
            <OrderCard
              deadline="Giao trước 07:00 mai"
              id="f1c79ef1-8f60-47bc-aeb8-0f461e4cabcc"
              itemCount={4}
              status="ĐANG TÌM NGƯỜI"
              title="Trái cây & đồ ăn sáng"
              type="waiting"
            />
          </>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>Chưa có đơn đã hoàn thành</Text>
            <Text style={styles.emptyDescription}>Các đơn đã xong sẽ xuất hiện tại đây.</Text>
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
  pressed: { opacity: 0.65 },
});
