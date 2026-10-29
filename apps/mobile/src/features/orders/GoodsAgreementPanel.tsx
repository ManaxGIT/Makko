import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { AddressSheet } from '@/features/addresses/AddressUI';
import { colors } from '@/theme/colors';
import { fontFamilies, fontSizes, letterSpacing, lineHeights } from '@/theme/typography';
import { getGoodsAgreement, proposeGoodsAmount, respondGoodsAmount, type GoodsAmountAgreement, type OrderDetail } from './api';
import { invalidateOrderLists } from './listCache';

// The tracking screen already polls status. This small, account-scoped panel polls
// the money agreement independently so background reads never clear the timeline.
export function GoodsAgreementPanel({ requestId, detail }: { requestId: string; detail: OrderDetail | null }) {
  const { session } = useAuth();
  return <GoodsAgreementContent key={`${session?.user.id}:${requestId}`} owner={session?.user.id} requestId={requestId} detail={detail} />;
}

function GoodsAgreementContent({ requestId, detail, owner }: { requestId: string; detail: OrderDetail | null; owner: string | undefined }) {
  const [agreement, setAgreement] = useState<GoodsAmountAgreement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const generation = useRef(0);
  const scope = useRef('');
  const current = useRef<GoodsAmountAgreement | null>(null);
  const mutating = useRef(false);
  const reload = useRef<() => Promise<void>>(async () => {});

  useFocusEffect(useCallback(() => {
    let active = true;
    let reading = false;
    const mine = ++generation.current;
    const key = `${owner}:${requestId}`;
    if (scope.current !== key) {
      scope.current = key;
      current.current = null;
      setAgreement(null);
      setOpen(false);
      setError(null);
    }
    const load = async () => {
      if (!owner || !active || reading || mutating.current) return;
      reading = true;
      const version = generation.current;
      try {
        const result = await getGoodsAgreement(requestId, owner);
        if (!active || version !== generation.current) return;
        if (current.current && current.current.agreedAmount !== result.agreedAmount) invalidateOrderLists();
        current.current = result;
        setAgreement(result);
        setError(null);
        if (!result.canPropose) setOpen(false);
      } catch (cause) {
        if (active && version === generation.current) setError(cause instanceof Error ? cause.message : 'Chưa tải được thỏa thuận tiền hàng.');
      } finally { reading = false; }
    };
    reload.current = load;
    void load();
    const timer = setInterval(() => { void load(); }, 5_000);
    return () => { active = false; clearInterval(timer); if (generation.current >= mine) generation.current++; };
  }, [owner, requestId]));

  useEffect(() => { void reload.current(); }, [detail]);

  const money = (value: number | null) => value === null ? 'Chưa có thông tin' : new Intl.NumberFormat('vi-VN', {
    style: 'currency', currency: agreement?.currency ?? detail?.currency ?? 'VND', maximumFractionDigits: 2,
  }).format(value);
  const value = agreement ? agreement.agreedAmount : detail?.estimatedItemsTotal ?? null;
  const fee = agreement?.deliveryFee ?? detail?.deliveryFee ?? 0;
  const proposal = agreement?.proposal;
  const pending = proposal?.status === 'pending';
  const eligible = agreement?.status === 'accepted' || agreement?.status === 'shopping';
  const draft = Number(amount);
  const valid = Number.isSafeInteger(draft) && draft > 0 && draft <= 9999999999 && draft !== value;

  const mutate = async (accept?: boolean) => {
    if (!agreement || !owner || mutating.current) return;
    if (accept === undefined && !valid) { setFormError('Nhập tiền hàng lớn hơn 0 và khác tiền hiện tại.'); return; }
    mutating.current = true;
    setBusy(true);
    setFormError(null);
    setError(null);
    const version = ++generation.current;
    try {
      const result = accept === undefined ? await proposeGoodsAmount(requestId, draft, owner)
        : await respondGoodsAmount(requestId, proposal!.id, accept, owner);
      if (version !== generation.current) return;
      current.current = result;
      setAgreement(result);
      setOpen(false);
    } catch (cause) {
      if (version !== generation.current) return;
      const text = cause instanceof Error ? cause.message : 'Chưa xác nhận được kết quả. Vui lòng thử tải lại.';
      if (accept === undefined) setFormError(text); else setError(text);
    } finally {
      mutating.current = false;
      setBusy(false);
      // Reconcile uncertain responses without retrying a financial proposal.
      void reload.current();
    }
  };

  return <View style={s.stack}>
    <View style={s.row}><Text style={s.label}>{detail?.itemCount ?? '—'} món · Tiền hàng</Text><Text style={s.bold}>{money(value)}</Text></View>
    <View style={s.row}><Text style={s.label}>Phí đi chợ</Text><Text style={s.bold}>{money(fee)}</Text></View>
    <View style={[s.row, s.total]}><Text style={s.bold}>Tổng tiền đã chốt</Text><Text style={s.bold}>{money(value === null ? null : value + fee)}</Text></View>
    <Text style={s.hint}>Tổng tiền giữ nguyên khi mua đủ, đúng yêu cầu.</Text>
    {agreement?.canPropose && !error && <Pressable accessibilityRole="button" disabled={busy} style={s.edit} onPress={() => { setAmount(value === null || !Number.isInteger(value) ? '' : String(value)); setFormError(null); setOpen(true); }}><Text style={s.editText}>Đổi tiền hàng đã thỏa thuận</Text></Pressable>}
    {pending && agreement && <View style={s.proposal}>
      <Text style={s.tag}>{agreement.role === 'customer' ? 'CHỜ NGƯỜI ĐI CHỢ XÁC NHẬN' : 'CHỜ BẠN XÁC NHẬN'}</Text>
      <Text style={s.bold}>Đề nghị đổi tiền hàng</Text>
      <View style={s.change}><Text style={s.old}>{money(proposal.oldAmount)}</Text><Text style={s.label}>→</Text><Text style={s.new}>{money(proposal.newAmount)}</Text></View>
      <View style={s.row}><Text style={s.label}>Tổng nếu đồng ý</Text><Text style={s.bold}>{money(proposal.newAmount + fee)}</Text></View>
      <Text style={s.hint}>{agreement.role === 'customer' ? 'Bạn đã xác nhận gửi đề nghị. Tiền mới chỉ áp dụng khi người đi chợ đồng ý.' : 'Người đăng đã xác nhận gửi đề nghị. Đồng ý nghĩa là bạn xác nhận tiền hàng mới cho đơn này.'}</Text>
      {agreement.role === 'shopper' && eligible && <View style={s.actions}>
        <Pressable accessibilityRole="button" disabled={busy || !!error} onPress={() => { void mutate(false); }} style={[s.button, s.secondary, (busy || !!error) && s.disabled]}><Text style={s.buttonText}>Từ chối</Text></Pressable>
        <Pressable accessibilityRole="button" disabled={busy || !!error} onPress={() => { void mutate(true); }} style={[s.button, (busy || !!error) && s.disabled]}><Text style={s.buttonText}>{busy ? 'Đang gửi…' : 'Đồng ý tiền mới'}</Text></Pressable>
      </View>}
    </View>}
    {proposal && !pending && <Text accessibilityLiveRegion="polite" style={s.notice}>{proposal.status === 'accepted' ? '✓ Hai bên đã đồng ý tiền hàng mới. Phí đi chợ giữ nguyên.' : proposal.status === 'rejected' ? 'Đề nghị bị từ chối. Tiền hàng giữ nguyên.' : 'Đề nghị đã hết hiệu lực. Tiền hàng giữ nguyên.'}</Text>}
    {!!error && <View style={s.stack}><Text accessibilityRole="alert" style={s.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => { void reload.current(); }}><Text style={s.editText}>Tải lại thỏa thuận</Text></Pressable></View>}
    <AddressSheet visible={open} title="Đổi tiền hàng" avoidKeyboard onClose={() => { if (!busy) setOpen(false); }} footer={<>
      {!!formError && <Text accessibilityRole="alert" style={s.error}>{formError}</Text>}
      <Pressable accessibilityRole="button" disabled={busy || !agreement?.canPropose} onPress={() => { void mutate(); }} style={[s.button, busy && s.disabled]}><Text style={s.buttonText}>{busy ? 'Đang gửi…' : 'Xác nhận & gửi đề nghị'}</Text></Pressable>
    </>}>
        <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" style={s.formScroll} contentContainerStyle={s.form}>
          <Text style={s.hint}>Có thể đề nghị sau khi nhận đơn, kể cả trong lúc đang mua hàng.</Text>
          <View style={s.row}><Text style={s.label}>Tiền hàng hiện tại</Text><Text style={s.bold}>{money(value)}</Text></View>
          <Text style={s.bold}>Tiền hàng mới ({agreement?.currency ?? 'VND'})</Text>
          <TextInput accessibilityLabel="Tiền hàng mới" value={amount ? Number(amount).toLocaleString('vi-VN') : ''} onChangeText={text => setAmount(text.replace(/\D/g, '').slice(0, 10))} keyboardType="number-pad" editable={!busy} maxLength={13} style={s.input} />
          <View style={s.row}><Text style={s.label}>Phí đi chợ · Giữ nguyên</Text><Text style={s.bold}>{money(fee)}</Text></View>
          <View style={s.row}><Text style={s.bold}>Tổng nếu được đồng ý</Text><Text style={s.bold}>{valid ? money(draft + fee) : '—'}</Text></View>
          <Text style={s.notice}>Bạn xác nhận mức tiền mới khi gửi đề nghị. Tiền hiện tại giữ nguyên cho đến khi người đi chợ đồng ý.</Text>
        </ScrollView>
    </AddressSheet>
  </View>;
}

