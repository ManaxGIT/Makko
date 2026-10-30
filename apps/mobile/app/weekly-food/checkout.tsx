import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { useAddresses } from '@/features/addresses/useAddresses';
import { AddressPicker } from '@/features/addresses/AddressPicker';
import type { SavedAddress } from '@/features/addresses/api';
import { useFoodDraft } from '@/features/weekly-food/DraftProvider';
import { getWeeks, registerFood } from '@/features/weekly-food/api';
import { useFoodResource } from '@/features/weekly-food/useFoodResource';
import { FoodButton, FoodError, FoodLoading, FoodRow, FoodScreen, s } from '@/features/weekly-food/FoodUI';
import { cutoff, day, foodPlan, money, packagePrice, weekRange } from '@/features/weekly-food/model';
function inDaNang(a: SavedAddress) { return a.provinceCode === '48' || ['đà nẵng', 'thành phố đà nẵng'].includes(a.city.trim().toLocaleLowerCase('vi')); }
export default function FoodCheckoutScreen() {
    const { weekId } = useLocalSearchParams<{ weekId: string }>();
    return <FoodCheckout key={weekId} weekId={weekId} />;
}
function FoodCheckout({ weekId }: { weekId: string }) {
    const router = useRouter(), { session } = useAuth();
    const draft = useFoodDraft(), addresses = useAddresses(), weeks = useFoodResource('weeks', getWeeks, 5 * 60000);
    const [selectedId, setSelectedId] = useState<string>(), [picker, setPicker] = useState(false), [busy, setBusy] = useState(false), [error, setError] = useState('');
    const initialized = useRef(false), mounted = useRef(true), submitting = useRef(false);
    useEffect(() => { mounted.current = true; void addresses.refresh(); return () => { mounted.current = false; }; }, [addresses.refresh]);
    useEffect(() => { if (!initialized.current && addresses.data !== undefined) {
        initialized.current = true;
        setSelectedId(addresses.data.find(a => a.isDefault)?.id ?? addresses.data[0]?.id);
    } }, [addresses.data]);
    const week = weeks.data?.find(w => w.id === weekId), selected = addresses.data?.find(a => a.id === selectedId);
    const eligible = !!week && cutoff(week) >= Date.now();
    async function book() {
        if (!session || !week || !selected || submitting.current)
            return;
        if (!inDaNang(selected)) {
            setError('Gói nguyên liệu hiện chỉ giao tại Đà Nẵng. Chọn địa chỉ khác để tiếp tục.');
            return;
        }
        if (!eligible) {
            setError('Đã qua hạn đăng ký tuần này. Vui lòng quay lại chọn gói tuần tiếp theo.');
            return;
        }
        submitting.current = true;
        setBusy(true);
        setError('');
        const body = { weekId: week.id, addressId: selected.id, people: draft.people, meals: draft.meals, submissionKey: draft.getSubmissionKey(`${week.id}:${selected.id}:${draft.people}:${draft.meals}`) };
        try {
            const result = await registerFood(body, session.user.id);
            if (!mounted.current)
                return;
            draft.reset();
            router.replace({ pathname: '/weekly-food/[id]', params: { id: result.id } });
        }
        catch (failure) {
            if (mounted.current)
                setError(failure instanceof Error ? failure.message : 'Chưa xác nhận được đăng ký. Thử lại với cùng lựa chọn để kiểm tra kết quả.');
        }
        finally {
            submitting.current = false;
            if (mounted.current)
                setBusy(false);
        }
    }
    return <FoodScreen title="Đăng ký gói" footer={<FoodButton disabled={busy || !eligible || !selected || !inDaNang(selected)} onPress={() => void book()}>{busy ? 'Đang đăng ký…' : `Xác nhận đăng ký · ${money(packagePrice(draft.people, draft.meals))}`}</FoodButton>}><Text style={s.eyebrow}>MỘT LẦN GIAO · ĐỦ BẢY NGÀY</Text><Text style={s.title}>Sẵn nguyên liệu{`\n`}cho tuần kế tiếp.</Text><View style={s.card}><FoodRow label="Gói của bạn" value={foodPlan(draft)}/><FoodRow label="Kỳ hạn" value="1 tuần · 1 lần giao"/>{week && <FoodRow label="Tuần sử dụng" value={weekRange(week.weekStart)}/>}</View>{weeks.fetching && !weeks.data && <FoodLoading />}<FoodError message={weeks.error} retry={() => void weeks.refresh(true)}/>{week ? <View style={s.card}><Text style={s.label}>Thời gian giao hàng</Text><Text style={s.sectionTitle}>Chậm nhất Chủ nhật, {day(week.deliveryDeadline)}</Text><Text style={s.small}>Nguyên liệu cho tuần bắt đầu {day(week.weekStart + 'T00:00:00+07:00')}.</Text></View> : weeks.data !== undefined && <Text style={s.error}>Tuần này chưa mở đăng ký. Quay lại để xem tuần đang mở.</Text>}<View><Text style={s.label}>Giao đến · Đà Nẵng</Text><View style={s.card}>{selected ? <><Text style={s.bold}>{selected.label} · {selected.recipientName}</Text><Text style={s.small}>{selected.recipientPhone}</Text><Text style={s.body}>{[selected.line1, selected.line2, selected.ward, selected.district, selected.city].filter(Boolean).join(', ')}</Text>{!inDaNang(selected) && <Text style={s.error}>Chọn địa chỉ tại Đà Nẵng để đăng ký gói.</Text>}</> : <Text style={s.small}>{selectedId ? 'Địa chỉ đã chọn không còn tồn tại. Vui lòng chọn lại.' : 'Chưa có địa chỉ nhận hàng.'}</Text>}<Pressable accessibilityRole="button" disabled={busy} onPress={() => setPicker(true)}><Text style={s.link}>{selected ? 'Thay đổi địa chỉ →' : 'Chọn hoặc thêm địa chỉ →'}</Text></Pressable></View>{addresses.fetching && addresses.data === undefined && <FoodLoading />}<FoodError message={addresses.error} retry={() => void addresses.refresh(true)}/></View><View style={s.card}><FoodRow label="Phương thức" value="Tiền mặt khi nhận hàng"/><FoodRow label="Phí giao hàng" value="Đã bao gồm"/><FoodRow label="Tổng thanh toán" value={money(packagePrice(draft.people, draft.meals))}/></View>{week && <View style={s.info}><Text style={s.small}>Được hủy đến {day(cutoff(week))}. Sau mốc này, gói được chuyển sang chuẩn bị giao. Muốn thay đổi, hãy hủy và đăng ký lại trong hạn.</Text></View>}<Text style={s.small}>Không tự gia hạn. Mỗi lần đăng ký là một gói riêng.</Text><FoodError message={error}/>{picker && <AddressPicker currentId={selectedId} onClose={() => setPicker(false)} onSelect={a => { if (!inDaNang(a))
        throw new Error('Chọn địa chỉ tại Đà Nẵng cho gói nguyên liệu.'); initialized.current = true; setSelectedId(a.id); setError(''); }}/>}</FoodScreen>;
}
