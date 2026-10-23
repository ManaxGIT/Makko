const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function provider({ native = false, platform = 'ios', permission = { granted: true, canAskAgain: true }, requestedPermission = { granted: true, canAskAgain: true }, services = true } = {}) {
  let gpsImports = 0, requests = 0, positions = 0, settingsOpened = 0;
  const alerts = [];
  const updates = [];
  const source = readFileSync(join(__dirname, '../src/features/location/LocationProvider.tsx'), 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX,
  } });
  const context = { exports: {}, Promise, setTimeout, clearTimeout, require(name) {
    if (name === 'react') return {
      createContext: () => ({ Provider: 'provider' }),
      useCallback: callback => callback, useContext: () => null,
      useEffect: effect => effect(), useRef: current => ({ current }),
      useState: initial => [initial, value => updates.push(value)],
    };
    if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }) };
    if (name === 'expo') return { requireOptionalNativeModule: () => native ? {} : null };
    if (name === 'react-native') return { Platform: { OS: platform }, Alert: { alert: (...args) => alerts.push(args) }, Linking: { openSettings: async () => { settingsOpened++; } } };
    if (name === '@/features/auth/AuthProvider') return { useAuth: () => ({ session: null }) };
    if (name === 'expo-location') {
      gpsImports++;
      return {
        getForegroundPermissionsAsync: async () => permission,
        requestForegroundPermissionsAsync: async () => { requests++; return requestedPermission; },
        hasServicesEnabledAsync: async () => services,
        getCurrentPositionAsync: async () => { positions++; return { coords: { latitude: 10.77, longitude: 106.70 } }; },
        Accuracy: { High: 4 },
      };
    }
    throw new Error(`Unexpected module ${name}`);
  } };
  vm.runInNewContext(outputText, context);
  const account = context.exports.LocationProvider({ children: null });
  const state = account.type(account.props).props.value;
  return { state, updates, alerts, requests: () => requests, positions: () => positions, settingsOpened: () => settingsOpened, imports: () => gpsImports };
}

test('an older client can render without importing the missing native GPS module', async () => {
  const p = provider();
  assert.equal(p.imports(), 0);
  assert.equal(await p.state.locate(), null);
  assert.equal(p.imports(), 0);
  assert.ok(p.updates.some(value => typeof value === 'string' && value.includes('build và cài lại')));
  // A failed attempt must not leave a stuck pending promise.
  const first = p.state.locate();
  assert.equal(await first, null);
  assert.notEqual(p.state.locate(), first);
});

test('a rebuilt client imports GPS on demand and deduplicates simultaneous taps', async () => {
  const p = provider({ native: true });
  assert.equal(p.imports(), 0);
  const first = p.state.locate();
  assert.equal(p.state.locate(), first);
  const point = await first;
  assert.equal(point.latitude, 10.77);
  assert.equal(point.longitude, 106.70);
  assert.equal(p.imports(), 1);
});

test('web uses the browser GPS implementation without requiring a native module', async () => {
  const p = provider({ platform: 'web' });
  const point = await p.state.locate();
  assert.equal(point.latitude, 10.77);
});


test('first GPS use requests system permission before reading position', async () => {
  const p = provider({ native: true, permission: { granted: false, canAskAgain: true } });
  assert.equal(p.requests(), 0);
  assert.ok(await p.state.locate());
  assert.equal(p.requests(), 1);
  assert.equal(p.positions(), 1);
  assert.equal(p.alerts.length, 0);
});

test('permanently denied permission offers a direct settings action without requesting again', async () => {
  const p = provider({ native: true, permission: { granted: false, canAskAgain: false } });
  assert.equal(await p.state.locate(), null);
  assert.equal(p.requests(), 0);
  assert.equal(p.positions(), 0);
  assert.equal(p.alerts.length, 1);
  assert.equal(p.settingsOpened(), 0);
  await p.alerts[0][2].find(button => button.text === 'Mở Cài đặt').onPress();
  assert.equal(p.settingsOpened(), 1);
});

test('a retryable denial and disabled location services do not read GPS', async () => {
  const p = provider({ native: true, permission: { granted: false, canAskAgain: true }, requestedPermission: { granted: false, canAskAgain: true } });
  assert.equal(await p.state.locate(), null);
  assert.equal(p.requests(), 1);
  assert.equal(p.positions(), 0);
  assert.equal(p.alerts.length, 0);
  const off = provider({ native: true, services: false });
  assert.equal(await off.state.locate(), null);
  assert.equal(off.positions(), 0);
  assert.equal(off.requests(), 0);
});
