import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage();
const product={id:'milk',name:'牧場鮮乳',subtitle:'每日新鮮',price:89,art:'milk'};
const oldCatalog={products:[product],bindings:[]};
const newCatalog={products:[product],bindings:[{uid:'DE000001',kind:'product',productId:'milk'}]};
const events=[];
let catalogReads=0;

try {
  await page.route('**/api/auth/guest',route=>route.fulfill({status:200,json:{ok:true}}));
  await page.route('**/api/catalog?view=checkout',route=>{
    catalogReads++;
    return route.fulfill({status:200,json:catalogReads>=3?newCatalog:oldCatalog});
  });
  await page.route('**/api/events?view=checkout&after=*',route=>{
    const after=new URL(route.request().url()).searchParams.get('after');
    const cursor=events.at(-1)?.cursor??0;
    return route.fulfill({status:200,json:{cursor,events:after==='latest'?[]:events.filter(event=>event.cursor>Number(after)),lastSeen:Date.now(),gap:false}});
  });

  await page.goto('http://localhost:3000',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'開始結帳',exact:true}).click();
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('button',{name:'連接感應裝置'}).click();
  await page.getByRole('heading',{name:'等待顧客靠近'}).waitFor();

  events.push({cursor:1,type:'person_detected',receivedAt:Date.now()});
  await page.getByRole('heading',{name:'您的商品'}).waitFor();
  events.push({cursor:2,type:'rfid_scanned',uid:'DE000001',receivedAt:Date.now()});
  await page.getByRole('heading',{name:'牧場鮮乳'}).waitFor();
  assert.equal(await page.locator('.item-count').textContent(),'1 件');
  assert.equal(catalogReads,3);
  console.log('PASS: PIR and first RFID refresh a stale catalog before matching a newly registered card.');
} finally { await browser.close(); }
