import { useState, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAuth } from '@/features/auth/AuthProvider';
import { OrderScreenHeader } from '@/features/orders/OrderScreenHeader';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, lineHeights, letterSpacing } from '@/theme/typography';

type Question = {
  id: string;
  title: string;
  icon: ComponentProps<typeof SymbolView>['name'];
  fallback: string;
  paragraphs: string[];
};

const questions: Question[] = [
  {
    id: 'create', title: 'Đăng yêu cầu đi chợ thế nào?',
    icon: { ios: 'plus', android: 'add', web: 'add' }, fallback: '+',
    paragraphs: [
      'Chọn dấu + ở thanh bên dưới. Nhập món cần mua, địa chỉ và thời gian nhận hàng, tiền hàng đã thỏa thuận cùng phí đi chợ.',
      'Kiểm tra thông tin ở bước cuối rồi chọn Xác nhận & đăng yêu cầu.',
    ],
  },
  {
    id: 'receipt', title: 'Khi nào xác nhận đã nhận hàng?',
    icon: { ios: 'checkmark', android: 'check', web: 'check' }, fallback: '✓',
    paragraphs: [
      'Sau khi người đi chợ xác nhận giao hàng, đơn chuyển sang chờ bạn xác nhận nhận hàng.',
      'Khi đã nhận hàng, mở Theo dõi đơn và chọn Xác nhận đã nhận hàng. Đơn chỉ hoàn thành sau xác nhận này.',
      'Bạn có thể đánh giá người đi chợ ngay tại đó, hoặc để sau trong lịch sử đơn hàng.',
    ],
  },
  {
    id: 'history', title: 'Tìm lại đơn đã hoàn thành ở đâu?',
    icon: { ios: 'clock', android: 'history', web: 'history' }, fallback: '◷',
    paragraphs: [
      'Vào Tài khoản → Lịch sử đơn hàng. Chọn Đơn đã đăng hoặc Đơn đã nhận, rồi mở chi tiết đơn cần xem.',
      'Đơn đã hoàn thành và đơn đã hủy nằm trong lịch sử. Tab Đơn hàng dành cho các đơn đang hoạt động.',
    ],
  },
  {
    id: 'addresses', title: 'Thêm hoặc đổi địa chỉ mặc định?',
    icon: { ios: 'house', android: 'home', web: 'home' }, fallback: '⌂',
    paragraphs: [
      'Vào Tài khoản → Địa chỉ của tôi để thêm, sửa hoặc chọn địa chỉ mặc định.',
      'Chọn một địa chỉ khác khi đăng yêu cầu chỉ áp dụng cho yêu cầu đó. Thao tác này không thay đổi địa chỉ mặc định hay địa chỉ đã lưu trên đơn đã đăng.',
    ],
  },
  {
    id: 'reviews', title: 'Đánh giá người cùng đơn như thế nào?',
    icon: { ios: 'star', android: 'star_border', web: 'star_border' }, fallback: '☆',
    paragraphs: [
      'Hai bên có thể đánh giá nhau sau khi đơn hoàn thành. Chọn từ 1 đến 5 sao; nhận xét không bắt buộc.',
      'Trong lịch sử, mở chi tiết đơn để gửi hoặc xem đánh giá của bạn. Đánh giá đã gửi không thể sửa hoặc xóa.',
      'Tài khoản → Đánh giá & uy tín hiển thị các đánh giá bạn đã nhận.',
    ],
  },
  {
    id: 'cancel', title: 'Có thể xóa yêu cầu đã đăng không?',
    icon: { ios: 'xmark', android: 'close', web: 'close' }, fallback: '×',
    paragraphs: [
      'Bạn có thể xóa yêu cầu của mình khi chưa có người nhận. Trong Đơn hàng → Đơn đã đăng, chọn Xóa đơn và xác nhận.',
      'Đơn được chuyển sang đã hủy và vẫn lưu trong lịch sử. Khi đã có người nhận, thao tác xóa này không còn khả dụng.',
    ],
  },
];

