import { ScrollView, Text, View } from 'react-native';
import { AddressSheet } from '@/features/addresses/AddressUI';
import type { FoodWeek, Meals } from './api';
import { day, mealLabels, packageIngredients } from './model';
import { FoodRow, s } from './FoodUI';
export function MenuSheet({ week, people, meals, onClose }: {
    week: FoodWeek;
    people: number;
    meals: Meals;
    onClose: () => void;
}) {
    return <AddressSheet visible title="Nguyên liệu trong gói" onClose={onClose}><ScrollView contentContainerStyle={{ padding: 20, gap: 18 }}><Text style={s.eyebrow}>TUẦN BẮT ĐẦU {day(week.weekStart + 'T00:00:00+07:00')}</Text><Text style={s.small}>{people} người · {mealLabels[meals]} · Đủ 7 ngày</Text><View style={s.card}>{packageIngredients(week.ingredients, people, meals).map((ingredient, i) => <FoodRow key={i} label={ingredient.name} value={ingredient.quantity}/>)}</View><Text style={s.small}>Nếu thay nguyên liệu, Makko sẽ thông báo. Phần thay thế có giá trị tương đương, giá gói giữ nguyên.</Text></ScrollView></AddressSheet>;
}
