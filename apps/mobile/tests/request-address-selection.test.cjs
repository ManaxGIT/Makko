const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const compile = path => ts.transpileModule(readFileSync(join(__dirname, path), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText;
const home = { id: 'home', isDefault: true, recipientName: 'Test', recipientPhone: '0901234567', line1: '12 Đường nhà', line2: null, provinceCode: '48', wardCode: '20194', city: 'Đà Nẵng', ward: 'Hải Châu', district: null, latitude: null, longitude: null, deliveryNote: 'Gọi khi đến' };
const office = { ...home, id: 'office', label: 'Công ty', isDefault: false, line1: '85 Đường công ty' };
function provider(initialData) {
  const states = [], refs = [], previousDeps = [], effects = [], updates = [];
  let index = 0, data = initialData, dirty = false, value, account;
  const refresh = async () => {};
  const context = { exports: {}, Date, Math, Set, Error, require(name) {
    if (name === 'react') return {
      createContext: () => ({ Provider: 'provider' }), useContext: () => null,
      useState(initial) {
        const i = index++;
        if (!(i in states)) states[i] = typeof initial === 'function' ? initial() : initial;
        return [states[i], next => { updates.push(() => { states[i] = typeof next === 'function' ? next(states[i]) : next; }); dirty = true; }];
      },
      useRef(current) { const i = index++; return refs[i] ??= { current }; },
      useEffect(effect, deps) {
        const i = index++, old = previousDeps[i];
        if (!old || !deps || deps.some((dep, i) => dep !== old[i])) { effects.push(effect); previousDeps[i] = deps; }
      },
    };
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
    if (name === '@/features/auth/AuthProvider') return { useAuth: () => ({ session: { user: { id: 'alice' } } }) };
    if (name === '@/features/addresses/useAddresses') return { useAddresses: () => ({ data, error: '', fetching: false, mutating: false, refresh }) };
    if (name === '@/features/addresses/listCache') return { addressEntry: () => ({ snapshot: { data } }) };
    if (name === '@/features/addresses/addressForm') {
      const form = { exports: {} }; vm.runInNewContext(compile('../src/features/addresses/addressForm.ts'), form); return form.exports;
    }
    if (name === '@/lib/api') return { ApiError: class ApiError extends Error {} };
    if (name === './api') return {};
    throw new Error(`Unexpected module ${name}`);
  } };
  vm.runInNewContext(compile('../src/features/create-request/CreateRequestProvider.tsx'), context);
  account = context.exports.CreateRequestProvider({ children: null });
  function render() {
    for (let pass = 0; pass < 15; pass++) {
      while (updates.length) updates.shift()();
      dirty = false; index = 0;
      value = account.type(account.props).props.value;
      while (effects.length) effects.shift()();
      if (!dirty) return value;
    }
    throw new Error('Render did not settle');
  }
  return { render, setData(next) { data = next; }, value: () => value };
}

test('new requests use default, choosing office preserves default, reset returns home', () => {
  const p = provider([home, office]);
  assert.equal(p.render().form.savedAddress.id, 'home');
  p.value().selectDeliveryAddress(office);
  assert.equal(p.render().form.savedAddress.id, 'office');
  assert.equal(home.isDefault, true);
  p.value().patch({ time: '21:00' });
  assert.equal(p.render().form.savedAddress.id, 'office');
  p.value().reset();
  assert.equal(p.render().form.savedAddress.id, 'home');
});
test('refreshing list never overrides explicit choice and deleted selection must be chosen again', () => {
  const p = provider([home, office]); p.render(); p.value().selectDeliveryAddress(office); p.render();
  p.setData([{ ...home }, { ...office }]); assert.equal(p.render().form.savedAddress.id, 'office');
  p.setData([home]);
  const current = p.render();
  assert.equal(current.form.savedAddress, null);
  assert.equal(current.form.phone, '');
  assert.match(current.addressError, /đã bị xóa/);
  assert.throws(() => current.selectDeliveryAddress(office), /đã thay đổi/);
});
test('first list arriving after mount initializes address once and loaded empty stays empty', () => {
  const p = provider(undefined); assert.equal(p.render().form.savedAddress, undefined);
  p.setData([home, office]); assert.equal(p.render().form.savedAddress.id, 'home');
  const empty = provider([]); assert.equal(empty.render().form.savedAddress, undefined);
});
