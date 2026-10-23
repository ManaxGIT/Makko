import { useCallback, useSyncExternalStore } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { addressEntry, fetchAddressList, mutateAddressList } from './listCache';
import { CreateAddressBody, deleteAddress, getAddresses, SavedAddress, saveAddress, setDefaultAddress, updateAddress } from './api';

export function useAddresses() {
  const { session } = useAuth();
  const userId = session?.user.id ?? 'signed-out';
  const entry = addressEntry(userId);
  const subscribe = useCallback((listener: () => void) => { entry.listeners.add(listener); return () => { entry.listeners.delete(listener); }; }, [entry]);
  const snapshot = useSyncExternalStore(subscribe, () => entry.snapshot, () => entry.snapshot);
  const refresh = useCallback((force = false) => session ? fetchAddressList(userId, () => getAddresses(userId), force) : Promise.resolve(), [userId, !!session]);
  const replace = (rows: SavedAddress[]) => rows;
  return {
    ...snapshot, refresh,
    create: (body: CreateAddressBody) => mutateAddressList(userId, () => saveAddress(body, userId), (saved, data) => data ? [saved, ...data.filter(a => a.id !== saved.id).map(a => saved.isDefault && a.isDefault ? { ...a, isDefault: false } : a)].sort((a, b) => Number(b.isDefault) - Number(a.isDefault) || b.createdAt.localeCompare(a.createdAt) || a.id.localeCompare(b.id)) : undefined, false),
    update: (id: string, body: CreateAddressBody) => mutateAddressList(userId, () => updateAddress(id, body, userId), replace),
    setDefault: (id: string) => mutateAddressList(userId, () => setDefaultAddress(id, userId), replace),
    remove: (id: string, replacement: string | null) => mutateAddressList(userId, () => deleteAddress(id, replacement, userId), replace),
  };
}
