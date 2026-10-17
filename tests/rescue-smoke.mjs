import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const browser=await chromium.launch({headless:true,channel:'chrome'});
const page=await browser.newPage({viewport:{width:1024,height:768}});
try{
  await page.addInitScript(()=>Object.defineProperty(window.speechSynthesis,'getVoices',{value:()=>[]}));
  await page.clock.install();
  await page.goto('http://localhost:3000',{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'點我開始結帳'}).click();
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('button',{name:'先使用模擬展示'}).click();
  await page.getByRole('button',{name:'點我開始結帳'}).click();
  await page.getByRole('button',{name:'不需要'}).click();
  await page.clock.runFor(16000);
  assert.match(await page.locator('.assistant-bubble').innerText(),/慢慢來/);
  await page.clock.runFor(10000);
  await page.getByText('需要商品感應示範嗎？').waitFor();
  await page.clock.runFor(5000);
  await page.getByLabel('商品感應示範').waitFor();
  await page.getByRole('button',{name:'展示選項'}).click();
  await page.getByRole('button',{name:'測試面板'}).click();
  await page.getByRole('button',{name:'感應牧場鮮乳'}).click();
  await page.getByRole('button',{name:'關閉測試面板'}).click();
  await page.getByLabel('商品感應示範').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'我要結帳'}).click();
  await page.getByRole('button',{name:'是，金額正確'}).click();
  await page.getByRole('button',{name:'信用卡'}).click();
  await page.clock.runFor(16000);
  assert.match(await page.locator('.assistant-bubble').innerText(),/慢慢拿卡片/);
  await page.clock.runFor(10000);
  await page.getByText('需要感應示範嗎？').waitFor();
  await page.clock.runFor(5000);
  await page.getByLabel('付款感應示範').waitFor();
  console.log('PASS: scan and payment both show 15s reassurance, 25s offer, 30s side demonstration.');
}finally{await browser.close();}
