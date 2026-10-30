import { useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/features/auth/AuthProvider';
import { AddressSheet } from '@/features/addresses/AddressUI';
import { actFood, type AvailableFood } from './api';
import { FoodButton, FoodError, FoodRow, s } from './FoodUI';
import { day, foodPlan, money, packageIngredients } from './model';

export function AvailableFoodPreview({ order, onClose, onAccepted, onConflict }: {
    order: AvailableFood; onClose: () => void; onAccepted: (id: string) => void; onConflict: () => void;
}) {
    const router = useRouter(), { session } = useAuth();
    const [busy, setBusy] = useState(false), [error, setError] = useState('');
    const active = useRef(true), writing = useRef(false);
    useEffect(() => { active.current = true; return () => { active.current = false; }; }, []);
    const ingredients = order.week?.ingredients;
    async function confirm() {
        if (!session || writing.current || !ingredients?.length) return;
        writing.current = true; setBusy(true); setError('');
        try {
            await actFood(order.id, 'accept', session.user.id);
            if (!active.current) return;
            onAccepted(order.id);
            router.push({ pathname: '/weekly-food/[id]', params: { id: order.id } });
        } catch (failure) {
            if (active.current) { setError(failure instanceof Error ? failure.message : 'Không nhận được gói.'); onConflict(); }
        } finally { writing.current = false; if (active.current) setBusy(false); }
    }
    return <AddressSheet visible title="Chi tiết gói nguyên liệu" onClose={() => { if (!busy) onClose(); }} footer={<><FoodError message={error}/><FoodButton disabled={busy || !ingredients?.length} onPress={() => void confirm()}>{busy ? 'Đang xác nhận…' : `Xác nhận nhận giao · ${money(order.wage)}`}</FoodButton></>}>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }}>
            <Text style={s.badge}>{foodPlan(order)} · 7 ngày</Text>
            <View style={s.card}><FoodRow label="Khu vực giao" value="Đà Nẵng"/><FoodRow label="Giao chậm nhất" value={`Chủ nhật, ${day(order.deliveryDeadline)}`}/><FoodRow label="Ứng tại Makko" value={money(order.price)}/><FoodRow label="Thu lại từ khách" value={money(order.price)}/><FoodRow label="Tiền công riêng" value={money(order.wage)}/></View>
            <View style={s.card}><Text style={s.sectionTitle}>Nguyên liệu trong gói</Text><Text style={s.small}>Định lượng theo số người và bữa đã chọn.</Text>{ingredients ? packageIngredients(ingredients, order.people, order.meals).map((ingredient,i) => <FoodRow key={i} label={ingredient.name} value={ingredient.quantity}/>) : <Text style={s.small}>Chưa tải được nguyên liệu. Đóng và làm mới danh sách để xem đầy đủ trước khi nhận giao.</Text>}</View>
            <Text style={s.small}>Nhận nguyên liệu tại điểm Makko, Đà Nẵng. Địa chỉ điểm nhận đang chờ thiết lập. Địa chỉ chi tiết và liên hệ khách hiển thị sau khi nhận giao.</Text>
            <View style={s.info}><Text style={s.small}>Chỉ nhận đơn sau khi bạn bấm xác nhận. Sau khi nhận, bạn ứng tiền gói tại Makko, thu lại từ khách khi giao; Makko trả tiền công riêng.</Text></View>
        </ScrollView>
    </AddressSheet>;
}
