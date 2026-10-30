const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
function setup(initial=[{id:'a',people:2,meals:'dinner',price:449000,wage:25000},{id:'b',people:1,meals:'both',price:459000,wage:25000}]) {
 let cursor=0,tree,data=initial,error='',fetching=false;const slots=[],effects=[],calls=[],pushes=[],refreshes=[],keys=[];
 let resolve,reject;const pending=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const hooks={useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useRef(v){const i=cursor++;return slots[i]??={current:v};},useEffect(fn){const i=cursor++;if(!slots[i]){slots[i]={};effects.push(()=>slots[i].cleanup=fn());}}};
 const jsx=(type,props)=>({type,props});
 const context={exports:{},Error,require(name){
  if(name==='react')return hooks;
  if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
  if(name==='react-native')return Object.fromEntries(['RefreshControl','ScrollView','Text','View'].map(v=>[v,v]));
  if(name==='expo-router')return {useRouter:()=>({push:v=>pushes.push(v)})};
  if(name==='@/features/auth/AuthProvider')return {useAuth:()=>({session:{user:{id:'user-a'}}})};
  if(name==='@/features/weekly-food/api')return {actFood(...args){calls.push(args);return pending;},getAvailableFood(){throw new Error('unexpected real read');}};
  if(name==='@/features/weekly-food/useFoodResource')return {useFoodResource(key){keys.push(key);return {data,error,fetching,setData(fn){data=fn(data);},refresh(force){refreshes.push(force);return Promise.resolve();}};}};
  if(name==='@/features/weekly-food/AvailableFoodCard')return {AvailableFoodCard:'Card'};
  if(name==='@/features/weekly-food/FoodUI')return {FoodButton:'Button',FoodError:'Error',FoodLoading:'Loading',s:{}};
  if(name==='@/theme/colors')return {colors:{forest:'forest'}};
  throw new Error(name);
 }};
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/../src/features/explore/ExploreWeeklyFood.tsx`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
 function nodes(n=tree){if(!n||typeof n!=='object')return [];if(Array.isArray(n))return n.flatMap(nodes);return [n,...nodes(n.props?.children ?? null)];}
 function render(){cursor=0;tree=context.exports.ExploreWeeklyFood({hidden:false,header:'header'});while(effects.length)effects.shift()();}
 render();return {render,calls,pushes,refreshes,resolve,reject,keys,getData:()=>data,all:t=>nodes().filter(n=>n.type===t),unmount(){slots.forEach(s=>s?.cleanup?.());},backgroundError(){error='Mất kết nối';fetching=true;}};
}
async function flush(){for(let i=0;i<8;i++)await Promise.resolve();}
test('direct Explore acceptance sends one atomic request, removes only accepted card and opens assigned order',async()=>{const s=setup();s.all('Card')[0].props.onAccept();s.all('Card')[0].props.onAccept();assert.equal(s.calls.length,1);assert.deepEqual(s.calls[0],['a','accept','user-a']);s.render();assert.ok(s.all('Card').every(n=>n.props.disabled));s.resolve({id:'a',status:'accepted'});await flush();assert.equal(s.getData().length,1);assert.equal(s.getData()[0].id,'b');assert.equal(s.pushes[0].pathname,'/weekly-food/[id]');assert.equal(s.pushes[0].params.id,'a');s.unmount();});
test('server refusal keeps card and shows failure without navigating',async()=>{const s=setup();s.all('Card')[0].props.onAccept();s.reject(new Error('Gói vừa được người khác nhận'));await flush();s.render();assert.equal(s.pushes.length,0);assert.equal(s.getData().length,2);assert.equal(s.all('Error')[0].props.message,'Gói vừa được người khác nhận');assert.deepEqual(s.refreshes,[true]);s.unmount();});
test('unmount or account change prevents navigation after acceptance resolves',async()=>{const s=setup();s.all('Card')[0].props.onAccept();s.unmount();s.resolve({id:'a'});await flush();assert.equal(s.pushes.length,0);assert.equal(s.getData().length,2);});
test('background errors retain available cards, pagination uses the existing shared cache keys',()=>{const rows=Array.from({length:25},(_,i)=>({id:String(i)})),s=setup(rows);s.backgroundError();s.render();assert.equal(s.all('Card').length,25);assert.equal(s.all('Loading').length,0);assert.equal(s.all('Error')[0].props.message,'Mất kết nối');s.all('Button').find(n=>n.props.children==='Trang sau').props.onPress();s.render();assert.equal(s.keys.at(-1),'available:1');s.unmount();});
