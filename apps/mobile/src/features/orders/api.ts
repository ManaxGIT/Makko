import { apiGet, apiPatch, apiPost } from '@/lib/api';

export type OrderStatus =
  | 'draft' | 'open' | 'accepted' | 'shopping'
  | 'delivering' | 'completed' | 'cancelled' | 'disputed';

export type OrderSummary = {
  id: string;
  role: 'customer' | 'shopper';
  title: string;
  status: OrderStatus;
  currency: string;
  estimatedItemsTotal: number | null;
  deliveryFee: number;
  actualItemsTotal: number | null;
  deliverBy: string | null;
  publishedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  itemCount: number;
  counterpart: {
    id: string;
    displayName: string;
    avatarPath: string | null;
    averageRating: number;
    ratingCount: number;
  } | null;
  assignmentAcceptedAt: string | null;
};

export type OrderActionResult = { requestId: string; status: OrderStatus };

export async function listMyOrders(limit = 50): Promise<OrderSummary[]> {
  return apiGet<OrderSummary[]>('/api/v1/orders', { limit });
}

export function acceptOrder(requestId: string) {
  return apiPost<OrderActionResult>(`/api/v1/orders/${requestId}/accept`);
}

export function publishOrder(requestId: string) {
  return apiPost<OrderActionResult>(`/api/v1/orders/${requestId}/publish`);
}

export function transitionOrder(requestId: string, status: OrderStatus) {
  return apiPatch<OrderActionResult>(`/api/v1/orders/${requestId}/status`, { status });
}
