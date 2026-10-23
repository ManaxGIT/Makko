import type { SavedAddress } from './api';

// Same account-keyed/versioned cache pattern as orders/listCache, with subscriptions
// because account management and the request form can be mounted together.
type Snapshot = { data?: SavedAddress[]; fetching: boolean; mutating: boolean; error: string };
type Entry = { snapshot: Snapshot; updatedAt: number; version: number; pending?: Promise<void>; listeners: Set<() => void> };
const entries = new Map<string, Entry>();
export const addressFreshMs = 5 * 60_000;
export function addressEntry(userId: string): Entry {
  let entry = entries.get(userId);
  if (!entry) {
    entry = { snapshot: { fetching: false, mutating: false, error: '' }, updatedAt: 0, version: 0, listeners: new Set() };
    entries.set(userId, entry);
  }
  return entry;
}
function emit(entry: Entry, patch: Partial<Snapshot>) {
  entry.snapshot = { ...entry.snapshot, ...patch };
  entry.listeners.forEach(listener => listener());
}
export function clearAddressLists() {
  for (const entry of entries.values()) { entry.version++; emit(entry, { data: undefined, error: '', fetching: false, mutating: false }); }
  entries.clear();
}
export function fetchAddressList(userId: string, load: () => Promise<SavedAddress[]>, force = false): Promise<void> {
  const entry = addressEntry(userId);
  if (entry.pending) return entry.pending;
  if (entry.snapshot.mutating || (!force && entry.snapshot.data && Date.now() - entry.updatedAt < addressFreshMs)) return Promise.resolve();
  const version = entry.version;
  emit(entry, { fetching: true, error: '' });
  const pending = load().then(data => {
    if (entries.get(userId) !== entry || version !== entry.version) return;
    entry.updatedAt = Date.now(); emit(entry, { data, error: '' });
  }).catch(error => {
    if (entries.get(userId) === entry && version === entry.version) emit(entry, { error: error instanceof Error ? error.message : 'Không tải được địa chỉ. Vui lòng thử lại.' });
  }).finally(() => {
    if (entry.pending === pending) { entry.pending = undefined; emit(entry, { fetching: false }); }
  });
  entry.pending = pending;
  return pending;
}
export async function mutateAddressList<T>(userId: string, write: () => Promise<T>, apply: (result: T, data: SavedAddress[] | undefined) => SavedAddress[] | undefined, complete = true): Promise<T> {
  const entry = addressEntry(userId);
  if (entry.snapshot.mutating) throw new Error('Đang lưu địa chỉ, vui lòng chờ.');
  ++entry.version; entry.pending = undefined;
  emit(entry, { mutating: true, fetching: false, error: '' });
  try {
    const result = await write();
    if (entries.get(userId) !== entry) throw new Error('Tài khoản đã thay đổi. Vui lòng thử lại.');
    entry.updatedAt = complete ? Date.now() : 0;
    emit(entry, { data: apply(result, entry.snapshot.data) });
    return result;
  } catch (error) {
    // An uncertain write must be reconciled on the next read, not blindly retried.
    entry.updatedAt = 0;
    throw error;
  } finally {
    if (entries.get(userId) === entry) emit(entry, { mutating: false });
  }
}
