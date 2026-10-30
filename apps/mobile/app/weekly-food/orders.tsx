import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { actFood, getAvailableFood, getFoodOrders, type AvailableFood, type FoodOrder } from '@/features/weekly-food/api';
import { useFoodResource } from '@/features/weekly-food/useFoodResource';
import { FoodButton, FoodError, FoodLoading, FoodScreen, s } from '@/features/weekly-food/FoodUI';
import { AvailableFoodCard } from '@/features/weekly-food/AvailableFoodCard';
import { day, foodPlan, money, statusLabel } from '@/features/weekly-food/model';
export default function FoodOrdersScreen() {
    const router = useRouter(), { session } = useAuth();
    const [mode, setMode] = useState<'customer' | 'shopper' | 'available'>('customer'), [page, setPage] = useState(0), [busyId, setBusyId] = useState(''), [error, setError] = useState('');
    const alive = useRef(true), busy = useRef(false);
    useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
    const list = useFoodResource<(FoodOrder | AvailableFood)[]>(mode === 'available' ? `available:${page}` : `orders:${mode}`, uid => mode === 'available' ? getAvailableFood(uid, page * 25) : getFoodOrders(uid, mode));
    async function accept(id: string) {
        if (!session || busy.current)
            return;
        busy.current = true;
        setBusyId(id);
        setError('');
        try {
            await actFood(id, 'accept', session.user.id);
            if (!alive.current)
                return;
            router.push({ pathname: '/weekly-food/[id]', params: { id } });
        }
        catch (e) {
            if (alive.current) {
                setError(e instanceof Error ? e.message : 'Không nhận được gói.');
                void list.refresh(true);
            }
        }
        finally {
            busy.current = false;
            if (alive.current)
                setBusyId('');
        }
    }
    return <FoodScreen title="Gói nguyên liệu tuần" refreshing={list.fetching && list.data !== undefined} onRefresh={() => void list.refresh(true)}><Text style={s.title}>{mode === 'available' ? 'Giao một gói,\ngửi đủ bữa nhà.' : 'Các gói nguyên liệu\ncủa bạn.'}</Text><View style={s.choices}>{([['customer', 'Đã đăng ký'], ['shopper', 'Đã nhận giao'], ['available', 'Nhận giao']] as const).map(([v, label]) => <Pressable key={v} accessibilityRole="tab" aria-selected={mode === v} accessibilityState={{ selected: mode === v }} onPress={() => { setMode(v); setPage(0); setError(''); }} style={[s.choice, mode === v && s.selected]}><Text style={s.bold}>{label}</Text></Pressable>)}</View>{mode === 'available' && <View style={s.info}><Text style={s.bold}>Tiền công riêng 25.000đ / gói</Text><Text style={s.small}>Ứng toàn bộ tiền gói khi nhận hàng tại Makko, thu lại từ khách khi giao. Tiền công do Makko trả riêng.</Text></View>}<FoodError message={list.error || error} retry={() => void list.refresh(true)}/>{list.data === undefined && list.fetching && <FoodLoading />}{list.data?.length === 0 && <View style={s.card}><Text style={s.sectionTitle}>{mode === 'available' ? 'Chưa có gói mở nhận giao' : 'Chưa có gói nào'}</Text><Text style={s.small}>{mode === 'available' ? 'Các gói được mở sau khi hết hạn khách được hủy đăng ký.' : mode === 'customer' ? 'Chọn gói phù hợp để Makko chuẩn bị bữa cơm cho tuần tới.' : 'Các gói bạn nhận giao sẽ xuất hiện tại đây.'}</Text></View>}{list.data?.map(o => mode === 'available' ? 'wage' in o ? <AvailableFoodCard key={o.id} order={o} disabled={!!busyId} busy={busyId === o.id} onAccept={() => void accept(o.id)}/> : null : <View key={o.id} style={s.card}><Text style={s.badge}>{'status' in o ? statusLabel(o) : 'Gói nguyên liệu Makko'}</Text><Text style={s.sectionTitle}>{foodPlan(o)}</Text><Text style={s.small}>Chậm nhất Chủ nhật, {day(o.deliveryDeadline)}</Text><Text style={s.bold}>{money(o.price)} · {'status' in o ? 'Tiền mặt khi nhận hàng' : 'Tiền ứng tại Makko'}</Text>{<FoodButton secondary onPress={() => router.push({ pathname: '/weekly-food/[id]', params: { id: o.id } })}>Xem gói →</FoodButton>}</View>)}{mode === 'available' && <View style={s.choices}><View style={{ flex: 1 }}><FoodButton secondary disabled={page === 0 || list.fetching} onPress={() => setPage(p => p - 1)}>Trang trước</FoodButton></View><View style={{ flex: 1 }}><FoodButton secondary disabled={!list.data || list.data.length < 25 || list.fetching} onPress={() => setPage(p => p + 1)}>Trang sau</FoodButton></View></View>}<FoodButton secondary onPress={() => router.push('/weekly-food')}>Xem gói & đăng ký mới</FoodButton></FoodScreen>;
}
