const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const source = readFileSync(join(__dirname, '../src/features/addresses/addressForm.ts'), 'utf8');
const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } });
const context = { exports: {} };
vm.runInNewContext(outputText, context);
const { fromSavedAddress } = context.exports;

test('returning to a saved address restores its selected delivery point', () => {
  const saved = { recipientPhone: '0901234567', line1: '12 Nguyễn Huệ', latitude: 10.77, longitude: 106.70 };
  const address = fromSavedAddress(saved);
  assert.equal(address.coordinates.latitude, 10.77);
  assert.equal(address.coordinates.longitude, 106.70);
  assert.equal(address.savedAddress, saved);
});

test('missing legacy coordinates remain unknown instead of becoming a fake point', () => {
  const address = fromSavedAddress({ latitude: null, longitude: null });
  assert.equal(address.coordinates, null);
});

test('zero is a valid coordinate and is not treated as missing', () => {
  const address = fromSavedAddress({ latitude: 0, longitude: 0 });
  assert.equal(address.coordinates.latitude, 0);
  assert.equal(address.coordinates.longitude, 0);
});
