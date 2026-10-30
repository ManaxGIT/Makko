const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function cache() {
  const source = readFileSync(join(__dirname, '../src/features/orders/listCache.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const context = { exports: {}, Date, Map, Promise };
  vm.runInNewContext(outputText, context);
  return context.exports;
}
function deferred() {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
}

test('deduplicates simultaneous reads and retains a successful empty list', async () => {
  const c = cache(), request = deferred();
  let calls = 0;
  const load = () => { calls++; return request.promise; };
  const first = c.fetchOrderList('alice', 'active', load);
  const second = c.fetchOrderList('alice', 'active', load);
  assert.equal(calls, 1);
  request.resolve([]);
  await Promise.all([first, second]);
  assert.equal(c.orderListEntry('alice', 'active').data.length, 0);
  assert.ok(c.orderListEntry('alice', 'active').updatedAt > 0);
});

test('deletion updates active and history caches without loading', async () => {
  const c = cache(), order = { id: 'one', status: 'open' };
  await c.fetchOrderList('alice', 'active', async () => [order]);
  await c.fetchOrderList('alice', 'history', async () => []);
  c.removeCancelledOrder('alice', 'one');
  assert.equal(c.orderListEntry('alice', 'active').data.length, 0);
  assert.equal(c.orderListEntry('alice', 'history').data[0].status, 'cancelled');
  assert.equal(c.orderListEntry('alice', 'history').updatedAt, 0);
  assert.equal(c.orderListEntry('bob', 'active').data, undefined);
});

test('late response cannot resurrect a deleted order', async () => {
  const c = cache(), request = deferred();
  await c.fetchOrderList('alice', 'active', async () => [{ id: 'one', status: 'open' }]);
  const read = c.fetchOrderList('alice', 'active', () => request.promise);
  c.removeCancelledOrder('alice', 'one');
  request.resolve([{ id: 'one', status: 'open' }]);
  assert.equal(await read, null);
  assert.equal(c.orderListEntry('alice', 'active').data.length, 0);
});

test('mutations invalidate freshness without erasing visible data', async () => {
  const c = cache(), data = [{ id: 'one' }];
  await c.fetchOrderList('alice', 'active', async () => data);
  c.invalidateOrderLists();
  assert.equal(c.orderListEntry('alice', 'active').data, data);
  assert.equal(c.orderListEntry('alice', 'active').updatedAt, 0);
});

test('sign-out clears cached data and ignores in-flight responses', async () => {
  const c = cache(), request = deferred();
  const read = c.fetchOrderList('alice', 'active', () => request.promise);
  c.clearOrderLists();
  request.resolve([{ id: 'private' }]);
  assert.equal(await read, null);
  assert.equal(c.orderListEntry('alice', 'active').data, undefined);
});

test('a failed background read keeps the previous list and permits retry', async () => {
  const c = cache(), data = [{ id: 'one' }];
  await c.fetchOrderList('alice', 'active', async () => data);
  await assert.rejects(c.fetchOrderList('alice', 'active', async () => { throw Error('offline'); }));
  assert.equal(c.orderListEntry('alice', 'active').data, data);
  const updated = [{ id: 'two' }];
  assert.equal(await c.fetchOrderList('alice', 'active', async () => updated), updated);
});

test('reputation deduplicates reads and caches an empty result per account', async () => {
  const c = cache(), request = deferred();
  let calls = 0;
  const load = () => { calls++; return request.promise; };
  const a = c.fetchReputation('alice', load), b = c.fetchReputation('alice', load);
  request.resolve({ averageRating: 0, ratingCount: 0, reviews: [], hasMore: false });
  await Promise.all([a, b]);
  assert.equal(calls, 1);
  assert.equal(c.reputationEntry('alice').data.reviews.length, 0);
  assert.ok(c.reputationEntry('alice').updatedAt > 0);
  assert.equal(c.reputationEntry('bob').data, undefined);
});

test('reputation retains pages during refresh and invalidation, rejects obsolete page writes', async () => {
  const c = cache();
  await c.fetchReputation('alice', async () => ({ averageRating: 5, ratingCount: 3, reviews: [{ id: 'a' }], hasMore: true }));
  const first = c.reputationEntry('alice').data;
  c.appendReputation('alice', first, { averageRating: 5, ratingCount: 3, reviews: [{ id: 'b' }], hasMore: true });
  assert.equal(c.reputationEntry('alice').data.reviews.length, 2);
  assert.equal(c.appendReputation('alice', first, { reviews: [{ id: 'obsolete' }] }), null);
  await c.fetchReputation('alice', async () => ({ averageRating: 5, ratingCount: 4, reviews: [{ id: 'new' }, { id: 'a' }], hasMore: true }));
  assert.equal(c.reputationEntry('alice').data.reviews.length, 3);
  assert.equal(c.reputationEntry('alice').data.reviews[0].id, 'new');
  c.invalidateOrderLists();
  assert.equal(c.reputationEntry('alice').updatedAt, 0);
  assert.equal(c.reputationEntry('alice').data.reviews.length, 3);
});

test('clearing reputation rejects in-flight responses and refresh errors keep visible content', async () => {
  const c = cache(), request = deferred();
  await c.fetchReputation('alice', async () => ({ ratingCount: 1, reviews: [{ id: 'a' }], hasMore: false }));
  await assert.rejects(c.fetchReputation('alice', async () => { throw Error('offline'); }));
  assert.equal(c.reputationEntry('alice').data.reviews.length, 1);
  const read = c.fetchReputation('alice', () => request.promise);
  c.clearOrderLists();
  request.resolve({ ratingCount: 1, reviews: [{ id: 'private' }], hasMore: false });
  assert.equal(await read, null);
  assert.equal(c.reputationEntry('alice').data, undefined);
});

test('profile saves patch known fields and reject an older read without changing statistics', async () => {
  const c = cache(), pending = deferred();
  await c.fetchAccountProfile('alice', async () => ({ displayName: 'Old', avatarPath: null, ratingCount: 3 }));
  const read = c.fetchAccountProfile('alice', () => pending.promise);
  c.patchAccountProfile('alice', { displayName: 'New', avatarPath: 'alice/photo.jpg', phone: null, bio: null });
  pending.resolve({ displayName: 'Old', ratingCount: 3 });
  assert.equal(await read, null);
  assert.equal(c.accountProfileEntry('alice').data.displayName, 'New');
  assert.equal(c.accountProfileEntry('alice').data.ratingCount, 3);
  assert.equal(c.accountProfileEntry('bob').data, undefined);
});

test('cleared profile caches cannot be restored by reads or a late save', async () => {
  const c = cache(), pending = deferred();
  const read = c.fetchAccountProfile('alice', () => pending.promise);
  c.clearOrderLists();
  c.patchAccountProfile('alice', { displayName: 'Private' });
  pending.resolve({ displayName: 'Private' });
  assert.equal(await read, null);
  assert.equal(c.accountProfileEntry('alice').data, undefined);
});

test('weekly resources deduplicate empty reads and isolate accounts', async () => {
  const c=cache(), request=deferred();let reads=0;
  const load=()=>{reads++;return request.promise};
  const first=c.fetchWeeklyResource('alice','orders:customer',load);
  const second=c.fetchWeeklyResource('alice','orders:customer',load);
  request.resolve([]);await Promise.all([first,second]);
  assert.equal(reads,1);
  assert.equal(c.weeklyResourceEntry('alice','orders:customer').data.length,0);
  assert.equal(c.weeklyResourceEntry('bob','orders:customer').data,undefined);
});

test('confirmed weekly mutation patches lists, rejects late reads and preserves server timestamps', async () => {
  const c=cache(), request=deferred();
  await c.fetchWeeklyResource('alice','detail:one',async()=>({id:'one',status:'accepted',handoverAt:null}));
  const reading=c.fetchWeeklyResource('alice','detail:one',()=>request.promise);
  c.patchWeeklyResourceOrder('alice','one','delivering');
  request.resolve({id:'one',status:'accepted',handoverAt:null});
  assert.equal(await reading,null);
  const entry=c.weeklyResourceEntry('alice','detail:one');
  assert.equal(entry.data.status,'delivering');assert.equal(entry.data.handoverAt,null);
  assert.equal(entry.updatedAt,0);
});

test('weekly release evicts recipient detail and assigned list and never reoffers the order', async () => {
  const c=cache();
  for(const key of ['orders:shopper','available:0'])await c.fetchWeeklyResource('alice',key,async()=>[{id:'one',status:'accepted'}]);
  await c.fetchWeeklyResource('alice','detail:one',async()=>({id:'one',status:'accepted',deliveryAddress:'private'}));
  c.patchWeeklyResourceOrder('alice','one','registered');
  assert.equal(c.weeklyResourceEntry('alice','detail:one').data,undefined);
  assert.equal(c.weeklyResourceEntry('alice','orders:shopper').data.length,0);
  assert.equal(c.weeklyResourceEntry('alice','available:0').data.length,0);
});

test('weekly refresh failure keeps content and logout prevents in-flight data restoring it', async () => {
  const c=cache(), request=deferred();
  await c.fetchWeeklyResource('alice','weeks',async()=>[{id:'week'}]);
  await assert.rejects(c.fetchWeeklyResource('alice','weeks',async()=>{throw Error('offline')}));
  assert.equal(c.weeklyResourceEntry('alice','weeks').data[0].id,'week');
  const read=c.fetchWeeklyResource('alice','weeks',()=>request.promise);
  c.clearOrderLists();request.resolve([{id:'private'}]);assert.equal(await read,null);
  assert.equal(c.weeklyResourceEntry('alice','weeks').data,undefined);
});
