import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';
import { useCreateRequest } from '@/features/create-request/CreateRequestProvider';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, letterSpacing, lineHeights } from '@/theme/typography';
import { MealPlate } from './MealPlate';
import { MealPreferences, MealSuggestion, suggestMeals } from './api';

const styleIdeas = ['Nhiều nước', 'Món khô', 'Món Việt', 'Món Tây', 'Món Thái', 'Món Hàn', 'Thử món mới'];
const meals = ['Bữa sáng', 'Bữa trưa', 'Bữa tối', 'Bữa phụ', 'Khác'];
const money = (n: number) => `${n.toLocaleString('vi-VN')}đ`;

export function TodayMealScreen({ userId }: { userId: string }) {
  const router = useRouter();
  const { form, startFromMeal, requestLocked, publishedRequest } = useCreateRequest();
  const [stage, setStage] = useState<'preferences' | 'suggestions'>('preferences');
  const [meal, setMeal] = useState('Bữa tối');
  const [customMeal, setCustomMeal] = useState('');
  const [people, setPeople] = useState(2);
  const [budget, setBudget] = useState('100000');
  const [avoid, setAvoid] = useState('');
  const [pantry, setPantry] = useState('');
  const [mealStyle, setMealStyle] = useState('');
  const [suggestions, setSuggestions] = useState<MealSuggestion[]>([]);
  const [selected, setSelected] = useState(0);
  const [submitted, setSubmitted] = useState<MealPreferences | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const mounted = useRef(true);
  const lock = useRef(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  async function generate() {
    if (lock.current) return;
    const preferences = { meal: meal === 'Khác' ? customMeal.trim() : meal, people, budget: Number(budget), avoid: avoid.trim(), pantry: pantry.trim(), style: mealStyle.trim() };
    if (!preferences.meal) { setError('Nhập tên bữa ăn bạn muốn nấu.'); return; }
    if (!Number.isInteger(preferences.budget) || preferences.budget < 1000 || preferences.budget > 100_000_000) { setError('Nhập ngân sách từ 1.000đ đến 100.000.000đ.'); return; }
    lock.current = true; setBusy(true); setError('');
    try {
      const result = await suggestMeals(preferences, userId);
      if (!mounted.current) return;
      setSuggestions(result.suggestions); setSelected(0); setSubmitted(preferences); setStage('suggestions');
    } catch (e) {
      if (mounted.current) setError(e instanceof Error ? e.message : 'Không tạo được gợi ý. Vui lòng thử lại.');
    } finally { lock.current = false; if (mounted.current) setBusy(false); }
  }
  function continueToRequest() {
    const suggestion = suggestions[selected];
    if (!suggestion || busy) return;
    if (requestLocked && !publishedRequest) { setError('Bạn có yêu cầu đang chờ xác nhận kết quả đăng. Hãy xử lý yêu cầu đó trước.'); return; }
    const apply = () => {
      if (!mounted.current) return;
      try { startFromMeal(suggestion); router.push('/create/items'); }
      catch (e) { setError(e instanceof Error ? e.message : 'Không chuyển được nguyên liệu.'); }
    };
    if (form.items.length && !publishedRequest) Alert.alert('Thay danh sách đang soạn?', 'Nguyên liệu của bữa đã chọn sẽ thay danh sách và tiền hàng đang soạn. Địa chỉ nhận vẫn được giữ.', [{ text: 'Giữ danh sách', style: 'cancel' }, { text: 'Dùng bữa đã chọn', onPress: apply }]);
    else apply();
  }
  return <SafeAreaView style={s.safe} edges={['top', 'bottom']}><KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Quay lại" onPress={() => stage === 'suggestions' ? setStage('preferences') : router.back()} style={s.back}><SymbolView name={{ ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' }} tintColor={colors.forest} size={18} /></Pressable><Text style={s.headerTitle}>Hôm nay ăn gì?</Text><Text style={s.small}>{stage === 'preferences' ? '1 / 2' : '2 / 2'}</Text></View>
    <View style={s.progress}><View style={[s.segment, s.activeSegment]} /><View style={[s.segment, stage === 'suggestions' && s.activeSegment]} /></View>
    <ScrollView style={s.flex} keyboardShouldPersistTaps="handled" contentContainerStyle={s.content}>
      {stage === 'preferences' ? <>
        <Text style={s.eyebrow}>BẮT ĐẦU TỪ BẠN</Text><Text style={s.heading}>Một bữa ngon,{`\n`}vừa đúng ý.</Text><Text style={s.lead}>Kể Makko nghe một chút để tìm món phù hợp với hôm nay nhé.</Text>
        <Text style={s.label}>Bạn muốn nấu bữa nào?</Text><View style={s.choices}>{meals.map(value => <Pressable key={value} accessibilityRole="radio" accessibilityState={{ selected: meal === value }} onPress={() => setMeal(value)} style={[s.choice, meal === value && s.selectedChoice]}><Text style={s.body}>{value}</Text></Pressable>)}</View>
        {meal === 'Khác' && <View style={s.field}><Text style={s.label}>Tên bữa ăn của bạn</Text><TextInput accessibilityLabel="Tên bữa ăn của bạn" value={customMeal} onChangeText={setCustomMeal} maxLength={60} placeholder="Ví dụ: bữa xế, ăn khuya, tiệc nhỏ…" placeholderTextColor={colors.mutedLight} style={s.input} /></View>}
        <View style={s.peopleRow}><Text style={s.label}>Có mấy người ăn?</Text><View style={s.stepper}><Pressable accessibilityRole="button" accessibilityLabel="Giảm số người" disabled={people <= 1} onPress={() => setPeople(n => n - 1)} style={s.countButton}><Text style={s.countSymbol}>−</Text></Pressable><Text style={s.bold}>{people}</Text><Pressable accessibilityRole="button" accessibilityLabel="Tăng số người" disabled={people >= 20} onPress={() => setPeople(n => n + 1)} style={s.countButton}><Text style={s.countSymbol}>+</Text></Pressable></View></View>
        <View style={s.field}><Text style={s.label}>Ngân sách tiền hàng (đ)</Text><TextInput accessibilityLabel="Ngân sách tiền hàng" value={budget ? Number(budget).toLocaleString('vi-VN') : ''} onChangeText={v => setBudget(v.replace(/\D/g, '').slice(0, 9))} keyboardType="number-pad" style={s.input} /><Text style={s.hint}>Chưa gồm phí đi chợ.</Text></View>
        <View style={s.field}><Text style={s.label}>Hôm nay bạn muốn ăn kiểu gì?</Text><TextInput accessibilityLabel="Hôm nay bạn muốn ăn kiểu gì?" value={mealStyle} onChangeText={setMealStyle} maxLength={1000} multiline placeholder="Ví dụ: món nhiều nước như bánh canh; vị Thái, hơi cay; muốn thử món lạ…" placeholderTextColor={colors.mutedLight} style={[s.input, s.multiline]} /><Text style={s.hint}>Không bắt buộc. Kết hợp loại món, phong cách và mức độ đổi vị theo ý bạn.</Text><View style={s.styleIdeas}>{styleIdeas.map(idea => <Pressable key={idea} accessibilityRole="button" accessibilityLabel={`Thêm phong cách ${idea}`} onPress={() => setMealStyle(current => { const parts = current.split(';').map(part => part.trim()).filter(Boolean); return parts.some(part => part.toLocaleLowerCase('vi') === idea.toLocaleLowerCase('vi')) ? current : [...parts, idea].join('; ').slice(0, 1000); })} style={s.styleChip}><Text style={s.body}>＋ {idea}</Text></Pressable>)}</View></View>
        <View style={s.field}><Text style={s.label}>Có gì bạn không ăn?</Text><TextInput accessibilityLabel="Có gì bạn không ăn?" value={avoid} onChangeText={setAvoid} maxLength={1000} multiline placeholder="Ví dụ: không ăn tôm, không thích cay…" placeholderTextColor={colors.mutedLight} style={[s.input, s.multiline]} /></View>
        <View style={s.field}><Text style={s.label}>Trong bếp đã có gì?</Text><TextInput accessibilityLabel="Trong bếp đã có gì?" value={pantry} onChangeText={setPantry} maxLength={1000} multiline placeholder="Ví dụ: gạo, dầu ăn, gia vị cơ bản…" placeholderTextColor={colors.mutedLight} style={[s.input, s.multiline]} /></View>
      </> : <>
        <Text style={s.eyebrow}>✧ GỢI Ý CHO BẠN</Text><Text style={s.heading}>Một vài gợi ý{`\n`}cho bữa hôm nay.</Text><Text style={s.lead}>{submitted?.meal} · {submitted?.people} người · Trong {money(submitted?.budget ?? 0)}</Text>
        {suggestions.map((item, index) => <View key={`${index}-${item.title}`} style={[s.meal, selected === index && s.selectedMeal]}><View style={[s.visual, index % 2 === 1 && s.alternateVisual]}><MealPlate /></View><View style={s.mealBody}><Text style={s.mealTitle}>{item.title}</Text><Text style={s.description}>{item.description}</Text><View style={s.mealBottom}><View style={s.flex}><Text style={s.small}>{item.cookingMinutes} phút</Text><Text style={s.bold}>~ {money(item.suggestedGoodsAmount)}</Text></View><Pressable accessibilityRole="radio" accessibilityLabel={`Chọn ${item.title}`} accessibilityState={{ selected: selected === index }} onPress={() => setSelected(index)} style={[s.selectButton, selected === index && s.selectedChoice]}><Text style={s.bold}>{selected === index ? '✓ Đã chọn' : 'Chọn bữa này'}</Text></Pressable></View></View></View>)}
        {!!submitted?.style && <Text style={s.hint}>Phong cách: {submitted.style}</Text>}
        <View style={s.inlineActions}><Pressable accessibilityRole="button" disabled={busy} onPress={() => void generate()} style={s.textButton}><Text style={s.link}>↻ Gợi ý khác</Text></Pressable><Pressable accessibilityRole="button" onPress={() => setStage('preferences')} style={s.textButton}><Text style={s.link}>Sửa nhu cầu</Text></Pressable></View>
        <View style={s.notice}><Text style={s.small}>Giá chỉ là ước lượng tham khảo. Bạn có thể kiểm tra, thêm bớt nguyên liệu và quyết định tiền hàng trong luồng Tạo yêu cầu.</Text></View>
      </>}
      {busy && <View style={s.loading}><ActivityIndicator color={colors.coral} /><Text style={s.small}>Đang tìm ý tưởng cho bữa ăn của bạn…</Text></View>}
      {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
    </ScrollView>
    <View style={s.footer}><Pressable accessibilityRole="button" disabled={busy} accessibilityState={{ disabled: busy, busy }} onPress={() => stage === 'preferences' ? void generate() : continueToRequest()} style={[s.primary, busy && s.disabled]}><Text style={s.primaryLabel}>{busy ? 'Đang gợi ý…' : stage === 'preferences' ? '✧ Gợi ý món ăn' : 'Tiếp tục tạo yêu cầu →'}</Text></Pressable><Text style={[s.hint, s.center]}>{stage === 'preferences' ? 'Bạn luôn có thể chỉnh lại trước khi đăng.' : 'Nguyên liệu được điền sẵn. Chưa đăng yêu cầu.'}</Text></View>
  </KeyboardAvoidingView></SafeAreaView>;
}
const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background }, flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 10 },
  back: { width: 36, height: 36, borderRadius: 11, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, color: colors.forest },
  small: { fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, color: colors.muted },
  progress: { marginHorizontal: 20, marginTop: 5, flexDirection: 'row', gap: 5 }, segment: { height: 3, borderRadius: 4, backgroundColor: colors.border, flex: 1 }, activeSegment: { backgroundColor: colors.orange },
  content: { padding: 20, paddingTop: 24, paddingBottom: 24 },
  eyebrow: { fontFamily: fontFamilies.bodyExtraBold, fontSize: fontSizes.caption, letterSpacing: letterSpacing.eyebrow, color: colors.coral },
  heading: { fontFamily: fontFamilies.display, fontSize: fontSizes.pageTitle, lineHeight: lineHeights.pageTitle, color: colors.forest, marginTop: 8, marginBottom: 10 },
  lead: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.body, color: colors.muted, marginBottom: 23 },
  body: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest },
  bold: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest },
  label: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest, marginBottom: 9 },
  field: { marginTop: 20 }, input: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 12, padding: 13, minHeight: 46, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest }, multiline: { minHeight: 70, textAlignVertical: 'top' },
  hint: { fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, color: colors.muted, marginTop: 7 }, center: { textAlign: 'center' },
  styleIdeas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }, styleChip: { paddingHorizontal: 12, paddingVertical: 12, borderRadius: 20, backgroundColor: colors.cream },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, choice: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 30, paddingHorizontal: 15, paddingVertical: 12 }, selectedChoice: { borderColor: colors.orange, backgroundColor: colors.cream },
  peopleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 22 }, stepper: { flexDirection: 'row', alignItems: 'center', gap: 16 }, countButton: { width: 36, height: 36, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: 10, alignItems: 'center', justifyContent: 'center' }, countSymbol: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.sectionTitle, color: colors.forest },
  footer: { borderTopWidth: 1, borderColor: colors.border, paddingHorizontal: 20, paddingTop: 14, paddingBottom: 10 }, primary: { borderRadius: 13, backgroundColor: colors.orange, alignItems: 'center', padding: 15, minHeight: 50 }, primaryLabel: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.action, color: colors.forest }, disabled: { opacity: 0.6 },
  meal: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 18, overflow: 'hidden', marginBottom: 14 }, selectedMeal: { borderColor: colors.orange }, visual: { height: 130, backgroundColor: colors.border, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, alternateVisual: { backgroundColor: colors.vegetable }, mealBody: { padding: 14 }, mealTitle: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.body, lineHeight: lineHeights.body, color: colors.forest }, description: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.muted, marginTop: 6, marginBottom: 12 }, mealBottom: { flexDirection: 'row', alignItems: 'center', gap: 8 }, selectButton: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.cream, borderRadius: 10, padding: 11 }, inlineActions: { flexDirection: 'row', justifyContent: 'space-between' }, textButton: { minHeight: 44, justifyContent: 'center' }, link: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, color: colors.coral }, notice: { backgroundColor: colors.activityBanner, padding: 12, borderRadius: 12, marginTop: 10 }, loading: { paddingVertical: 15, flexDirection: 'row', alignItems: 'center', gap: 10 }, error: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.coral, marginTop: 15 },
});
