import { invalidateOrderLists } from './listCache';
import { apiGet, apiPatch, apiPost } from '@/lib/api';
import type { ExploreRequest } from '@/features/explore/api';

export type OrderStatus =
  | 'draft' | 'open' | 'accepted' | 'shopping'
  | 'delivering' | 'delivered' | 'completed' | 'cancelled' | 'disputed';

export type OrderSummary = {
  hasRecipe: boolean;
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
  hasRecipe: boolean;
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
  deliveryLine1: string | null;
  paymentMethod: string | null;
  role: 'customer' | 'shopper';
  status: OrderStatus;
};

export async function listMyOrders(limit = 50, scope: 'all' | 'active' | 'history' = 'all'): Promise<OrderSummary[]> {
  return apiGet<OrderSummary[]>('/api/v1/orders', { limit, scope });
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
  return apiPost<OrderActionResult>(`/api/v1/orders/${requestId}/accept`).then(result => { invalidateOrderLists(); return result; });
}

export function releaseOrder(requestId: string) {
  return apiPost<OrderActionResult>(`/api/v1/orders/${requestId}/release`).then(result => { invalidateOrderLists(); return result; });
}

export function publishOrder(requestId: string) {
  return apiPost<OrderActionResult>(`/api/v1/orders/${requestId}/publish`).then(result => { invalidateOrderLists(); return result; });
}

export function transitionOrder(requestId: string, status: OrderStatus) {
  return apiPatch<OrderActionResult>(`/api/v1/orders/${requestId}/status`, { status }).then(result => { if (status !== 'cancelled') invalidateOrderLists(); return result; });
}

export type OrderReview = { id: string; rating: number; comment: string | null; createdAt: string };
export type OrderReviewContext = {
  requestId: string; title: string; role: 'customer' | 'shopper';
  counterpart: NonNullable<OrderSummary['counterpart']>;
  canReview: boolean; review: OrderReview | null;
};
export function getOrderReview(id: string) {
  return apiGet<OrderReviewContext>(`/api/v1/orders/${id}/review`);
}
export function submitOrderReview(id: string, rating: number, comment: string) {
  return apiPost<OrderReview>(`/api/v1/orders/${id}/review`, { rating, comment: comment.trim() || null })
    .then(result => { invalidateOrderLists(); return result; });
}

export type ReceivedReview = OrderReview & {
  requestId: string; requestTitle: string; reviewerName: string;
  reviewerRole: 'customer' | 'shopper';
};
export type AccountReputation = {
  averageRating: number; ratingCount: number; reviews: ReceivedReview[]; hasMore: boolean;
};
export function getReceivedReviews(offset = 0, limit = 20) {
  return apiGet<AccountReputation>('/api/v1/home/profile/reviews', { offset, limit });
}

export type GoodsAmountAgreement = {
  requestId: string;
  role: 'customer' | 'shopper';
  status: OrderStatus;
  currency: string;
  agreedAmount: number | null;
  deliveryFee: number;
  canPropose: boolean;
  proposal: {
    id: string; oldAmount: number | null; newAmount: number;
    status: 'pending' | 'accepted' | 'rejected' | 'expired';
    createdAt: string; respondedAt: string | null;
  } | null;
};
export function getGoodsAgreement(id: string, ownerId: string) {
  return apiGet<GoodsAmountAgreement>(`/api/v1/orders/${id}/goods-agreement`, undefined, ownerId);
}
export function proposeGoodsAmount(id: string, amount: number, ownerId: string) {
  return apiPost<GoodsAmountAgreement>(`/api/v1/orders/${id}/goods-agreement`, { amount }, ownerId)
    .then(result => { invalidateOrderLists(); return result; });
}
export function respondGoodsAmount(id: string, proposalId: string, accept: boolean, ownerId: string) {
  return apiPost<GoodsAmountAgreement>(`/api/v1/orders/${id}/goods-agreement/${proposalId}/response`, { accept }, ownerId)
    .then(result => { invalidateOrderLists(); return result; });
}
