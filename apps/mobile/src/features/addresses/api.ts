import { apiGet, apiPost } from '@/lib/api';

export type Province = { code: string; name: string; fullName: string };
export type Ward = Province & { provinceCode: string };

export function getProvinces() {
  return apiGet<Province[]>('/api/v1/locations/provinces');
}

export function getWards(provinceCode: string) {
  return apiGet<Ward[]>(`/api/v1/locations/provinces/${encodeURIComponent(provinceCode)}/wards`);
}


export type SavedAddress = {
  id: string;
  label: string;
  recipientName: string;
  recipientPhone: string;
  line1: string;
  line2: string | null;
  provinceCode: string | null;
  wardCode: string | null;
  city: string;
  district: string | null;
  ward: string | null;
  latitude: number | null;
  longitude: number | null;
  deliveryNote: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CreateAddressBody = {
  label: string;
  recipientName: string;
  recipientPhone: string;
  line1: string;
  line2?: string | null;
  provinceCode: string;
  wardCode: string;
  latitude?: number | null;
  longitude?: number | null;
  deliveryNote?: string | null;
  isDefault: boolean;
};

// The API orders the default first, then the most recently saved address.
export async function getPreferredAddress(): Promise<SavedAddress | null> {
  const addresses = await apiGet<SavedAddress[]>('/api/v1/addresses', { limit: 1 });
  return addresses[0] ?? null;
}

export function saveAddress(body: CreateAddressBody, expectedUserId: string) {
  return apiPost<SavedAddress>('/api/v1/addresses', body, expectedUserId);
}