export default function HelpRoute() {
  const { session, isLoading } = useAuth();
  if (isLoading) return null;
  if (!session) return <Redirect href="/auth/login" />;
  return <HelpScreen key={session.user.id} />;
}

function HelpScreen() {
  const router = useRouter();
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const toggle = (id: string) => setExpanded(previous => {
    const next = new Set(previous);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
    <OrderScreenHeader title="Trợ giúp" backLabel="Quay lại Tài khoản" onBack={() => router.canGoBack() ? router.back() : router.replace('/(tabs)/profile')} />
    <ScrollView contentContainerStyle={s.content}>
      <View style={s.intro}>
        <Text style={s.eyebrow}>MAKKO LUÔN Ở ĐÂY</Text>
        <Text accessibilityRole="header" style={s.title}>{'Bạn cần tìm hiểu\nđiều gì?'}</Text>
        <Text style={s.description}>Hướng dẫn nhanh để mỗi lần nhờ mua hay đi chợ giúp đều dễ dàng hơn.</Text>
      </View>
      <Text accessibilityRole="header" style={s.sectionTitle}>Câu hỏi thường gặp</Text>
      <View style={s.faq}>
        {questions.map((question, index) => {
          const open = expanded.has(question.id);
          return <View key={question.id} style={index < questions.length - 1 ? s.divider : undefined}>
            <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} accessibilityLabel={question.title} onPress={() => toggle(question.id)} style={({ pressed }) => [s.question, pressed && s.pressed]}>
              <View style={s.icon}><SymbolView name={question.icon} size={18} tintColor={colors.coral} fallback={<Text style={s.iconFallback}>{question.fallback}</Text>} /></View>
              <Text style={s.questionText}>{question.title}</Text>
              <SymbolView name={open ? { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' } : { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }} size={14} tintColor={colors.muted} fallback={<Text style={s.chevron}>{open ? '⌄' : '›'}</Text>} />
            </Pressable>
            {open && <View style={s.answer}>{question.paragraphs.map(paragraph => <Text key={paragraph} style={s.answerText}>{paragraph}</Text>)}</View>}
          </View>;
        })}
      </View>
      <View style={s.tip}><Text style={s.tipTitle}>Cần trao đổi về đơn hàng?</Text><Text style={s.description}>Mở đơn để nhắn tin với người cùng đơn. Chat có từ khi người đi chợ nhận yêu cầu; đơn đã hoàn thành hoặc đã hủy chỉ xem lại được tin nhắn.</Text></View>
    </ScrollView>
  </SafeAreaView>;
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  content: { padding: 20, paddingBottom: 28 },
  intro: { backgroundColor: colors.cream, borderRadius: 18, padding: 20, gap: 10, marginBottom: 24 },
  eyebrow: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, letterSpacing: letterSpacing.eyebrow },
  title: { color: colors.forest, fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle, lineHeight: lineHeights.pageTitle },
  description: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.body },
  sectionTitle: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodyLarge, lineHeight: lineHeights.bodyLarge, marginBottom: 12 },
  faq: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 16, overflow: 'hidden' },
  divider: { borderBottomWidth: 1, borderBottomColor: colors.border },
  question: { flexDirection: 'row', gap: 12, alignItems: 'center', paddingHorizontal: 15, paddingVertical: 17, minHeight: 64 },
  questionText: { flex: 1, color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.body },
  icon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' },
  iconFallback: { color: colors.coral, fontSize: fontSizes.sectionTitle },
  chevron: { color: colors.muted, fontSize: fontSizes.sectionTitle },
  answer: { paddingLeft: 59, paddingRight: 16, paddingBottom: 18, gap: 10 },
  answerText: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.body },
  tip: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.surface, padding: 16, marginTop: 20, gap: 8 },
  tipTitle: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, lineHeight: lineHeights.body },
  pressed: { opacity: 0.65 },
});