const s = StyleSheet.create({
  stack: { gap: 10 }, row: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' },
  label: { fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.muted },
  bold: { fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, color: colors.forest },
  hint: { fontFamily: fontFamilies.body, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, color: colors.muted },
  total: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 12 },
  edit: { backgroundColor: colors.cream, padding: 12, borderRadius: 10, alignItems: 'center' },
  editText: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall },
  proposal: { borderWidth: 1, borderColor: colors.orange, borderRadius: 14, padding: 14, gap: 12 },
  tag: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.caption, lineHeight: lineHeights.caption, letterSpacing: letterSpacing.label },
  change: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  old: { color: colors.muted, fontFamily: fontFamilies.body, fontSize: fontSizes.body, textDecorationLine: 'line-through' },
  new: { color: colors.coral, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.sectionTitle, lineHeight: lineHeights.sectionTitle },
  actions: { flexDirection: 'row', gap: 8 },
  button: { backgroundColor: colors.orange, borderRadius: 12, padding: 13, minHeight: 46, alignItems: 'center', justifyContent: 'center', flexGrow: 1 },
  buttonText: { color: colors.forest, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall, textAlign: 'center' },
  secondary: { backgroundColor: colors.surface, borderColor: colors.forest, borderWidth: 1 }, disabled: { opacity: 0.5 },
  notice: { color: colors.forest, backgroundColor: colors.cream, padding: 12, borderRadius: 12, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall },
  formScroll: { flexShrink: 1 },
  form: { padding: 18, gap: 14 },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, color: colors.forest, padding: 14, borderRadius: 12, fontFamily: fontFamilies.bodyBold, fontSize: fontSizes.bodyLarge, lineHeight: lineHeights.bodyLarge },
  error: { color: colors.coral, fontFamily: fontFamilies.body, fontSize: fontSizes.bodySmall, lineHeight: lineHeights.bodySmall },
});
