import { useRef } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { useAuth } from '@/features/auth/AuthProvider';
import type { ChatMessage } from '@/features/chat/api';
import { useChat } from '@/features/chat/useChat';
import type { OrderStatus } from '@/features/orders/api';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, letterSpacing, lineHeights } from '@/theme/typography';

const statusLabels: Record<OrderStatus, string> = {
  draft: 'Bản nháp', open: 'Đang tìm người', accepted: 'Đã nhận yêu cầu',
  shopping: 'Đang chọn hàng', delivering: 'Đang giao hàng', delivered: 'Chờ xác nhận nhận hàng',
  completed: 'Đã hoàn tất', cancelled: 'Đã hủy', disputed: 'Đang xử lý sự cố',
};
const time = (date: string) => new Date(date).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
const day = (date: string) => new Date(date).toLocaleDateString('vi-VN');
const initials = (name: string) => name.trim().split(/\s+/).slice(-2).map(part => part[0]).join('').toUpperCase();

export default function OrderChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { isLoading, session } = useAuth();
  if (isLoading) return <View style={styles.loading}><ActivityIndicator color={colors.forest} /></View>;
  if (!session) return <Redirect href="/auth/login" />;
  return <Conversation key={`${session.user.id}:${id}`} requestId={id} userId={session.user.id} />;
}

