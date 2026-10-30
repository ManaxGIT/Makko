import type { AccountReputation, OrderSummary } from './api';

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
export function clearOrderLists() { entries.clear(); reputationEntries.clear(); profileEntries.clear(); avatarUrls.clear(); weeklyEntries.clear(); }
export function invalidateOrderLists() {
  for (const entry of profileEntries.values()) { entry.updatedAt = 0; entry.version += 1; entry.pending = undefined; }
  for (const entry of reputationEntries.values()) { entry.updatedAt = 0; entry.version += 1; entry.pending = undefined; }
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

// Received reviews are immutable; retain loaded pages when refreshing the first page.
type ReputationEntry = { data?: AccountReputation; updatedAt: number; version: number; pending?: Promise<AccountReputation | null> };
const reputationEntries = new Map<string, ReputationEntry>();
export const reputationFreshMs = 60_000;
export function reputationEntry(userId: string): ReputationEntry {
  let entry = reputationEntries.get(userId);
  if (!entry) { entry = { updatedAt: 0, version: 0 }; reputationEntries.set(userId, entry); }
  return entry;
}
export function fetchReputation(userId: string, load: () => Promise<AccountReputation>) {
  const entry = reputationEntry(userId);
  if (entry.pending) return entry.pending;
  const version = entry.version;
  const pending = load().then(result => {
    if (entry.version !== version || reputationEntries.get(userId) !== entry) return null;
    const firstIds = new Set(result.reviews.map(review => review.id));
    const retained = result.hasMore ? (entry.data?.reviews ?? []).filter(review => !firstIds.has(review.id)) : [];
    entry.data = { ...result, reviews: [...result.reviews, ...retained], hasMore: result.hasMore && result.ratingCount > result.reviews.length + retained.length };
    entry.updatedAt = Date.now();
    return entry.data;
  }).finally(() => { if (entry.pending === pending) entry.pending = undefined; });
  entry.pending = pending;
  return pending;
}
export function appendReputation(userId: string, expected: AccountReputation, page: AccountReputation) {
  const entry = reputationEntry(userId);
  if (entry.data !== expected) return null;
  const ids = new Set(expected.reviews.map(review => review.id));
  entry.data = { ...page, reviews: [...expected.reviews, ...page.reviews.filter(review => !ids.has(review.id))] };
  entry.version += 1;
  return entry.data;
}

type AccountProfile = import('@/features/account/api').AccountProfile;
type ProfileEntry = { data?: AccountProfile; updatedAt: number; version: number; pending?: Promise<AccountProfile | null> };
const profileEntries = new Map<string, ProfileEntry>();
export function accountProfileEntry(userId: string): ProfileEntry {
  let entry = profileEntries.get(userId);
  if (!entry) { entry = { updatedAt: 0, version: 0 }; profileEntries.set(userId, entry); }
  return entry;
}
export function fetchAccountProfile(userId: string, load: () => Promise<AccountProfile>) {
  const entry = accountProfileEntry(userId);
  if (entry.pending) return entry.pending;
  const version = entry.version;
  const pending = load().then(data => {
    if (profileEntries.get(userId) !== entry || version !== entry.version) return null;
    entry.data = data; entry.updatedAt = Date.now(); return data;
  }).finally(() => { if (entry.pending === pending) entry.pending = undefined; });
  entry.pending = pending;
  return pending;
}
export function patchAccountProfile(userId: string, values: import('@/features/account/api').EditableProfile) {
  const entry = profileEntries.get(userId);
  if (!entry) return;
  entry.version += 1; entry.pending = undefined;
  if (entry.data) { entry.data = { ...entry.data, ...values }; entry.updatedAt = Date.now(); }
}
// Signed avatar URLs stay in the same account-scoped cache lifecycle.
const avatarUrls = new Map<string, { url?: string; expiresAt: number; pending?: Promise<string> }>();
export function cachedAvatarUrl(userId: string, path: string, load: () => Promise<string>): Promise<string> {
  const key = `${userId}:${path}`;
  let entry = avatarUrls.get(key);
  if (entry?.url && Date.now() < entry.expiresAt) return Promise.resolve(entry.url);
  if (entry?.pending) return entry.pending;
  entry = { expiresAt: 0 }; avatarUrls.set(key, entry);
  const target = entry;
  const pending = load().then(url => {
    if (avatarUrls.get(key) === target) { target.url = url; target.expiresAt = Date.now() + 240_000; }
    return url;
  }).finally(() => { if (target.pending === pending) target.pending = undefined; });
  target.pending = pending;
  return pending;
}

// Weekly food follows the same account-scoped, versioned cache lifecycle.
type WeeklyEntry = { data?: unknown; updatedAt: number; version: number; pending?: Promise<unknown> };
const weeklyEntries = new Map<string, WeeklyEntry>();
export function weeklyResourceEntry<T>(userId: string, resource: string) {
  const key = `${userId}:${resource}`;
  let entry = weeklyEntries.get(key);
  if (!entry) { entry = { updatedAt: 0, version: 0 }; weeklyEntries.set(key, entry); }
  return entry as { data?: T; updatedAt: number; version: number; pending?: Promise<T | null> };
}
export function fetchWeeklyResource<T>(userId: string, resource: string, load: () => Promise<T>): Promise<T | null> {
  const key = `${userId}:${resource}`, entry = weeklyResourceEntry<T>(userId, resource);
  if (entry.pending) return entry.pending;
  const version = entry.version;
  const pending = load().then(data => {
    if (weeklyEntries.get(key) !== entry || version !== entry.version) return null;
    entry.data = data; entry.updatedAt = Date.now(); return data;
  }).finally(() => { if (entry.pending === pending) entry.pending = undefined; });
  entry.pending = pending; return pending;
}
export function invalidateWeeklyResources(userId: string) {
  for (const [key, entry] of weeklyEntries) if (key.startsWith(`${userId}:`) && key !== `${userId}:weeks`) { entry.updatedAt = 0; entry.version++; entry.pending = undefined; }
}
export function patchWeeklyResourceOrder(userId: string, id: string, status: string) {
  invalidateWeeklyResources(userId);
  for (const [key, entry] of weeklyEntries) {
    if (!key.startsWith(`${userId}:`) || !entry.data) continue;
    const patch = (row: unknown) => row && typeof row === 'object' && 'id' in row && row.id === id && 'status' in row ? { ...row, status } : row;
    if (status === 'registered' && key === `${userId}:detail:${id}`) { weeklyEntries.delete(key); continue; }
    if (Array.isArray(entry.data)) entry.data = key.includes(':available:') || (status === 'registered' && key.endsWith(':orders:shopper')) ? entry.data.filter(row => row.id !== id) : entry.data.map(patch);
    else entry.data = patch(entry.data);
  }
}
