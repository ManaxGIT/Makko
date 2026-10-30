import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { actFood, getAvailableFood, type AvailableFood } from '@/features/weekly-food/api';
import { useFoodResource } from '@/features/weekly-food/useFoodResource';
import { AvailableFoodCard } from '@/features/weekly-food/AvailableFoodCard';
import { FoodButton, FoodError, FoodLoading, s } from '@/features/weekly-food/FoodUI';
import { colors } from '@/theme/colors';

export function ExploreWeeklyFood({ hidden, header }: { hidden: boolean; header: ReactNode }) {
    const { session } = useAuth(), router = useRouter();
    const [page, setPage] = useState(0), [busyId, setBusyId] = useState(''), [error, setError] = useState(''), [refreshing, setRefreshing] = useState(false);
    const active = useRef(true), writing = useRef(false);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    const list = useFoodResource<AvailableFood[]>(`available:${page}`, uid => getAvailableFood(uid, page * 25));
    async function accept(id: string) {
        if (!session || writing.current) return;
        writing.current = true; setBusyId(id); setError('');
        try {
            await actFood(id, 'accept', session.user.id);
            if (!active.current) return;
            list.setData(rows => rows?.filter(row => row.id !== id));
            router.push({ pathname: '/weekly-food/[id]', params: { id } });
        } catch (failure) {
            if (!active.current) return;
            setError(failure instanceof Error ? failure.message : 'Không nhận được gói.');
            void list.refresh(true);
        } finally { writing.current = false; if (active.current) setBusyId(''); }
    }
    return <ScrollView style={{ display: hidden ? 'none' : 'flex' }} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'} contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl tintColor={colors.forest} refreshing={refreshing} onRefresh={() => { setRefreshing(true); setError(''); void list.refresh(true).finally(() => { if (active.current) setRefreshing(false); }); }}/>}>
        {header}
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
            <Text style={s.sectionTitle}>Gói nguyên liệu Makko</Text>
            <Text style={s.small}>Đà Nẵng · Các gói đã qua hạn khách được hủy đăng ký.</Text>
            <FoodError message={list.error || error} retry={() => { setError(''); void list.refresh(true); }}/>
            {list.data === undefined && list.fetching && <FoodLoading />}
            {list.data?.length === 0 && <View style={s.card}><Text style={s.bold}>Chưa có gói mở nhận giao</Text><Text style={s.small}>Gói sẽ xuất hiện sau hạn khách được hủy đăng ký.</Text></View>}
            {list.data?.map(order => <AvailableFoodCard key={order.id} order={order} disabled={!!busyId} busy={busyId === order.id} onAccept={() => void accept(order.id)}/>)}
            {(page > 0 || (list.data?.length ?? 0) >= 25) && <View style={s.choices}><View style={{ flex: 1 }}><FoodButton secondary disabled={page === 0 || list.fetching || !!busyId} onPress={() => setPage(p => p - 1)}>Trang trước</FoodButton></View><View style={{ flex: 1 }}><FoodButton secondary disabled={!list.data || list.data.length < 25 || list.fetching || !!busyId} onPress={() => setPage(p => p + 1)}>Trang sau</FoodButton></View></View>}
        </View>
    </ScrollView>;
}
