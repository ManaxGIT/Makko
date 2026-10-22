import type { OrderSummary } from './api';

type Scope = 'active' | 'history';
type Entry = { data?: OrderSummary[]; updatedAt: number; version: number; pending?: Promise<OrderSummary[] | null> };
const entries = new Map<string, Entry>();
export const orderListFreshMs = 30_000;
export function orderListEntry(userId: string, scope: Scope): Entry {
  const key = `${userId}:${scope}`;
  let entry = entries.get(key);
  if (!entry) { entry = { updatedAt: 0, version: 0 }; entries.set(key, entry); }
  return entry;
}
export function clearOrderLists() { entries.clear(); }
export function invalidateOrderLists() {
  for (const entry of entries.values()) { entry.updatedAt = 0; entry.version += 1; entry.pending = undefined; }
}
export function removeCancelledOrder(userId: string, id: string) {
  const active = orderListEntry(userId, 'active');
  const order = active.data?.find(row => row.id === id);
  if (active.data) active.data = active.data.filter(row => row.id !== id);
  active.version += 1; active.pending = undefined;
  const history = orderListEntry(userId, 'history');
  if (order && history.data) history.data = [{ ...order, status: 'cancelled', cancelledAt: null }, ...history.data.filter(row => row.id !== id)];
  history.updatedAt = 0; history.version += 1; history.pending = undefined;
}
export function fetchOrderList(userId: string, scope: Scope, load: () => Promise<OrderSummary[]>) {
  const entry = orderListEntry(userId, scope);
  if (entry.pending) return entry.pending;
  const version = entry.version;
  const pending = load().then(data => {
    if (entry.version !== version || entries.get(`${userId}:${scope}`) !== entry) return null;
    entry.data = data; entry.updatedAt = Date.now();
    return data;
  }).finally(() => { if (entry.pending === pending) entry.pending = undefined; });
  entry.pending = pending;
  return pending;
}
