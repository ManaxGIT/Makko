import type { OrderSummary } from './api';
import type { FoodOrder } from '@/features/weekly-food/api';
export type OrderFeedItem = { type: 'errand'; role: 'customer' | 'shopper'; order: OrderSummary } | { type: 'weekly'; role: 'customer' | 'shopper'; order: FoodOrder };
export function buildOrderFeed(errands: OrderSummary[], customerPackages: FoodOrder[], shopperPackages: FoodOrder[], history: boolean): OrderFeedItem[] {
    const inScope = (status: string) => ['completed','cancelled'].includes(status) === history;
    const rows: OrderFeedItem[] = [
        ...errands.filter(o => inScope(o.status)).map(order => ({ type: 'errand' as const, role: order.role, order })),
        ...customerPackages.filter(o => inScope(o.status)).map(order => ({ type: 'weekly' as const, role: 'customer' as const, order })),
        ...shopperPackages.filter(o => inScope(o.status)).map(order => ({ type: 'weekly' as const, role: 'shopper' as const, order })),
    ];
    const time = (row: OrderFeedItem) => row.role === 'customer' ? row.order.createdAt : (row.type === 'weekly' ? row.order.acceptedAt : row.order.assignmentAcceptedAt) ?? row.order.createdAt;
    return rows.sort((a,b) => time(b).localeCompare(time(a)));
}
