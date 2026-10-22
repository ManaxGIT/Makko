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
