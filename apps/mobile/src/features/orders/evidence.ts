import { invalidateOrderLists } from './listCache';
import { apiGet, apiPost } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { OrderActionResult } from './api';

export type EvidencePhoto = { kind: 'goods' | 'receipt' | 'delivery'; storagePath: string };
export const evidenceBucket = 'purchase-evidence';
export function submitEvidence(id: string, checkedItemIds: string[], photos: EvidencePhoto[], userId: string) {
  return apiPost<OrderActionResult>(`/api/v1/orders/${id}/evidence`, { checkedItemIds, photos }, userId).then(result => { invalidateOrderLists(); return result; });
}
export function submitDeliveryEvidence(id: string, photos: EvidencePhoto[], userId: string) {
  return apiPost<OrderActionResult>(`/api/v1/orders/${id}/delivery-evidence`, { photos }, userId).then(result => { invalidateOrderLists(); return result; });
}
export async function getEvidence(id: string, category: 'all' | 'purchase' | 'delivery' = 'all') {
  const photos = await apiGet<EvidencePhoto[]>(`/api/v1/orders/${id}/evidence`);
  return Promise.all(photos.filter(photo => category === 'all' || (category === 'delivery' ? photo.kind === 'delivery' : photo.kind !== 'delivery')).map(async photo => {
    const { data, error } = await supabase.storage.from(evidenceBucket).createSignedUrl(photo.storagePath, 300);
    if (error) throw error;
    return { ...photo, url: data.signedUrl };
  }));
}
