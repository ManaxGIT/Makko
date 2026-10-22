import { apiGet, apiPost } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import type { OrderActionResult } from './api';

export type EvidencePhoto = { kind: 'goods' | 'receipt'; storagePath: string };
export const evidenceBucket = 'purchase-evidence';
export function submitEvidence(id: string, checkedItemIds: string[], photos: EvidencePhoto[], userId: string) {
  return apiPost<OrderActionResult>(`/api/v1/orders/${id}/evidence`, { checkedItemIds, photos }, userId);
}
export async function getEvidence(id: string) {
  const photos = await apiGet<EvidencePhoto[]>(`/api/v1/orders/${id}/evidence`);
  return Promise.all(photos.map(async photo => {
    const { data, error } = await supabase.storage.from(evidenceBucket).createSignedUrl(photo.storagePath, 300);
    if (error) throw error;
    return { ...photo, url: data.signedUrl };
  }));
}
