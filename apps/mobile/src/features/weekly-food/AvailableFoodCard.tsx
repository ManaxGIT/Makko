import { Text, View } from 'react-native';
import { colors } from '@/theme/colors';
import type { AvailableFood } from './api';
import { FoodButton, s } from './FoodUI';
import { day, foodPlan, money } from './model';

export function AvailableFoodCard({ order, disabled, busy, onAccept }: {
    order: AvailableFood;
    disabled: boolean;
    busy: boolean;
    onAccept: () => void;
}) {
    return <View style={[s.card, { borderColor: colors.orange }]}>
        <Text style={s.badge}>Gói nguyên liệu</Text>
        <Text style={s.sectionTitle}>{foodPlan(order)}</Text>
        <Text style={s.small}>Nhận nguyên liệu tại điểm Makko · Đà Nẵng</Text>
        <Text style={s.small}>Giao chậm nhất Chủ nhật, {day(order.deliveryDeadline)}</Text>
        <Text style={s.bold}>Ứng tại Makko: {money(order.price)}</Text>
        <Text style={s.small}>Thu lại tiền gói từ khách khi giao. Tiền công do Makko trả riêng.</Text>
        <FoodButton disabled={disabled} onPress={onAccept}>{busy ? 'Đang nhận…' : `Nhận giao · ${money(order.wage)}`}</FoodButton>
    </View>;
}
