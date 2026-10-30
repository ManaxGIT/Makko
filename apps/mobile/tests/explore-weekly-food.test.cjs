const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');
const order={id:'a',people:2,meals:'dinner',price:449000,wage:25000,deliveryDeadline:'2026-11-01T23:59:59+07:00',week:{ingredients:[{name:'Thịt heo',quantity:'500 g'}]}};
function setup(preview=false,initial=[order]) {
 let cursor=0,tree,data=initial,error='',fetching=false,closed=0;const slots=[],effects=[],calls=[],pushes=[],refreshes=[],keys=[],accepted=[];
 let resolve,reject;const pending=new Promise((yes,no)=>{resolve=yes;reject=no;});
 const hooks={useState(value){const i=cursor++;if(!(i in slots))slots[i]=value;return [slots[i],v=>{slots[i]=typeof v==='function'?v(slots[i]):v;}];},useRef(v){const i=cursor++;return slots[i]??={current:v};},useEffect(fn){const i=cursor++;if(!slots[i]){slots[i]={};effects.push(()=>slots[i].cleanup=fn());}}};
 const jsx=(type,props)=>({type,props});
 const context={exports:{},Error,require(name){
  if(name==='react')return hooks;
  if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
  if(name==='react-native')return Object.fromEntries(['RefreshControl','ScrollView','Text','View'].map(v=>[v,v]));
  if(name==='expo-router')return {useRouter:()=>({push:v=>pushes.push(v)})};
  if(name==='@/features/auth/AuthProvider')return {useAuth:()=>({session:{user:{id:'user-a'}}})};
  if(name==='@/features/weekly-food/api'||name==='./api')return {actFood(...args){calls.push(args);return pending;},getAvailableFood(){throw new Error('unexpected real read');}};
  if(name==='@/features/weekly-food/useFoodResource')return {useFoodResource(key){keys.push(key);return {data,error,fetching,setData(fn){data=fn(data);},refresh(force){refreshes.push(force);return Promise.resolve();}};}};
  if(name==='@/features/weekly-food/AvailableFoodCard')return {AvailableFoodCard:'Card'};
  if(name==='@/features/weekly-food/AvailableFoodPreview')return {AvailableFoodPreview:'Preview'};
  if(name==='@/features/addresses/AddressUI')return {AddressSheet:'Sheet'};
  if(name==='@/features/weekly-food/FoodUI'||name==='./FoodUI')return {FoodButton:'Button',FoodError:'Error',FoodLoading:'Loading',FoodRow:'Row',s:{}};
  if(name==='./model')return {day:()=> '01/11/2026',foodPlan:()=> '2 người · chỉ tối',money:n=>`${n}đ`,packageIngredients:rows=>rows};
  if(name==='@/theme/colors')return {colors:{forest:'forest'}};
  throw new Error(name);
 }};
 const file=preview?'../src/features/weekly-food/AvailableFoodPreview.tsx':'../src/features/explore/ExploreWeeklyFood.tsx';
 vm.runInNewContext(ts.transpileModule(fs.readFileSync(`${__dirname}/${file}`,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,context);
 function nodes(n=tree){if(!n||typeof n!=='object')return [];if(Array.isArray(n))return n.flatMap(nodes);return [n,...nodes(n.props?.children??null),...nodes(n.props?.footer??null)];}
 function render(){cursor=0;tree=preview?context.exports.AvailableFoodPreview({order:initial[0],onClose:()=>closed++,onAccepted:id=>accepted.push(id),onConflict:()=>refreshes.push(true)}):context.exports.ExploreWeeklyFood({hidden:false,header:'header'});while(effects.length)effects.shift()();}
 render();return {render,calls,pushes,refreshes,resolve,reject,keys,accepted,getData:()=>data,getClosed:()=>closed,all:t=>nodes().filter(n=>n.type===t),unmount(){slots.forEach(s=>s?.cleanup?.());},backgroundError(){error='Mất kết nối';fetching=true;}};
}
async function flush(){for(let i=0;i<8;i++)await Promise.resolve();}
test('Explore card opens preview without accepting; close leaves list untouched',()=>{const s=setup();s.all('Card')[0].props.onOpen();s.render();assert.equal(s.calls.length,0);assert.equal(s.all('Preview')[0].props.order.id,'a');s.all('Preview')[0].props.onClose();s.render();assert.equal(s.all('Preview').length,0);assert.equal(s.getData().length,1);s.unmount();});
test('only explicit preview confirmation accepts, deduplicates taps and opens assigned order',async()=>{const s=setup(true);assert.equal(s.calls.length,0);assert.ok(s.all('Row').some(n=>n.props.label==='Thịt heo'));const confirm=s.all('Button')[0];confirm.props.onPress();confirm.props.onPress();assert.equal(s.calls.length,1);assert.deepEqual(s.calls[0],['a','accept','user-a']);s.resolve({id:'a',status:'accepted'});await flush();assert.deepEqual(s.accepted,['a']);assert.equal(s.pushes[0].params.id,'a');s.unmount();});
test('server refusal shows failure in preview and never claims success',async()=>{const s=setup(true);s.all('Button')[0].props.onPress();s.reject(new Error('Gói vừa được người khác nhận'));await flush();s.render();assert.equal(s.pushes.length,0);assert.equal(s.accepted.length,0);assert.equal(s.all('Error')[0].props.message,'Gói vừa được người khác nhận');assert.deepEqual(s.refreshes,[true]);s.unmount();});
test('closing preview before confirmation never sends an acceptance',()=>{const s=setup(true);s.all('Sheet')[0].props.onClose();assert.equal(s.getClosed(),1);assert.equal(s.calls.length,0);s.unmount();});
test('missing ingredient data cannot be accepted blindly',()=>{const s=setup(true,[{...order,week:undefined}]);assert.equal(s.all('Button')[0].props.disabled,true);s.all('Button')[0].props.onPress();assert.equal(s.calls.length,0);s.unmount();});
test('unmount or account change prevents post-acceptance navigation',async()=>{const s=setup(true);s.all('Button')[0].props.onPress();s.unmount();s.resolve({id:'a'});await flush();assert.equal(s.pushes.length,0);assert.equal(s.accepted.length,0);});
test('confirmed acceptance removes the card from Explore locally',()=>{const s=setup();s.all('Card')[0].props.onOpen();s.render();s.all('Preview')[0].props.onAccepted('a');s.render();assert.equal(s.getData().length,0);assert.equal(s.all('Preview').length,0);s.unmount();});
test('background errors retain cards and pagination uses shared cache keys',()=>{const s=setup(false,Array.from({length:25},(_,i)=>({...order,id:String(i)})));s.backgroundError();s.render();assert.equal(s.all('Card').length,25);assert.equal(s.all('Loading').length,0);s.all('Button').find(n=>n.props.children==='Trang sau').props.onPress();s.render();assert.equal(s.keys.at(-1),'available:1');s.unmount();});
