import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { RefreshControl, ScrollView, Text, View } from 'react-native';
import { getAvailableFood, type AvailableFood } from '@/features/weekly-food/api';
import { useFoodResource } from '@/features/weekly-food/useFoodResource';
import { AvailableFoodPreview } from '@/features/weekly-food/AvailableFoodPreview';
import { AvailableFoodCard } from '@/features/weekly-food/AvailableFoodCard';
import { FoodButton, FoodError, FoodLoading, s } from '@/features/weekly-food/FoodUI';
import { colors } from '@/theme/colors';

export function ExploreWeeklyFood({ hidden, header }: { hidden: boolean; header: ReactNode }) {
    const [page, setPage] = useState(0), [selected, setSelected] = useState<AvailableFood | null>(null), [refreshing, setRefreshing] = useState(false);
    const active = useRef(true);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    const list = useFoodResource<AvailableFood[]>(`available:${page}`, uid => getAvailableFood(uid, page * 25));
    return <ScrollView style={{ display: hidden ? 'none' : 'flex' }} accessibilityElementsHidden={hidden} importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'} contentContainerStyle={{ paddingBottom: 28 }} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} refreshControl={<RefreshControl tintColor={colors.forest} refreshing={refreshing} onRefresh={() => { setRefreshing(true); void list.refresh(true).finally(() => { if (active.current) setRefreshing(false); }); }}/>}>
        {header}
        <View style={{ paddingHorizontal: 20, gap: 12 }}>
            <Text style={s.sectionTitle}>Gói nguyên liệu Makko</Text>
            <Text style={s.small}>Đà Nẵng · Các gói đã qua hạn khách được hủy đăng ký.</Text>
            <FoodError message={list.error} retry={() => void list.refresh(true)}/>
            {list.data === undefined && list.fetching && <FoodLoading />}
            {list.data?.length === 0 && <View style={s.card}><Text style={s.bold}>Chưa có gói mở nhận giao</Text><Text style={s.small}>Gói sẽ xuất hiện sau hạn khách được hủy đăng ký.</Text></View>}
            {list.data?.map(order => <AvailableFoodCard key={order.id} order={order} onOpen={() => setSelected(order)}/>)}
            {(page > 0 || (list.data?.length ?? 0) >= 25) && <View style={s.choices}><View style={{ flex: 1 }}><FoodButton secondary disabled={page === 0 || list.fetching} onPress={() => setPage(p => p - 1)}>Trang trước</FoodButton></View><View style={{ flex: 1 }}><FoodButton secondary disabled={!list.data || list.data.length < 25 || list.fetching} onPress={() => setPage(p => p + 1)}>Trang sau</FoodButton></View></View>}
            {selected && <AvailableFoodPreview key={selected.id} order={selected} onClose={() => setSelected(null)} onAccepted={id => { list.setData(rows => rows?.filter(row => row.id !== id)); setSelected(null); }} onConflict={() => void list.refresh(true)}/>}
        </View>
    </ScrollView>;
}
