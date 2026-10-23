import { apiGet, apiPatch } from '@/lib/api';
import { invalidateOrderLists, patchAccountProfile } from '@/features/orders/listCache';

export type EditableProfile = { displayName: string; phone: string | null; bio: string | null; avatarPath: string | null };
export type AccountProfile = EditableProfile & {
  id: string; createdAt: string; averageRating: number; ratingCount: number;
  completedCustomerCount: number; completedShopperCount: number;
};
export function getAccountProfile(userId: string) {
  return apiGet<AccountProfile>('/api/v1/home/profile', undefined, userId);
}
export async function saveAccountProfile(body: EditableProfile, userId: string) {
  const result = await apiPatch<EditableProfile>('/api/v1/home/profile', body, userId);
  invalidateOrderLists();
  patchAccountProfile(userId, result);
  return result;
}
