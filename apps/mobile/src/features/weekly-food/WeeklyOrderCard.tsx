import { Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { colors } from '@/theme/colors';
import type { FoodOrder } from './api';
import { FoodButton, s } from './FoodUI';
import { day, foodPlan, money, statusLabel } from './model';
export function WeeklyOrderCard({ order, role }: { order: FoodOrder; role: 'customer' | 'shopper' }) {
    const router = useRouter();
    return <View style={[s.card, { borderColor: colors.orange }]}><Text style={s.badge}>Gói nguyên liệu</Text><Text style={s.small}>{statusLabel(order)}</Text><Text style={s.sectionTitle}>{foodPlan(order)}</Text><Text style={s.small}>Giao chậm nhất Chủ nhật, {day(order.deliveryDeadline)}</Text><Text style={s.bold}>{role === 'customer' ? 'Giá gói' : 'Tiền ứng tại Makko'} · {money(order.price)}</Text>{role === 'shopper' && <Text style={s.small}>Tiền công riêng từ Makko: 25.000đ</Text>}<FoodButton secondary onPress={() => router.push({ pathname: '/weekly-food/[id]', params: { id: order.id } })}>Xem gói →</FoodButton></View>;
}
