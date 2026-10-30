const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const vm=require('node:vm');const ts=require('typescript');const path=require('node:path');
const source=fs.readFileSync(path.join(__dirname,'../src/features/weekly-food/model.ts'),'utf8');const context={exports:{},Date,Intl,Math};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,context);const m=context.exports;
test('all twelve package prices match approved weekly cash prices',()=>{
  const expected=[[249000,249000,459000],[449000,449000,829000],[649000,649000,1199000],[849000,849000,1569000]];
  expected.forEach((row,p)=>['lunch','dinner','both'].forEach((meal,i)=>assert.equal(m.packagePrice(p+1,meal),row[i])));
});
test('registration cancellation uses exactly seven days before the Sunday deadline',()=>{
  const order={status:'registered',deliveryDeadline:'2026-11-15T23:59:59.999+07:00'};const deadline=Date.parse(order.deliveryDeadline)-7*86400000;
  assert.equal(m.canCancel(order,deadline),true);assert.equal(m.canCancel(order,deadline+1),false);
  assert.equal(m.canCancel({...order,status:'accepted'},deadline-1),false);
  assert.equal(m.day(order.deliveryDeadline),'15/11/2026');
});
test('shopper release obeys both 24-hour and 72-hour limits and is unavailable after handover',()=>{
  const order={status:'accepted',acceptedAt:'2026-11-09T12:00:00+07:00',deliveryDeadline:'2026-11-15T23:59:59.999+07:00'};
  const accepted=Date.parse(order.acceptedAt);
  assert.equal(m.canRelease(order,accepted-1),false);assert.equal(m.canRelease(order,accepted+86400000),true);assert.equal(m.canRelease(order,accepted+86400001),false);
  const near={...order,acceptedAt:'2026-11-12T12:00:00+07:00'};const boundary=Date.parse(near.deliveryDeadline)-3*86400000;
  assert.equal(m.canRelease(near,boundary),true);assert.equal(m.canRelease(near,boundary+1),false);
  assert.equal(m.canRelease({...order,status:'delivering'},accepted+1000),false);
});
test('all twelve choices scale the weekly base by people and meal count',()=>{
  const base=[{name:'Thịt heo',quantity:'500 g'},{name:'Trứng',quantity:'2 quả'},{name:'Gạo',quantity:'1,5 kg'}];
  for(let people=1;people<=4;people++) for(const meals of ['lunch','dinner','both']) {
    const factor=people*(meals==='both'?2:1),result=m.packageIngredients(base,people,meals);
    assert.equal(result[0].quantity,factor===1?'500 g':`${factor/2} kg`.replace('.',','));
    assert.equal(result[1].quantity,`${2*factor} quả`);
    assert.equal(result[2].quantity,`${1.5*factor} kg`.replace('.',','));
    assert.equal(result[0].name,'Thịt heo');
  }
  assert.equal(base[0].quantity,'500 g');
});
test('ingredient scaling handles decimals, volumes and clear legacy fallbacks',()=>{
  const rows=m.packageIngredients([{name:'Nước',quantity:'750 ml'},{name:'Muối',quantity:'0.1 g'},{name:'Gia vị',quantity:'vừa đủ'}],2,'both');
  assert.equal(rows[0].quantity,'3 l');assert.equal(rows[1].quantity,'0,4 g');assert.equal(rows[2].quantity,'vừa đủ × 4 (lượng chuẩn)');
});
test('saved selections work independently from the next registration draft',()=>{
  const rows=[{name:'Thịt heo',quantity:'300 g'}],order={people:3,meals:'both'};
  assert.equal(m.packageIngredients(rows,order.people,order.meals)[0].quantity,'1,8 kg');
  assert.equal(m.packageIngredients(rows,1,'dinner')[0].quantity,'300 g');
  assert.equal(m.packageIngredients(rows,order.people,order.meals)[0].quantity,'1,8 kg');
});
