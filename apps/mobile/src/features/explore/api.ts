import { apiGet } from '@/lib/api';

export type ExploreRequestItem = {
  id: string;
  name: string;
  quantity: number;
  unit: string;
  estimatedUnitPrice: number | null;
  note: string | null;
  allowSubstitution: boolean;
  sortOrder: number;
};

export type ExploreRequest = {
  id: string;
  customerId: string;
  ownerDisplayName: string;
  ownerAvatarPath: string | null;
  ownerAverageRating: number;
  ownerRatingCount: number;
  title: string;
  description: string | null;
  currency: string;
  estimatedItemsTotal: number | null;
  deliveryFee: number;
  deliverBy: string | null;
  deliveryWard: string | null;
  deliveryDistrict: string | null;
  deliveryCity: string;
  publishedAt: string | null;
  distanceMeters: number | null;
  itemCount: number;
  items: ExploreRequestItem[];
};

export type ListExploreRequestsParams = {
  query?: string;
  latitude?: number;
  longitude?: number;
  limit?: number;
};

export async function listExploreRequests({
  query,
  latitude,
  longitude,
  limit = 20,
}: ListExploreRequestsParams = {}): Promise<ExploreRequest[]> {
  return apiGet<ExploreRequest[]>('/api/v1/explore', {
    query: query?.trim(), latitude, longitude, limit,
  });
}

export function getExploreRequest(
  requestId: string,
  location?: { latitude: number; longitude: number },
) {
  return apiGet<ExploreRequest>(`/api/v1/explore/${requestId}`, location);
}
