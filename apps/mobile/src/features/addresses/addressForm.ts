import type { Province, SavedAddress, Ward } from './api';

export type OrderAddressSnapshot = Pick<SavedAddress, 'recipientPhone' | 'line1' | 'line2' | 'ward' | 'district' | 'city'>;

export type DeliveryAddress = {
  orderAddress?: OrderAddressSnapshot | null;
  phone: string;
  line1: string;
  province: Province | null;
  ward: Ward | null;
  savedAddress?: SavedAddress | null;
};

export function fromSavedAddress(saved: SavedAddress): DeliveryAddress {
  return {
    phone: saved.recipientPhone,
    line1: saved.line1,
    province: saved.provinceCode ? { code: saved.provinceCode, name: saved.city, fullName: saved.city } : null,
    ward: saved.wardCode && saved.provinceCode ? { code: saved.wardCode, provinceCode: saved.provinceCode, name: saved.ward || '', fullName: saved.ward || '' } : null,
    savedAddress: saved,
  };
}

export function formatDeliveryAddress(address: Partial<DeliveryAddress>) {
  if (address.savedAddress || address.orderAddress) {
    const saved = address.savedAddress ?? address.orderAddress!;
    return [saved.line1, saved.line2, saved.ward, saved.district, saved.city].filter(Boolean).join(', ');
  }
  return [(address.line1 ?? '').trim(), address.ward?.fullName, address.province?.fullName].filter(Boolean).join(', ');
}

export function isDeliveryAddressComplete(address: Partial<DeliveryAddress>) {
  // Existing saved legacy addresses retain their text without guessing current codes.
  if (address.savedAddress || address.orderAddress) return true;
  return !!(address.line1 ?? '').trim() && !!address.province && !!address.ward
    && address.ward.provinceCode === address.province.code
    && /^\+?[0-9][0-9 ()-]{7,19}$/.test((address.phone ?? '').trim())
    && (address.phone ?? '').replace(/\D/g, '').length >= 8
    && (address.phone ?? '').replace(/\D/g, '').length <= 15;
}
