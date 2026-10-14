import { chromium } from '@playwright/test';
const browser=await chromium.launch({headless:true,executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream','--use-file-for-fake-audio-capture=/private/tmp/tutor-voice-test.wav']});
const context=await browser.newContext({permissions:['microphone'],viewport:{width:1366,height:1024}});
const page=await context.newPage();
page.on('pageerror',e=>console.log('PAGE ERROR:',e.message));
page.on('console',m=>{if(m.type()==='error')console.log('CONSOLE:',m.text().slice(0,500));});
page.on('requestfailed',r=>console.log('REQUEST:',r.url(),r.failure()?.errorText));
try{
 await page.goto('http://127.0.0.1:3000',{waitUntil:'networkidle'});
 await page.getByRole('button',{name:'開始結帳',exact:true}).click();
 await page.getByRole('button',{name:'先使用模擬展示'}).click();
 await page.getByRole('button',{name:'需要幫忙',exact:true}).click();
 const deadline=Date.now()+210000;
 let previous='', lastText='', passed=false;
 while(Date.now()<deadline){
   const note=await page.locator('.voice-state').innerText();const detail=await page.locator('.voice-note').allTextContents();
   const s=`${note} ${detail.join(' ')}`;if(s!==previous){console.log(s);previous=s;}
   if(await page.locator('.voice-note.error').count())throw new Error(detail.join(' '));
   if(await page.locator('.transcript').count() && await page.locator('.transcript').innerText()!==lastText){
     lastText=await page.locator('.transcript').innerText();
     console.log('TRANSCRIPT:',await page.locator('.transcript').innerText());
     console.log('REPLY:',await page.locator('.assistant-bubble p').innerText());
     await page.screenshot({path:'test-results/voice.png',fullPage:true});
     const reply=await page.locator('.assistant-bubble p').innerText();if(!reply.includes('新臺幣')){await page.waitForTimeout(1000);continue;}
     passed=true;console.log('Actual local Whisper + VAD audio pipeline: PASS');break;
   }
   await page.waitForTimeout(1000);
 }
 if(!passed)throw new Error('Whisper test timed out without expected Chinese intent');
}finally{await browser.close();}
