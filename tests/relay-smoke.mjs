// Local web server against the real configured Redis. Restores the catalog afterward.
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { chromium } from '@playwright/test';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());
const base='http://127.0.0.1:3000';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const context=await browser.newContext();const page=await context.newPage();
const bootId=randomUUID();let sequence=0, backup, cookie;
async function packet(type,uid,overrides={}){
 const body={deviceId:process.env.DEVICE_ID,bootId,sequence:++sequence,type,ageMs:0,...(uid?{uid}:{}),...overrides};
 const response=await fetch(base+'/api/device/events',{method:'POST',headers:{authorization:'Bearer '+process.env.DEVICE_TOKEN,'content-type':'application/json'},body:JSON.stringify(body)});
 return {status:response.status,data:await response.json(),body};
}
async function api(path,options={}){return fetch(base+path,{...options,headers:{cookie,...options.headers}});}
async function save(catalog){return api('/api/catalog',{method:'PUT',headers:{'content-type':'application/json'},body:JSON.stringify(catalog)});}
try {
 assert.equal((await fetch(base+'/api/events')).status,401);
 assert.equal((await fetch(base+'/api/device/events',{method:'POST'})).status,401);
 const auth=await fetch(base+'/api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:process.env.ADMIN_PASSWORD??process.env.DEMO_CODE})});
 assert.equal(auth.status,200);cookie=auth.headers.get('set-cookie').split(';')[0];
 backup=await (await api('/api/catalog')).json();
 const catalog={...backup,bindings:[{uid:'CAFE0001',kind:'product',productId:backup.products[0].id},{uid:'CAFE0002',kind:'product',productId:backup.products[1].id},{uid:'CAFEFFFF',kind:'payment'}]};
 assert.equal((await save(catalog)).status,200);
 assert.equal((await save({...catalog,bindings:[...catalog.bindings,{uid:'CAFE0001',kind:'payment'}]})).status,400);
 const baseline=await (await api('/api/events?after=latest')).json();
 const first=await packet('person_detected');assert.equal(first.status,200);
 const retry=await packet('person_detected',undefined,{sequence:first.body.sequence});assert.equal(retry.data.cursor,first.data.cursor);
 const otherBoot=await packet('person_detected',undefined,{bootId:randomUUID(),sequence:first.body.sequence});assert.ok(otherBoot.data.cursor>first.data.cursor);
 assert.equal((await packet('rfid_scanned','CAFE0001',{ageMs:10001})).status,400);
 assert.equal((await packet('heartbeat')).status,200);
 const events=await (await api('/api/events?after='+baseline.cursor)).json();assert.equal(events.events.length,2);assert.ok(Date.now()-events.lastSeen<10000);
 // Browser login, actual polling, and payment guards through the real event API.
 await page.goto(base,{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'點我開始結帳',exact:true}).click();
 assert.equal(await page.locator('.setup-modal input[type=password]').count(),0);
 await page.getByRole('checkbox').uncheck();await page.getByRole('button',{name:'連接感應裝置',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'hidden'});
 await packet('person_detected');
 await page.locator('.welcome-speech').waitFor();
 await page.getByRole('button',{name:'點我開始結帳'}).click();
 await page.getByRole('button',{name:'不需要'}).click();
 await page.getByRole('heading',{name:'掃描商品'}).waitFor();
 const card=await packet('rfid_scanned','CAFE0001');await packet('rfid_scanned','CAFE0001',{sequence:card.body.sequence});
 await packet('rfid_scanned','CAFE0002');await packet('rfid_scanned','CAFE0001');
 await page.locator('.item-count').filter({hasText:'3 件'}).waitFor();
 await page.reload({waitUntil:'networkidle'});await page.locator('.item-count').filter({hasText:'3 件'}).waitFor();
 await page.getByRole('button',{name:'我要結帳',exact:true}).click();
 await page.getByRole('button',{name:'是，金額正確'}).click();
 await page.getByRole('button',{name:'信用卡'}).click();
 await packet('rfid_scanned','CAFE0001');await page.getByText('這是商品卡。請使用專用展示付款卡感應。',{exact:true}).waitFor();
 await packet('rfid_scanned','12345678');await page.getByText('這張卡還沒有設定，請換一張商品卡或請工作人員協助。',{exact:true}).waitFor();
 await packet('rfid_scanned','CAFEFFFF');await page.getByRole('heading',{name:'交易完成',exact:true}).waitFor();
 await page.getByRole('button',{name:'結束交易',exact:true}).click();await page.getByRole('button',{name:'點我開始結帳',exact:true}).click();
 await page.getByRole('button',{name:'不需要'}).click();
 await page.getByRole('heading',{name:'請感應第一件商品'}).waitFor();
 // Enroll a card via settings, capturing only a fresh event.
 await page.goto(base+'/settings',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'讀取下一張卡',exact:true}).click();await packet('rfid_scanned','CAFE0003');
 await page.getByRole('button',{name:'確認登記',exact:true}).click();await page.getByLabel('移除卡片 CAFE0003').waitFor();
 console.log('Real Redis: auth, atomic dedup, boot restart, stale rejection, ordered polling, reload, card guards, checkout, fresh transaction, settings registration: PASS');
}catch(error){console.log('Visible errors:',await page.locator('.form-error').allTextContents());await page.screenshot({path:'test-results/relay-error.png',fullPage:true});throw error;}finally{if(backup&&cookie){const restored=await save(backup);assert.equal(restored.status,200);}await browser.close();}
