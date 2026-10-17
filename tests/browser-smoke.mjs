import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';

const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1024,height:768}});
const failures=[];
page.on('pageerror',error=>failures.push(error.message));
await mkdir('test-results',{recursive:true});

async function panel(){
  await page.getByRole('button',{name:'展示選項'}).click();
  await page.getByRole('button',{name:'測試面板'}).click();
}
async function fits(label){
  const size=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));
  assert.ok(size.sw<=size.w&&size.sh<=size.h,`${label}: viewport overflow ${JSON.stringify(size)}`);
  const dock=await page.locator('.assistant-dock').boundingBox();
  assert.ok(dock.y+dock.height<=size.h+1,`${label}: assistant is visible`);
}

try{
  await page.goto('http://localhost:3000',{waitUntil:'networkidle'});
  await page.getByRole('heading',{name:'點我開始結帳'}).waitFor();
  await fits('idle');
  await page.screenshot({path:'test-results/flow-idle.png'});
  await page.getByRole('button',{name:'點我開始結帳'}).click();
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('button',{name:'先使用模擬展示'}).click();
  await panel();await page.getByRole('button',{name:'有人靠近'}).click();await page.getByRole('button',{name:'關閉測試面板'}).click();
  await page.getByRole('heading',{name:'您好，歡迎光臨！'}).waitFor();
  await page.getByRole('button',{name:'點我開始結帳'}).click();
  await page.getByRole('heading',{name:'請問您需不需要完整的教學動畫？'}).waitFor();
  await fits('tutorial choice');await page.screenshot({path:'test-results/flow-tutorial-choice.png'});
  await page.getByRole('button',{name:'需要',exact:true}).click();
  await page.getByRole('button',{name:'下一步'}).click();
  await page.getByRole('button',{name:'下一步'}).click();
  await page.getByRole('button',{name:'開始結帳'}).click();
  await page.getByRole('heading',{name:'掃描商品'}).waitFor();
  assert.equal(await page.getByRole('button',{name:'去結帳'}).isEnabled(),false);
  await panel();
  for(const name of ['感應牧場鮮乳','感應青森蘋果','感應原味吐司'])await page.getByRole('button',{name}).click();
  await page.getByRole('button',{name:'關閉測試面板'}).click();
  assert.equal(await page.locator('.cart-row').count(),3);
  for(const [width,height] of [[1024,768],[1194,834],[1366,768]]){
    await page.setViewportSize({width,height});await fits(`scan ${width}`);
    await page.screenshot({path:`test-results/flow-scan-${width}.png`});
  }
  await page.setViewportSize({width:1024,height:768});
  await page.reload({waitUntil:'networkidle'});
  assert.equal(await page.locator('.cart-row').count(),3);
  await page.getByRole('button',{name:'去結帳'}).click();
  await page.getByRole('heading',{name:'商品與金額是否正確？'}).waitFor();
  await page.getByRole('button',{name:'否，返回檢查'}).click();
  assert.equal(await page.locator('.cart-row').count(),3);
  await page.getByRole('button',{name:'去結帳'}).click();
  await page.getByRole('button',{name:'是，金額正確'}).click();
  await page.getByRole('heading',{name:'選擇付款方式'}).waitFor();
  await fits('payment choice');await page.screenshot({path:'test-results/flow-payment-choice.png'});
  await page.getByRole('button',{name:'信用卡'}).click();
  await page.getByRole('heading',{name:'請感應展示付款卡'}).waitFor();
  await panel();await page.getByRole('button',{name:'感應青森蘋果'}).click();
  await page.getByRole('heading',{name:'請感應展示付款卡'}).waitFor();
  await page.getByRole('button',{name:'感應付款卡'}).click();
  await page.getByRole('button',{name:'關閉測試面板'}).click();
  await page.getByRole('heading',{name:'交易完成'}).waitFor();
  await fits('complete');await page.screenshot({path:'test-results/flow-complete.png'});
  await page.emulateMedia({media:'print'});
  assert.equal(await page.locator('.print-receipt').isVisible(),true);
  assert.match(await page.locator('.print-receipt').innerText(),/自助結帳展示明細/);
  await page.emulateMedia({media:'screen'});
  await page.getByRole('button',{name:'結束交易'}).click();
  await page.getByRole('heading',{name:'點我開始結帳'}).waitFor();
  assert.deepEqual(failures,[]);
  console.log('PASS: PIR welcome, tutorial, scan, amount correction, payment choice, card guards, completion and tablet sizes.');
}finally{await browser.close();}
