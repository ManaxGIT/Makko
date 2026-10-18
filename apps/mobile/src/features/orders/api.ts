import { apiGet, apiPatch, apiPost } from '@/lib/api';
import type { ExploreRequest } from '@/features/explore/api';

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

export type OrderTracking = {
  id: string;
  role: 'customer' | 'shopper';
  status: OrderStatus;
  deliverBy: string | null;
  counterpart: OrderSummary['counterpart'];
  assignmentAcceptedAt: string | null;
  statusHistory: Array<{
    id: number;
    toStatus: OrderStatus;
    createdAt: string;
  }>;
};

export type OrderDetail = ExploreRequest & {
  role: 'customer' | 'shopper';
  status: OrderStatus;
};

export async function listMyOrders(limit = 50): Promise<OrderSummary[]> {
  return apiGet<OrderSummary[]>('/api/v1/orders', { limit });
}

export function getOrderTracking(requestId: string) {
  return apiGet<OrderTracking>(`/api/v1/orders/${requestId}/tracking`);
}

export function getOrderDetail(
  requestId: string,
  location?: { latitude: number; longitude: number },
) {
  return apiGet<OrderDetail>(`/api/v1/orders/${requestId}/details`, location);
}

export function acceptOrder(requestId: string) {
  return apiPost<OrderActionResult>(`/api/v1/orders/${requestId}/accept`);
}

export function releaseOrder(requestId: string) {
  return apiPost<OrderActionResult>(`/api/v1/orders/${requestId}/release`);
}

export function publishOrder(requestId: string) {
  return apiPost<OrderActionResult>(`/api/v1/orders/${requestId}/publish`);
}

export function transitionOrder(requestId: string, status: OrderStatus) {
  return apiPatch<OrderActionResult>(`/api/v1/orders/${requestId}/status`, { status });
}
