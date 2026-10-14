import test from 'node:test';
import assert from 'node:assert/strict';
import {freshCheckout,reduceCheckout,simulationCatalog,total,count,validateCatalog} from '../src/lib/domain';
import {answerHelp,findIntent} from '../src/lib/help';
import {parseIncoming} from '../src/lib/server/input';
const event=(cursor:number,uid?:string)=>({cursor,type:uid?'rfid_scanned' as const:'person_detected' as const,uid,receivedAt:Date.now()});
test('complete transaction requires start, products, review, then the payment card',()=>{
  let state=freshCheckout();
  const apply=(cursor:number,uid?:string)=>state=reduceCheckout(state,{type:'EVENT',event:event(cursor,uid),catalog:simulationCatalog});
  apply(1);assert.equal(state.stage,'scan');assert.ok(state.transactionId);
  apply(2,'DEFFFFFF');assert.equal(state.stage,'scan');
  apply(3,'DEFFFFFF');assert.equal(state.stage,'scan');
  apply(4,'DE000001');apply(5,'DE000002');apply(6,'DE000001');
  assert.equal(count(state),3);assert.equal(total(state,simulationCatalog),223);
  apply(6,'DE000001');assert.equal(count(state),3);
  apply(7);assert.equal(count(state),3);assert.equal(state.stage,'scan');
  state=reduceCheckout(state,{type:'REVIEW'});
  apply(8,'DE000002');assert.equal(count(state),3);
  state=reduceCheckout(state,{type:'PAY'});
  apply(9,'DE000001');assert.equal(state.stage,'pay');
  apply(10,'12345678');assert.equal(state.stage,'pay');
  apply(11,'DEFFFFFF');assert.equal(state.stage,'complete');assert.ok(state.completedAt);
  apply(12,'DEFFFFFF');assert.equal(state.stage,'complete');assert.equal(count(state),3);
  state=reduceCheckout(state,{type:'RESET',cursor:12});apply(11,'DEFFFFFF');assert.equal(state.stage,'idle');assert.equal(count(state),0);
});
test('empty cart cannot advance; quantities are bounded; edits cannot mutate payment',()=>{
  let s=reduceCheckout(freshCheckout(),{type:'START'});
  s=reduceCheckout(s,{type:'REVIEW'});assert.equal(s.stage,'scan');
  s=reduceCheckout(s,{type:'PAY'});assert.equal(s.stage,'scan');
  s=reduceCheckout(s,{type:'EVENT',event:event(1,'DE000001'),catalog:simulationCatalog});
  s=reduceCheckout(s,{type:'QUANTITY',productId:'milk',delta:-1});assert.equal(count(s),1);
  s=reduceCheckout(s,{type:'QUANTITY',productId:'milk',delta:1000});assert.equal(count(s),99);
  s=reduceCheckout(s,{type:'REVIEW'});s=reduceCheckout(s,{type:'PAY'});
  s=reduceCheckout(s,{type:'REMOVE',productId:'milk'});assert.equal(count(s),99);
});
test('catalog rejects duplicated card roles, unknown product and invalid amounts',()=>{
  assert.throws(()=>validateCatalog({...simulationCatalog,bindings:[...simulationCatalog.bindings,{uid:'DE000001',kind:'payment'}]}));
  assert.throws(()=>validateCatalog({...simulationCatalog,products:[{...simulationCatalog.products[0],price:1.25}]}));
  assert.throws(()=>validateCatalog({...simulationCatalog,bindings:[{uid:'DE000001',kind:'product',productId:'missing'}]}));
  assert.equal(validateCatalog(simulationCatalog).bindings.length,4);
});
test('Chinese assistance accepts simplified forms but never changes checkout',()=>{
  assert.equal(findIntent('这件不要了！'),'remove');assert.equal(findIntent('总共多少钱？'),'total');
  assert.equal(findIntent('请说慢一点'),'slow');assert.equal(findIntent('我要付款'),'pay');
  assert.equal(findIntent('怎么扫描商品？'),'scan');assert.equal(findIntent('接下來怎麼做'),'next');
  assert.equal(findIntent('再说一次'),'repeat');assert.equal(findIntent('今天會下雨嗎'),'unknown');
  const s=reduceCheckout(freshCheckout(),{type:'START'});const copy=structuredClone(s);
  for(const intent of ['remove','pay','total','scan','unknown'] as const)assert.ok(answerHelp(intent,s,simulationCatalog,'').text);
  assert.deepEqual(s,copy);
});
test('firmware events enforce device, TTL, UID format and safe sequence',()=>{
  const valid={deviceId:'checkout-01',bootId:'12345678abcd',sequence:1,type:'rfid_scanned',uid:'DE 00 00 01',ageMs:50};
  assert.equal(parseIncoming(valid,'checkout-01').uid,'DE000001');
  for(const change of [{ageMs:10001},{sequence:0},{bootId:'../../'},{uid:'bad'},{deviceId:'different'}])assert.throws(()=>parseIncoming({...valid,...change},'checkout-01'));
});
test('simplified flow confirms directly from the list and returns without losing items',()=>{
 let s=reduceCheckout(freshCheckout(),{type:'START'});
 s=reduceCheckout(s,{type:'EVENT',event:event(1,'DE000001'),catalog:simulationCatalog});
 s=reduceCheckout(s,{type:'PAY'});assert.equal(s.stage,'pay');assert.equal(count(s),1);
 s=reduceCheckout(s,{type:'BACK'});assert.equal(s.stage,'scan');assert.equal(count(s),1);
 assert.equal(answerHelp('pay',s,simulationCatalog,'').text.includes('確認並付款'),true);
});

test('colloquial help chooses specific requests over generic help or checkout words',()=>{
  const examples: [string, ReturnType<typeof findIntent>][] = [
    ['請問商品卡放哪裡？','scan'],['商品感应不到，帮我看看','scan'],
    ['我還要再買一件','scan'],['結帳總共多少錢？','total'],
    ['幫我看一下一共幾件','total'],['付款要付多少？','total'],
    ['我多刷一件，怎麼辦','remove'],['這件不買了','remove'],
    ['商品都掃好了','pay'],['付款卡放哪裡','pay'],['付款沒反應','pay'],
    ['然後呢？','next'],['第一次使用，教我一下','next'],
    ['剛才說什麼？','repeat'],['不要講那麼快','slow'],
    ['今天的天氣怎麼樣','unknown'],
  ];
  for(const [phrase,intent] of examples)assert.equal(findIntent(phrase),intent,phrase);
});
