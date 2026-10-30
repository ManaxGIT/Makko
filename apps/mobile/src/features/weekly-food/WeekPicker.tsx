import { Pressable, Text, View } from 'react-native';
import type { FoodWeek } from './api';
import { s } from './FoodUI';
import { cutoff, day, weekRange } from './model';
export function WeekPicker({ weeks, selectedId, onSelect, onViewIngredients }: {
    weeks: FoodWeek[];
    selectedId?: string;
    onSelect: (id: string) => void;
    onViewIngredients: (id: string) => void;
}) {
    return <View style={s.gap}>
        <Text style={s.label}>Chọn tuần sử dụng</Text>
        <Text style={s.small}>Xem nguyên liệu và hạn đăng ký của từng tuần.</Text>
        <View style={s.gap}>{weeks.map(week => {
            const selected = selectedId === week.id;
            return <View key={week.id} style={[s.card, selected && s.selected]}>
                <Pressable accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => onSelect(week.id)} style={s.gap}>
                    <Text style={s.bold}>{weekRange(week.weekStart)}</Text>
                    <Text style={s.small}>Giao chậm nhất Chủ nhật, {day(week.deliveryDeadline)}</Text>
                    <Text style={s.small}>Hạn đăng ký: {day(cutoff(week))}</Text>
                    <Text style={s.eyebrow}>Đang mở đăng ký</Text>
                </Pressable>
                <Pressable accessibilityRole="button" accessibilityLabel={`Xem nguyên liệu tuần ${weekRange(week.weekStart)}`} onPress={() => onViewIngredients(week.id)}>
                    <Text style={s.link}>Xem nguyên liệu trong gói →</Text>
                </Pressable>
            </View>;
        })}</View>
    </View>;
}
