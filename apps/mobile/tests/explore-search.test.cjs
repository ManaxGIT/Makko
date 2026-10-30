const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');

// Exercise asynchronous screen reads with the same lightweight hook approach as the GPS tests.
function screen() {
  let cursor = 0, tree, timerId = 0;
  const slots = [], effects = [], timers = new Map(), calls = [];
  const hooks = {
    useState(initial) {
      const i = cursor++;
      if (!(i in slots)) slots[i] = initial;
      return [slots[i], value => { slots[i] = typeof value === 'function' ? value(slots[i]) : value; }];
    },
    useRef(initial) { const i = cursor++; return slots[i] ??= { current: initial }; },
    useMemo: fn => fn(), useCallback: fn => fn,
    useEffect(fn, deps) {
      const i = cursor++;
      if (!slots[i] || deps.some((v, n) => v !== slots[i].deps[n])) {
        slots[i]?.cleanup?.();
        const state = { deps }; slots[i] = state;
        effects.push(() => { state.cleanup = fn(); });
      }
    },
  };
  const jsx = (type, props) => ({ type, props });
  const source = readFileSync(`${__dirname}/../app/(tabs)/explore.tsx`, 'utf8');
  const { outputText } = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } });
  const context = { exports: {}, Map, Set, Date, Error, setTimeout(fn) { const id = ++timerId; timers.set(id, fn); return id; }, clearTimeout(id) { timers.delete(id); }, require(name) {
    if (name === 'react') return hooks;
    if (name === 'react/jsx-runtime') return { jsx, jsxs: jsx };
    if (name === 'react-native') return { StyleSheet: { create: x => x }, ...Object.fromEntries(['ActivityIndicator','Pressable','RefreshControl','ScrollView','Text','TextInput','View'].map(x => [x, x])) };
    if (name === 'expo-router') return { useFocusEffect() {}, useRouter: () => ({}) };
    if (name === '@/features/explore/ExploreWeeklyFood') return { ExploreWeeklyFood: 'ExploreWeeklyFood' };
    if (name === '@/components/ui/AvatarImage') return { AvatarImage: 'AvatarImage' };
    if (name === 'expo-symbols') return { SymbolView: 'SymbolView' };
    if (name === 'react-native-safe-area-context') return { SafeAreaView: 'SafeAreaView' };
    if (name === '@/features/auth/AuthProvider') return { useAuth: () => ({ session: { user: { id: 'user-a' } } }) };
    if (name === '@/features/location/LocationProvider') return { useNearbyLocation: () => ({ coordinates: null, locating: false, error: '', locate() {} }) };
    if (name === '@/features/explore/ExploreAreaFilter') return { ExploreAreaFilter: 'AreaFilter' };
    if (name === '@/features/explore/unavailableRequests') return { getUnavailableExploreRequestIds: () => new Set(), clearUnavailableExploreRequests() {} };
    if (name === '@/features/explore/api') return { listExploreRequests(params) {
      let resolve, reject;
      const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
      calls.push({ params, resolve, reject }); return promise;
    } };
    if (name.startsWith('@/theme/')) return new Proxy({}, { get: () => new Proxy({}, { get: (_, key) => key }) });
    throw new Error(name);
  } };
  vm.runInNewContext(outputText, context);
  const account = context.exports.default();
  function render() { cursor = 0; tree = account.type(); while (effects.length) effects.shift()(); }
  function nodes(node = tree) {
    if (!node || typeof node !== 'object') return [];
    if (Array.isArray(node)) return node.flatMap(nodes);
    return [node, ...nodes(node.props?.children ?? null)];
  }
  render();
  return { calls, render, find: type => nodes().find(n => n.type === type), findAll: type => nodes().filter(n => n.type === type),
    text: () => nodes().filter(n => n.type === 'Text').map(n => n.props.children).flat().join(' '),
    runTimers() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    unmount() { slots.forEach(s => s?.cleanup?.()); },
  };
}
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const area = { province: { code: '48', name: 'Đà Nẵng', fullName: 'Thành phố Đà Nẵng' }, ward: null };
function selectArea(s) {
  s.find('AreaFilter').props.onModeChange('area'); s.find('AreaFilter').props.onChange(area);
  s.render(); s.runTimers();
}

test('no GPS does not silently search nationwide; area searches do not need GPS', () => {
  const s = screen(); s.runTimers(); assert.equal(s.calls.length, 0);
  selectArea(s); assert.equal(s.calls.length, 1);
  assert.equal(s.calls[0].params.provinceCode, '48');
  assert.equal(s.calls[0].params.latitude, undefined); s.unmount();
});

test('an obsolete result cannot replace the selected ward during debounce', async () => {
  const s = screen(); selectArea(s);
  s.find('AreaFilter').props.onChange({ ...area, ward: { code: '20194', provinceCode: '48', name: 'Hải Châu', fullName: 'Phường Hải Châu' } });
  s.render(); s.calls[0].resolve([]); await flush(); s.render();
  assert.ok(!s.text().includes('0 yêu cầu phù hợp'));
  s.runTimers(); assert.equal(s.calls[1].params.wardCode, '20194');
  s.calls[1].resolve([]); await flush(); s.render();
  assert.ok(s.text().includes('0 yêu cầu phù hợp')); s.unmount();
});

test('refresh deduplicates ongoing reads and retains a loaded empty result after failure', async () => {
  const s = screen(); selectArea(s); s.render();
  const refresh = s.find('ScrollView').props.refreshControl.props.onRefresh;
  refresh(); assert.equal(s.calls.length, 1);
  s.calls[0].resolve([]); await flush(); s.render();
  assert.ok(s.text().includes('0 yêu cầu phù hợp'));
  refresh(); assert.equal(s.calls.length, 2);
  s.calls[1].reject(new Error('Network unavailable')); await flush(); s.render();
  assert.ok(s.text().includes('Network unavailable'));
  assert.ok(s.text().includes('0 yêu cầu phù hợp'));
  assert.ok(!s.text().includes('Không thể tải yêu cầu')); s.unmount();
});


test('Explore exposes weekly delivery directly and preserves the errand filters',()=>{
  const s=screen();selectArea(s);
  s.find('TextInput').props.onChangeText('rau');s.render();
  const tabs=()=>s.findAll('Pressable').filter(n=>n.props.accessibilityRole==='tab');
  assert.equal(tabs().length,2);
  tabs()[1].props.onPress();s.render();
  assert.equal(s.find('ExploreWeeklyFood').props.hidden,false);
  assert.equal(s.find('ScrollView').props.style.display,'none');
  tabs()[0].props.onPress();s.render();
  assert.equal(s.find('ExploreWeeklyFood').props.hidden,true);
  assert.equal(s.find('TextInput').props.value,'rau');
  assert.equal(s.find('AreaFilter').props.value.province.code,'48');
  s.unmount();
});
