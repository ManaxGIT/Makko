const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
function cache() {
  const source = readFileSync(join(__dirname, '../src/features/addresses/listCache.ts'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
  const context = { exports: {}, Date, Map, Set, Promise, Error };
  vm.runInNewContext(outputText, context); return context.exports;
}
function deferred() { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; }
test('address reads deduplicate and cache empty results while fresh', async () => {
  const c = cache(), request = deferred(); let calls = 0;
  const load = () => { calls++; return request.promise; };
  const first = c.fetchAddressList('alice', load), second = c.fetchAddressList('alice', load);
  assert.equal(first, second); request.resolve([]); await first;
  await c.fetchAddressList('alice', load); assert.equal(calls, 1);
  assert.equal(c.addressEntry('alice').snapshot.data.length, 0);
});
test('confirmed deletion cannot be undone by an older refresh, and notifies subscribers', async () => {
  const c = cache(), request = deferred(); let notifications = 0;
  await c.fetchAddressList('alice', async () => [{ id: 'home' }]);
  c.addressEntry('alice').listeners.add(() => notifications++);
  const read = c.fetchAddressList('alice', () => request.promise, true);
  await c.mutateAddressList('alice', async () => [], rows => rows);
  request.resolve([{ id: 'home' }]); await read;
  assert.equal(c.addressEntry('alice').snapshot.data.length, 0);
  assert.ok(notifications > 0);
});
test('refresh failure retains usable data and retry clears its error', async () => {
  const c = cache(), rows = [{ id: 'home' }];
  await c.fetchAddressList('alice', async () => rows);
  await c.fetchAddressList('alice', async () => { throw new Error('offline'); }, true);
  assert.equal(c.addressEntry('alice').snapshot.data, rows);
  assert.equal(c.addressEntry('alice').snapshot.error, 'offline');
  await c.fetchAddressList('alice', async () => rows, true);
  assert.equal(c.addressEntry('alice').snapshot.error, '');
});
test('account clearing rejects pending reads and writes without restoring addresses', async () => {
  const c = cache(), read = deferred(), write = deferred();
  const fetching = c.fetchAddressList('alice', () => read.promise);
  const mutation = c.mutateAddressList('alice', () => write.promise, rows => rows);
  c.clearAddressLists();
  read.resolve([{ id: 'private' }]); write.resolve([{ id: 'private' }]);
  await fetching;
  await assert.rejects(mutation, /Tài khoản đã thay đổi/);
  assert.equal(c.addressEntry('alice').snapshot.data, undefined);
  assert.equal(c.addressEntry('bob').snapshot.data, undefined);
});
test('address mutations serialize and uncertain failures invalidate freshness', async () => {
  const c = cache(), write = deferred();
  await c.fetchAddressList('alice', async () => [{ id: 'home' }]);
  const first = c.mutateAddressList('alice', () => write.promise, rows => rows);
  await assert.rejects(c.mutateAddressList('alice', async () => [], rows => rows), /Đang lưu/);
  write.resolve([]); await first;
  await assert.rejects(c.mutateAddressList('alice', async () => { throw new Error('offline'); }, rows => rows));
  assert.equal(c.addressEntry('alice').updatedAt, 0);
  assert.equal(c.addressEntry('alice').snapshot.data.length, 0);
});
