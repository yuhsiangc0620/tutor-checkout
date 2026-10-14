import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import assert from 'node:assert/strict';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
const page=await browser.newPage({viewport:{width:1024,height:768}});
const failures=[];page.on('pageerror',e=>failures.push(e.message));
await mkdir('test-results',{recursive:true});
const panel=async()=>{await page.getByRole('button',{name:'展示選項',exact:true}).click();await page.getByRole('button',{name:'測試面板',exact:true}).click();};
async function fits(label){
 const size=await page.evaluate(()=>({w:innerWidth,h:innerHeight,sw:document.documentElement.scrollWidth,sh:document.documentElement.scrollHeight}));
 assert.ok(size.sw<=size.w&&size.sh<=size.h,`${label}: page must fit tablet viewport ${JSON.stringify(size)}`);
 const dock=await page.locator('.assistant-dock').boundingBox();assert.ok(dock.y+dock.height<=size.h+1,`${label}: help stays visible`);
}
try {
 await page.goto('http://localhost:3000',{waitUntil:'networkidle'});
 await fits('welcome');await page.screenshot({path:'test-results/welcome.png'});
 await page.getByRole('button',{name:'開始結帳',exact:true}).click();assert.equal(await page.locator('.setup-modal input[type=password]').count(),0);await page.getByRole('checkbox').uncheck();await page.getByRole('button',{name:'先使用模擬展示'}).click();
 await page.getByRole('heading',{name:'準備好開始結帳',exact:true}).waitFor();
 assert.equal(await page.getByText('模擬展示模式 · 不接收 ESP32 訊號').isVisible(),true);
 await panel();await page.getByRole('button',{name:'有人靠近',exact:true}).click();await page.getByRole('button',{name:'關閉測試面板'}).click();
 await page.getByRole('heading',{name:'您的商品',exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'確認並付款',exact:true}).isEnabled(),false);
 await page.screenshot({path:'test-results/empty.png'});
 await panel();for(const name of ['感應牧場鮮乳','感應青森蘋果','感應原味吐司'])await page.getByRole('button',{name,exact:true}).click();await page.getByRole('button',{name:'關閉測試面板'}).click();
 for(const [width,height] of [[1024,768],[1194,834],[1366,768]]){await page.setViewportSize({width,height});await fits('cart');await page.screenshot({path:`test-results/cart-${width}.png`});}
 await page.setViewportSize({width:1024,height:768});
 await page.getByRole('button',{name:'需要幫忙',exact:true}).click();await page.getByRole('button',{name:'移除一件商品',exact:true}).click();
 assert.equal(await page.locator('.cart-row').count(),3);assert.ok(await page.getByRole('button',{name:'移除原味吐司',exact:true}).evaluate(e=>e.classList.contains('highlight')));
 await page.getByRole('button',{name:'展示選項',exact:true}).click();await page.getByRole('button',{name:'重新開始',exact:true}).click();await page.getByRole('button',{name:'繼續結帳',exact:true}).click();assert.equal(await page.locator('.cart-row').count(),3);
 await page.reload({waitUntil:'networkidle'});assert.equal(await page.locator('.cart-row').count(),3);
 await page.getByRole('button',{name:'確認並付款',exact:true}).click();await page.getByRole('heading',{name:'請感應付款卡',exact:true}).waitFor();await fits('payment');await page.screenshot({path:'test-results/payment.png'});
 await page.getByRole('button',{name:'返回商品清單',exact:true}).click();await page.getByRole('heading',{name:'您的商品',exact:true}).waitFor();assert.equal(await page.locator('.cart-row').count(),3);await page.getByRole('button',{name:'確認並付款',exact:true}).click();
 await panel();await page.getByRole('button',{name:'感應青森蘋果',exact:true}).click();await page.getByRole('heading',{name:'請感應付款卡',exact:true}).waitFor();await page.getByRole('button',{name:'未知卡片',exact:true}).click();await page.getByRole('heading',{name:'請感應付款卡',exact:true}).waitFor();
 await page.getByRole('button',{name:'感應付款卡',exact:true}).click();await page.getByRole('button',{name:'關閉測試面板'}).click();await page.getByRole('heading',{name:'結帳完成',exact:true}).waitFor();await fits('complete');await page.screenshot({path:'test-results/complete.png'});
 await page.getByRole('button',{name:'開始下一筆',exact:true}).click();await fits('reset');
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 await page.goto('http://127.0.0.1:3000/settings',{waitUntil:'networkidle'});await page.screenshot({path:'test-results/settings.png',fullPage:true});
 assert.deepEqual(failures,[]);console.log('PASS: simplified transaction, 3 landscape sizes fit, helper/remove safety, reset confirmation, reload, wrong cards, payment, next transaction.');
}finally{await browser.close();}
