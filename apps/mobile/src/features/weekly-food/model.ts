import type { FoodOrder, Meals } from './api';
export const mealLabels: Record<Meals, string> = { lunch: 'Chỉ trưa', dinner: 'Chỉ tối', both: 'Trưa và tối' };
const prices = [[249000, 249000, 459000], [449000, 449000, 829000], [649000, 649000, 1199000], [849000, 849000, 1569000]];
export const packagePrice = (people: number, meals: Meals) => prices[people - 1][['lunch', 'dinner', 'both'].indexOf(meals)];
export const money = (n: number) => n.toLocaleString('vi-VN') + 'đ';
export const foodPlan = (o: {
    people: number;
    meals: Meals;
}) => `${o.people} người · ${mealLabels[o.meals].toLocaleLowerCase('vi')}`;
export const day = (s: string | number) => new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(s));
export const cutoff = (o: {
    deliveryDeadline: string;
}) => Date.parse(o.deliveryDeadline) - 7 * 86400000;
export const canCancel = (o: FoodOrder, now = Date.now()) => o.status === 'registered' && now <= cutoff(o);
export const canRelease = (o: FoodOrder, now = Date.now()) => o.status === 'accepted' && !!o.acceptedAt && now >= Date.parse(o.acceptedAt) && now <= Date.parse(o.acceptedAt) + 86400000 && Date.parse(o.deliveryDeadline) - now >= 3 * 86400000;
export function statusLabel(o: FoodOrder, now = Date.now()) {
    return o.status === 'registered' ? now <= cutoff(o) ? 'Đã đăng ký · Còn quyền hủy' : 'Đang tìm người giao' : ({ accepted: 'Đã có người nhận', delivering: 'Đang giao đến bạn', delivered: 'Chờ bạn xác nhận nhận hàng', completed: 'Đã hoàn tất', cancelled: 'Đã hủy' })[o.status];
}
export const submissionId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16); });

/** Published quantities cover one person and one meal/day for seven days. */
export function packageIngredients<T extends { name: string; quantity: string }>(ingredients: T[], people: number, meals: Meals): T[] {
    const factor = people * (meals === 'both' ? 2 : 1);
    const format = new Intl.NumberFormat('vi-VN', { useGrouping: false, maximumFractionDigits: 6 });
    return ingredients.map(ingredient => {
        const quantity = ingredient.quantity.trim();
        if (factor === 1) return { ...ingredient, quantity };
        const match = /^(\d+(?:[.,]\d{1,6})?)\s*([^\d\s]+)$/u.exec(quantity);
        const amount = match ? Number(match[1].replace(',', '.')) * factor : NaN;
        if (!match || !Number.isFinite(amount) || amount <= 0) {
            // Preserve unstructured legacy quantities without inventing amounts.
            return { ...ingredient, quantity: `${quantity} × ${factor} (lượng chuẩn)` };
        }
        let unit = match[2];
        let scaled = amount;
        if (unit.toLowerCase() === 'g' && amount >= 1000) { scaled /= 1000; unit = 'kg'; }
        if (unit.toLowerCase() === 'ml' && amount >= 1000) { scaled /= 1000; unit = 'l'; }
        return { ...ingredient, quantity: `${format.format(scaled)} ${unit}` };
    });
}