function Conversation({ requestId, userId }: { requestId: string; userId: string }) {
  const router = useRouter();
  const state = useChat(requestId, userId);
  const { chat, messages } = state;
  const list = useRef<FlatList<ChatMessage>>(null);
  const send = () => { list.current?.scrollToOffset({ offset: 0, animated: true }); void state.send(); };
  const money = (value: number) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: chat?.currency ?? 'VND', maximumFractionDigits: 0 }).format(value);
  const goBack = () => router.canGoBack() ? router.back() : router.replace('/(tabs)/orders');
  const renderMessage = ({ item, index }: { item: ChatMessage; index: number }) => {
    const mine = item.senderId === userId;
    const showDate = !messages[index + 1] || day(messages[index + 1].createdAt) !== day(item.createdAt);
    return <View>
      {showDate && <Text style={styles.day}>{day(item.createdAt) === day(new Date().toISOString()) ? 'Hôm nay' : day(item.createdAt)}</Text>}
      <View style={[styles.message, mine && styles.mine]}>
        <View style={[styles.bubble, mine && styles.myBubble]}><Text selectable style={[styles.body, mine && styles.myBody]}>{item.body}</Text></View>
        <Text style={[styles.time, mine && styles.myTime]}>{time(item.createdAt)}</Text>
      </View>
    </View>;
  };
  return <SafeAreaView style={styles.screen} edges={['top', 'bottom']}>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.header}>
        <Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={goBack} style={styles.back}>
          <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={23} tintColor={colors.forest} fallback={<Text style={styles.backText}>‹</Text>} />
        </Pressable>
        {chat && <View style={styles.avatar}><Text style={styles.initials}>{initials(chat.counterpart.displayName)}</Text></View>}
        <View style={styles.flex}><Text style={styles.name} numberOfLines={1}>{chat?.counterpart.displayName ?? 'Trò chuyện'}</Text>
          {chat && <Text style={styles.role}>{chat.role === 'shopper' ? 'Người đăng yêu cầu' : 'Người đi chợ'}</Text>}
        </View>
      </View>
      {state.loading && !chat ? <View style={styles.loading}><ActivityIndicator color={colors.forest} /></View> : !chat ? <View style={styles.loading}>
        <Text style={styles.error} accessibilityRole="alert">{state.error || 'Cuộc trò chuyện chưa khả dụng.'}</Text>
        <Pressable accessibilityRole="button" onPress={() => { void state.refresh(); }} style={styles.retry}><Text style={styles.link}>Thử lại</Text></Pressable>
      </View> : <>
        <View style={styles.order}>
          <View style={styles.orderTop}><Text style={styles.label}>ĐƠN HÀNG</Text><View style={styles.badge}><Text style={styles.badgeText}>{statusLabels[chat.status]}</Text></View></View>
          <Text style={styles.orderTitle} numberOfLines={2}>{chat.title}</Text>
          <Text style={styles.meta}>{chat.itemCount} món{chat.estimatedItemsTotal !== null ? ` · Tổng tiền đã chốt ${money(chat.estimatedItemsTotal + chat.deliveryFee)}` : ''}</Text>
        </View>
        {state.error ? <View style={styles.notice}><Text style={styles.error} accessibilityRole="alert">{state.error}</Text><Pressable accessibilityRole="button" onPress={() => { void state.refresh(); }}><Text style={styles.link}>Thử lại</Text></Pressable></View> : null}
        {messages.length ? <FlatList
          ref={list} style={styles.flex} contentContainerStyle={styles.messages}
          data={messages} inverted keyExtractor={item => item.id} renderItem={renderMessage}
          keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
          ListHeaderComponent={!chat.canSend ? <Text style={styles.event}>Đơn {statusLabels[chat.status].toLowerCase()} · Cuộc trò chuyện chỉ xem lịch sử</Text> : null}
          ListFooterComponent={state.hasOlder ? <Pressable accessibilityRole="button" onPress={() => { void state.loadOlder(); }} disabled={state.loadingOlder} style={styles.loadOlder}>
            {state.loadingOlder ? <ActivityIndicator color={colors.forest} /> : <Text style={styles.link}>Xem tin nhắn trước</Text>}
          </Pressable> : <Text style={styles.event}>Đã nhận yêu cầu lúc {time(chat.acceptedAt)} · {day(chat.acceptedAt)}</Text>}
        /> : <View style={styles.emptyWrap}>
          <Text style={styles.day}>{day(chat.acceptedAt)}</Text>
          <Text style={styles.event}>Đã nhận yêu cầu lúc {time(chat.acceptedAt)}</Text>
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><SymbolView name={{ ios: 'bubble.left.and.bubble.right', android: 'chat_bubble_outline', web: 'chat_bubble_outline' }} size={30} tintColor={colors.forest} fallback={<Text style={styles.name}>…</Text>} /></View>
            <Text style={styles.emptyTitle}>{chat.canSend ? 'Chào nhau một câu nhé.' : 'Chưa có tin nhắn'}</Text>
            <Text style={styles.emptyCopy}>{chat.canSend ? `Bạn có thể trao đổi với ${chat.counterpart.displayName}\nngay cả khi chưa bắt đầu chọn hàng.` : 'Cuộc trò chuyện đã kết thúc.'}</Text>
          </View>
        </View>}
        <View style={styles.composer}>
          {chat.canSend ? <>
            {state.sendError ? <Text style={styles.error} accessibilityRole="alert">{state.sendError}{state.pending ? '\nNhấn gửi lại để xác nhận cùng tin nhắn.' : ''}</Text> : null}
            <View style={styles.inputRow}>
              <TextInput accessibilityLabel="Nội dung tin nhắn" placeholder="Nhập tin nhắn…" placeholderTextColor={colors.muted}
                value={state.draft} onChangeText={state.setDraft} multiline maxLength={4000} editable={!state.pending && !state.sending}
                style={styles.input} textAlignVertical="center" />
              <Pressable accessibilityRole="button" accessibilityLabel={state.pending ? 'Gửi lại tin nhắn' : 'Gửi tin nhắn'}
                accessibilityState={{ disabled: state.sending || !state.draft.trim() }} disabled={state.sending || !state.draft.trim()}
                onPress={send} style={[styles.send, (state.sending || !state.draft.trim()) && styles.disabled]}>
                {state.sending ? <ActivityIndicator color={colors.forest} /> : <SymbolView name={{ ios: 'arrow.up', android: 'arrow_upward', web: 'arrow_upward' }} size={22} tintColor={colors.forest} fallback={<Text style={styles.name}>↑</Text>} />}
              </Pressable>
            </View>
          </> : <View style={styles.locked}>
            <SymbolView name={{ ios: 'lock.fill', android: 'lock', web: 'lock' }} size={20} tintColor={colors.muted} fallback={<Text style={styles.role}>●</Text>} />
            <View style={styles.flex}><Text style={styles.lockedTitle}>Cuộc trò chuyện đã kết thúc</Text><Text style={styles.lockedCopy}>Đơn {statusLabels[chat.status].toLowerCase()}. Bạn có thể xem lại tin nhắn.</Text></View>
          </View>}
        </View>
      </>}
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 16, backgroundColor: colors.background },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.border },
  back: { width: 36, height: 44, alignItems: 'center', justifyContent: 'center' },
  backText: { fontFamily: fontFamilies.body, fontSize: fontSizes.display, color: colors.forest },
  avatar: { width: 43, height: 43, borderRadius: 15, backgroundColor: colors.softPeach, alignItems: 'center', justifyContent: 'center' },
  initials: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, color: colors.forest },
  name: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodyLarge, lineHeight: lineHeights.bodyLarge, color: colors.text },
  role: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.muted, marginTop: 3 },
  order: { marginHorizontal: 16, marginTop: 14, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 13, backgroundColor: colors.surface },
  orderTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 },
  label: { color: colors.muted, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, letterSpacing: letterSpacing.label },
  badge: { backgroundColor: colors.vegetable, borderRadius: 20, paddingHorizontal: 8, paddingVertical: 5, flexShrink: 1 },
  badgeText: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, color: colors.forest },
  orderTitle: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, lineHeight: lineHeights.body, color: colors.text },
  meta: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.muted, marginTop: 5 },
  messages: { padding: 16 }, message: { maxWidth: '88%', alignSelf: 'flex-start', marginBottom: 15 }, mine: { alignSelf: 'flex-end' },
  bubble: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 17, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 12 },
  myBubble: { backgroundColor: colors.forest, borderColor: colors.forest, borderBottomLeftRadius: 17, borderBottomRightRadius: 4 },
  body: { fontFamily: fontFamilies.body, fontSize: fontSizes.body, lineHeight: lineHeights.bodyLarge, color: colors.text }, myBody: { color: colors.surface },
  time: { fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, color: colors.muted, marginTop: 5, marginHorizontal: 3 }, myTime: { textAlign: 'right' },
  day: { textAlign: 'center', color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, marginVertical: 15 },
  event: { textAlign: 'center', color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.bodySmall, marginVertical: 12 },
  emptyWrap: { flex: 1, paddingHorizontal: 24 }, empty: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingBottom: 30 },
  emptyIcon: { width: 68, height: 68, borderRadius: 24, backgroundColor: colors.cream, justifyContent: 'center', alignItems: 'center' },
  emptyTitle: { fontFamily: fontFamilies.display, fontSize: fontSizes.sectionTitle, lineHeight: lineHeights.sectionTitle, marginTop: 19, marginBottom: 10, color: colors.text, textAlign: 'center' },
  emptyCopy: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.body, color: colors.muted, textAlign: 'center' },
  composer: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 12, borderTopWidth: 1, borderColor: colors.border },
  inputRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  input: { flex: 1, minHeight: 44, maxHeight: 120, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 23, paddingHorizontal: 15, paddingVertical: 12, color: colors.text, fontFamily: fontFamilies.body, fontSize: fontSizes.body, lineHeight: lineHeights.body },
  send: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.orange, justifyContent: 'center', alignItems: 'center' }, disabled: { backgroundColor: colors.border, opacity: 0.6 },
  locked: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 4 },
  lockedTitle: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.text },
  lockedCopy: { fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.bodySmall, color: colors.muted, marginTop: 4 },
  error: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.coral, marginBottom: 8 },
  notice: { marginHorizontal: 16, marginTop: 8 }, retry: { padding: 12 },
  link: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest }, loadOlder: { padding: 12, alignItems: 'center' },
});
