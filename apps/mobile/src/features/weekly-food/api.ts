import { apiGet, apiPost } from '@/lib/api';
import { invalidateWeeklyResources, patchWeeklyResourceOrder } from '@/features/orders/listCache';
export type Meals = 'lunch' | 'dinner' | 'both';
export type WeeklyStatus = 'registered' | 'accepted' | 'delivering' | 'delivered' | 'completed' | 'cancelled';
export type MenuIngredient = { name: string; quantity: string };
export type FoodWeek = {
    id: string;
    weekStart: string;
    deliveryDeadline: string;
    ingredients: MenuIngredient[];
    publishedAt: string | null;
};
export type FoodOrder = {
    id: string;
    customerId: string;
    weekId: string;
    people: number;
    meals: Meals;
    price: number;
    status: WeeklyStatus;
    deliveryDeadline: string;
    recipientName: string;
    recipientPhone: string;
    deliveryAddress: string;
    shopperId: string | null;
    acceptedAt: string | null;
    handoverAt: string | null;
    deliveredAt: string | null;
    completedAt: string | null;
    cancelledAt: string | null;
    wagePaidAt: string | null;
    createdAt: string;
};
export type FoodDetail = FoodOrder & {
    week: FoodWeek | null;
};
export type AvailableFood = Pick<FoodOrder, 'id' | 'people' | 'meals' | 'price' | 'deliveryDeadline' | 'createdAt'> & {
    wage: number;
};
export const getWeeks = (userId: string) => apiGet<FoodWeek[]>('/api/v1/weekly-food/weeks', undefined, userId);
export const getFoodDetail = (id: string, userId: string) => apiGet<FoodDetail>(`/api/v1/weekly-food/orders/${encodeURIComponent(id)}`, undefined, userId);
export async function getFoodOrders(userId: string, role: 'customer' | 'shopper') {
    const rows: FoodOrder[] = [];
    for (let offset = 0;; offset += 100) {
        const page = await apiGet<FoodOrder[]>('/api/v1/weekly-food/orders', { role, limit: 100, offset }, userId);
        rows.push(...page);
        if (page.length < 100)
            return rows;
    }
}
export function getAvailableFood(userId: string, offset = 0) { return apiGet<AvailableFood[]>('/api/v1/weekly-food/available', { limit: 25, offset }, userId); }
export async function registerFood(body: {
    weekId: string;
    addressId: string;
    people: number;
    meals: Meals;
    submissionKey: string;
}, userId: string) {
    const result = await apiPost<{
        id: string;
    }>('/api/v1/weekly-food/orders', body, userId);
    invalidateWeeklyResources(userId);
    return result;
}
export async function actFood(id: string, action: 'cancel' | 'accept' | 'release' | 'deliver' | 'receive', userId: string, photoPaths: string[] = []) {
    const result = await apiPost<{
        id: string;
        status: WeeklyStatus;
    }>(`/api/v1/weekly-food/orders/${encodeURIComponent(id)}/${action}`, { photoPaths }, userId);
    patchWeeklyResourceOrder(userId, id, result.status);
    return result;
}
