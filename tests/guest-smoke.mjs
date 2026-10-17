// Read-only verification against the configured Redis; no cards or catalog are changed.
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';
import nextEnv from '@next/env';
nextEnv.loadEnvConfig(process.cwd());

const base='http://localhost:3000';
assert.ok(process.env.SESSION_SECRET && (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL));
assert.equal((await fetch(base+'/api/catalog')).status,401);
assert.equal((await fetch(base+'/api/events')).status,401);
const guest=await fetch(base+'/api/auth/guest',{method:'POST'});
assert.equal(guest.status,200);
const cookie=guest.headers.get('set-cookie')?.split(';')[0];
assert.ok(cookie?.startsWith('checkout-guest='));
const headers={cookie};
const guestCatalogResponse=await fetch(base+'/api/catalog?view=checkout',{headers});
assert.equal(guestCatalogResponse.status,200);
const guestCatalog=await guestCatalogResponse.json();
assert.equal((await fetch(base+'/api/events?view=checkout&after=latest',{headers})).status,200);
assert.equal((await fetch(base+'/api/catalog',{method:'PUT',headers})).status,401);
const status=await (await fetch(base+'/api/status',{headers})).json();
assert.equal(status.authenticated,false);

const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'});
try {
  const page=await browser.newPage();
  await page.goto(base,{waitUntil:'networkidle'});
  await page.getByRole('button',{name:'點我開始結帳',exact:true}).click();
  assert.equal(await page.locator('.setup-modal input[type=password]').count(),0);
  await page.getByRole('checkbox').uncheck();
  await page.getByRole('button',{name:'連接感應裝置',exact:true}).click();
  await page.getByRole('heading',{name:'點我開始結帳'}).waitFor();
  await page.getByText('實體感測模式 · 裝置已連線').waitFor();
  await page.getByRole('button',{name:'點我開始結帳'}).click();
  await page.getByRole('button',{name:'不需要'}).click();
  await page.getByRole('heading',{name:'掃描商品'}).waitFor();
  const kioskCatalog=await page.evaluate(async()=>await (await fetch('/api/catalog?view=checkout')).json());
  assert.deepEqual(kioskCatalog.bindings,guestCatalog.bindings);
  console.log('PASS: checkout connects without a code; guest can read masked catalog/events but cannot edit settings.');
} finally { await browser.close(); }
