'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, ChevronRight, CreditCard, HelpCircle, Mic, MicOff, Minus, Plus, RotateCcw, ScanLine, Settings, Volume2, X, MoreHorizontal, Trash2, Smartphone, WalletCards, Printer } from 'lucide-react';
import { activeStage, count, defaultCatalog, freshCheckout, reduceCheckout, simulationCatalog, total, type Action, type Catalog, type Checkout, type DeviceEvent, type PaymentMethod } from '@/lib/domain';
import { answerHelp, findIntent, stepMessage, type Help, type Intent } from '@/lib/help';
import { recordVoiceExchange } from '@/lib/voiceHistory';
import { useVoice } from '@/hooks/useVoice';
import { Mascot, ProductArt } from './Artwork';
import { Tutorial } from './Tutorial';
type Mode='none'|'simulation'|'hardware';
type Snapshot={version:2|3;state:Checkout;mode:Mode;catalog:Catalog};
const paymentOptions:[PaymentMethod,string,typeof Smartphone][]=[['mobile','行動支付',Smartphone],['credit','信用卡',CreditCard],['transit','電子票證／悠遊卡',WalletCards]];
function playTone(kind:'scan'|'complete'){
  try{const context=new AudioContext();const oscillator=context.createOscillator();const gain=context.createGain();oscillator.type='sine';oscillator.frequency.value=kind==='scan'?880:660;gain.gain.value=.06;oscillator.connect(gain).connect(context.destination);oscillator.start();oscillator.stop(context.currentTime+(kind==='scan'?.11:.23));oscillator.onended=()=>void context.close();}catch{}
}
async function connectGuest(){const response=await fetch('/api/auth/guest',{method:'POST'});if(!response.ok){const data=await response.json();throw new Error(data.error??'無法連接感應裝置。');}}
export default function Kiosk(){
  const [state,setState]=useState(freshCheckout),stateRef=useRef(state);
  const [catalog,setCatalog]=useState<Catalog>(defaultCatalog),catalogRef=useRef(catalog);
  const [mode,setMode]=useState<Mode>('none');const modeRef=useRef<Mode>('none');
  const [restored,setRestored]=useState(false),[setup,setSetup]=useState(false),[useMic,setUseMic]=useState(true);
  const [setupError,setSetupError]=useState(''),[connecting,setConnecting]=useState(false),[networkError,setNetworkError]=useState(''),[lastSeen,setLastSeen]=useState<number|null>(null),[now,setNow]=useState(0);
  const [helpOpen,setHelpOpen]=useState(false),[toolsOpen,setToolsOpen]=useState(false);
  const [testing,setTesting]=useState(false),[confirmReset,setConfirmReset]=useState(false),[resetting,setResetting]=useState(false);
  const [tutorial,setTutorial]=useState<'all'|'scan'|'pay'|null>(null),[help,setHelp]=useState<Help>({intent:'next',text:stepMessage(state)});
  const [rescuePhase,setRescuePhase]=useState(0),[rescueDeclined,setRescueDeclined]=useState(false);
  const [highlight,setHighlight]=useState<Help['target']>(),[typed,setTyped]=useState(''),[testInput,setTestInput]=useState('');
  const lastText=useRef(stepMessage(state)),lastActivity=useRef(Date.now()),oldMoment=useRef(`${state.stage}/${state.paymentMethod}`),eventEpoch=useRef(0),frozen=useRef(false),polling=useRef(false);
  const rescueElapsed=useRef(0),rescueTick=useRef(Date.now()),rescuePhaseRef=useRef(0),rescueDeclinedRef=useRef(false),farewellRef=useRef(false);
  const voiceHandler=useRef<(t:string,source?:'voice'|'test')=>void>(()=>{});
  const voice=useVoice(t=>voiceHandler.current(t),activeStage(state.stage)&&!tutorial);
  const voiceRef=useRef(voice);voiceRef.current=voice;
  catalogRef.current=catalog;modeRef.current=mode;
  const commit=useCallback((next:Checkout)=>{stateRef.current=next;setState(next);},[]);
  const resetRescue=useCallback(()=>{rescueElapsed.current=0;rescueTick.current=Date.now();rescuePhaseRef.current=0;rescueDeclinedRef.current=false;setRescuePhase(0);setRescueDeclined(false);},[]);
  const dispatch=useCallback((action:Action)=>{lastActivity.current=Date.now();resetRescue();commit(reduceCheckout(stateRef.current,action));},[commit,resetRescue]);
  const assist=useCallback((intent:Intent)=>{
    lastActivity.current=Date.now();const reply=answerHelp(intent,stateRef.current,catalogRef.current,lastText.current);
    setHelp(reply);setHighlight(reply.target);lastText.current=reply.text;
    if(reply.tutorial)setTutorial(reply.tutorial);else voiceRef.current.speak(reply.text,intent==='slow');
    return reply;
  },[]);
  voiceHandler.current=(text,source='voice')=>{const transcript=text.trim();if(!transcript)return;setTyped(transcript);const reply=assist(findIntent(transcript));recordVoiceExchange(source,transcript,reply.text);};
  useEffect(()=>{try{const raw=sessionStorage.getItem('checkout-session-v2');if(raw){const data=JSON.parse(raw) as Snapshot;if([2,3].includes(data.version)&&['hardware','simulation'].includes(data.mode)&&['idle','welcome','tutorial-choice','scan','review','pay','complete'].includes(data.state.stage)&&Array.isArray(data.state.cart)){const saved:Checkout={...data.state,paymentMethod:data.state.paymentMethod??null};commit(saved);setMode(data.mode);setCatalog(data.catalog);setHelp({intent:'next',text:stepMessage(saved)});lastText.current=stepMessage(saved);oldMoment.current=`${saved.stage}/${saved.paymentMethod}`;}}}catch{}setRestored(true);},[commit]);
  useEffect(()=>{if(restored){try{sessionStorage.setItem('checkout-session-v2',JSON.stringify({version:3,state,mode,catalog}));}catch{}}},[state,mode,catalog,restored]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const applyEvent=useCallback((event:DeviceEvent)=>{
    const previous=stateRef.current;const next=reduceCheckout(previous,{type:'EVENT',event,catalog:catalogRef.current});commit(next);
    if(event.type==='rfid_scanned'){
      lastActivity.current=Date.now();resetRescue();
      if(next.cart!==previous.cart){setTutorial(null);playTone('scan');const message='嗶！感應成功！請繼續感應下一件商品，或點黃色的「去結帳」。';setHelp({intent:'next',text:message});lastText.current=message;voiceRef.current.speak(message);}
      else if(next.stage==='complete'){setTutorial(null);playTone('complete');}
      else if(next.notice&&next.notice!==previous.notice){setHelp({intent:'next',text:next.notice});lastText.current=next.notice;voiceRef.current.speak(next.notice);}
    }
  },[commit,resetRescue]);
  useEffect(()=>{
    if(mode!=='hardware'||!restored)return;let stopped=false;
    const poll=async()=>{
      if(polling.current||frozen.current||document.hidden)return;polling.current=true;const epoch=eventEpoch.current;
      try{const response=await fetch(`/api/events?view=checkout&after=${stateRef.current.cursor}`,{cache:'no-store'});if(response.status===401){await connectGuest();return;}const data=await response.json();if(!response.ok)throw new Error(data.error??'連線中斷');if(stopped||epoch!==eventEpoch.current||frozen.current)return;
        setNetworkError('');setLastSeen(data.lastSeen);
        if(data.gap){commit({...stateRef.current,cursor:data.cursor,notice:'連線中斷較久，請核對清單後重新感應未加入的商品。'});return;}
        for(const event of data.events as DeviceEvent[]){
          if(Date.now()-event.receivedAt>10000){commit({...stateRef.current,cursor:event.cursor});continue;}
          const current=stateRef.current;
          const enteringFromPir=event.type==='person_detected'&&current.stage==='idle';
          const unknownFirstCard=event.type==='rfid_scanned'&&current.stage==='scan'&&!current.cart.length&&!catalogRef.current.bindings.some(binding=>binding.uid===event.uid);
          if(enteringFromPir||unknownFirstCard){
            const catalogResponse=await fetch('/api/catalog?view=checkout',{cache:'no-store'});
            const latestCatalog=await catalogResponse.json();
            if(!catalogResponse.ok)throw new Error(latestCatalog.error??'無法更新商品設定');
            if(stopped||epoch!==eventEpoch.current||frozen.current)return;
            catalogRef.current=latestCatalog;setCatalog(latestCatalog);
          }
          applyEvent(event);
        }
      }catch(e){if(!stopped)setNetworkError(e instanceof Error?e.message:'連線中斷');}finally{polling.current=false;}
    };void poll();const timer=setInterval(poll,1000);return()=>{stopped=true;clearInterval(timer);};
  },[mode,restored,commit,applyEvent]);
  useEffect(()=>{
    const moment=`${state.stage}/${state.paymentMethod}`;
    if(oldMoment.current===moment)return;oldMoment.current=moment;lastActivity.current=Date.now();resetRescue();
    const text=state.stage==='idle'&&farewellRef.current?'好的！謝謝您今天讓我陪您一起結帳。別忘了拿走商品、卡片和隨身物品，歡迎下次再來！':stepMessage(state);
    farewellRef.current=false;lastText.current=text;setHelp({intent:'next',text});setHighlight(undefined);setTyped('');
    if(mode!=='none')voiceRef.current.speak(text);
  },[state.stage,state.paymentMethod,mode,resetRescue]);
  useEffect(()=>{if(!highlight)return;const timer=setTimeout(()=>setHighlight(undefined),9000);return()=>clearTimeout(timer);},[highlight,help]);
  useEffect(()=>{
    const timer=setInterval(()=>{
      const now=Date.now(),delta=Math.min(2000,now-rescueTick.current);rescueTick.current=now;
      const s=stateRef.current,eligible=s.stage==='scan'||s.stage==='pay'&&!!s.paymentMethod;
      const busy=['listening','thinking','speaking','loading'].includes(voiceRef.current.status);
      if(!eligible||busy||tutorial||rescueDeclinedRef.current)return;
      rescueElapsed.current+=delta;
      const elapsed=rescueElapsed.current;
      if(rescuePhaseRef.current<1&&elapsed>=15000){rescuePhaseRef.current=1;setRescuePhase(1);const text=s.stage==='scan'?'慢慢來，不急喔！需要幫忙可以點旁邊的提示按鈕。':'慢慢拿卡片，不急喔！';setHelp({intent:'next',text});lastText.current=text;}
      if(rescuePhaseRef.current<2&&elapsed>=25000){rescuePhaseRef.current=2;setRescuePhase(2);const text=s.stage==='scan'?'需要我示範怎麼感應商品卡嗎？':'需要我示範怎麼感應付款卡嗎？';setHelp({intent:'next',text});lastText.current=text;voiceRef.current.speak(text);}
      if(rescuePhaseRef.current<3&&elapsed>=30000){rescuePhaseRef.current=3;setRescuePhase(3);}
    },1000);return()=>clearInterval(timer);
  },[tutorial]);
  const reset=useCallback(async()=>{
    frozen.current=true;eventEpoch.current++;setResetting(true);voiceRef.current.cancelSpeech();
    try{let cursor=stateRef.current.cursor;if(modeRef.current==='hardware'){await connectGuest();const response=await fetch('/api/events?view=checkout&after=latest',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error('目前無法開始新交易，請先恢復連線。');cursor=data.cursor;}
      commit(freshCheckout(cursor));resetRescue();setConfirmReset(false);setTutorial(null);return true;
    }catch(e){setNetworkError(e instanceof Error?e.message:'重設失敗');return false;}finally{frozen.current=false;setResetting(false);}
  },[commit,resetRescue]);
  async function activate(selected:Mode){
    setConnecting(true);setSetupError('');
    try{
      let nextCatalog=simulationCatalog,cursor=0;
      if(selected==='hardware'){
        await connectGuest();
        const [cr,er]=await Promise.all([fetch('/api/catalog?view=checkout',{cache:'no-store'}),fetch('/api/events?view=checkout&after=latest',{cache:'no-store'})]);const [c,e]=await Promise.all([cr.json(),er.json()]);if(!cr.ok||!er.ok)throw new Error(c.error??e.error);nextCatalog=c;cursor=e.cursor;setLastSeen(e.lastSeen);
      }
      setCatalog(nextCatalog);setMode(selected);commit(freshCheckout(cursor));setSetup(false);setNetworkError('');if(useMic)void voice.initialize();
    }catch(e){setSetupError(e instanceof Error?e.message:'啟用失敗');}finally{setConnecting(false);}
  }
  async function start(){
    if(mode==='none'){setSetup(true);return;}
    if(mode!=='hardware'){dispatch({type:'START'});return;}
    if(connecting)return;frozen.current=true;eventEpoch.current++;setConnecting(true);
    try {
      await connectGuest();
      const [cr,er]=await Promise.all([fetch('/api/catalog?view=checkout',{cache:'no-store'}),fetch('/api/events?view=checkout&after=latest',{cache:'no-store'})]);
      const [c,e]=await Promise.all([cr.json(),er.json()]);if(!cr.ok||!er.ok)throw new Error(c.error??e.error);
      setCatalog(c);catalogRef.current=c;setNetworkError('');dispatch({type:'RESET',cursor:e.cursor});dispatch({type:'START'});
    }catch(e){setNetworkError(e instanceof Error?e.message:'目前無法開始，請恢復連線後重試。');}
    finally{frozen.current=false;setConnecting(false);}
  }
  function simulate(type:DeviceEvent['type'],uid?:string){if(mode!=='simulation')return;applyEvent({cursor:stateRef.current.cursor+1,receivedAt:Date.now(),type,uid});}
  function selectPayment(method:PaymentMethod){dispatch({type:'SELECT_PAYMENT',method});}
  function acceptTutorial(){setTutorial('all');}
  function declineTutorial(){dispatch({type:'TUTORIAL_DONE'});}
  function acceptRescue(){rescuePhaseRef.current=3;setRescuePhase(3);}
  function declineRescue(){rescueDeclinedRef.current=true;setRescueDeclined(true);}
  async function finishTransaction(){farewellRef.current=true;if(!await reset())farewellRef.current=false;}
  function printReceipt(){const text='已開啟列印視窗，請選擇印表機；列印完成後會回到開始畫面。';setHelp({intent:'next',text});lastText.current=text;voiceRef.current.speak(text);window.addEventListener('afterprint',()=>void finishTransaction(),{once:true});window.print();}
  const sum=total(state,catalog),items=count(state),isOnline=!!lastSeen&&now-lastSeen<45000&&!networkError;
  const progress={idle:0,welcome:0,'tutorial-choice':0,scan:33,review:33,pay:67,complete:100}[state.stage];
  const voiceLabels={off:'語音關閉',loading:'準備語音中',ready:'可以直接說話',listening:'我在聽',thinking:'正在理解您的問題',speaking:'正在說明',error:'語音暫時無法使用'};
  const mood=state.stage==='complete'?'complete':voice.status==='speaking'?'speaking':voice.status==='listening'?'listening':voice.status==='thinking'?'thinking':state.stage==='welcome'?'welcome':highlight||rescuePhase?'guide':'idle';
  const requestReset=()=>{if(state.cart.length&&state.stage!=='complete')setConfirmReset(true);else void reset();};
  const isWelcome=state.stage==='idle'||state.stage==='welcome'||state.stage==='tutorial-choice';
  const chooseHelp=(intent:Intent)=>{setHelpOpen(false);assist(intent);};
  const rescueQuestion=(state.stage==='scan'||state.stage==='pay'&&!!state.paymentMethod)&&rescuePhase===2&&!rescueDeclined;
  const rescueDemo=(kind:'scan'|'pay')=><aside className="rescue-demo" aria-label={kind==='scan'?'商品感應示範':'付款感應示範'}>
    <div className="rescue-demo-head"><strong>{kind==='scan'?'商品卡怎麼感應？':'付款卡怎麼感應？'}</strong><button className="icon-button" aria-label="關閉感應示範" onClick={declineRescue}><X size={18}/></button></div>
    <div className="rescue-demo-art"><div className="rescue-card"><CreditCard size={30}/><span>{kind==='scan'?'商品卡':'展示付款卡'}</span></div><div className="rescue-reader"><ScanLine size={38}/></div></div>
    <p>卡片靠近感應區，看到畫面更新後再移開。</p>
  </aside>;
  const renderMain=()=>{
    if(state.stage==='idle'||state.stage==='welcome')return <div className="welcome-content scripted-intro"><Mascot mood={mood}/><h1>{state.stage==='welcome'?'您好，歡迎光臨！':'點我開始結帳'}</h1><p className="lead">{state.stage==='welcome'?'我是結帳小幫手小智，今天陪您一步一步完成結帳。':'靠近感應器或點下方按鈕，即可開始。'}</p><button className="button primary large start-cta" disabled={connecting} onClick={()=>void start()}>{connecting?'準備中…':'點我開始結帳'}<ArrowRight/></button><p className="small-note" role="status">{mode==='hardware'?`實體感測模式 · ${isOnline?'裝置已連線':'等待裝置回報'}`:mode==='simulation'?'模擬展示模式 · 不接收 ESP32 訊號':'尚未連接感應裝置'}</p></div>;
    if(state.stage==='tutorial-choice')return <div className="tutorial-choice"><Mascot mood={mood}/><h1>請問您需不需要完整的教學動畫？</h1><p className="lead">先看慢動作示範，或直接開始結帳。</p><div className="tutorial-choice-actions"><button className="button secondary large" onClick={acceptTutorial}>需要</button><button className="button primary large" onClick={declineTutorial}>不需要<ArrowRight/></button></div></div>;
    if(state.stage==='complete')return <div className="complete-content scripted-complete"><div className="success-mark"><Check size={48}/></div><h1>交易完成</h1><p className="lead">付款感應成功，請帶好您的商品。</p><div className="receipt"><strong>NT$ {sum.toLocaleString('zh-TW')}</strong><span>共 {items} 件 · 模擬付款，未實際扣款</span><details><summary>查看商品明細</summary><ul className="receipt-items">{state.cart.map(line=><li key={line.productId}><span>{catalog.products.find(p=>p.id===line.productId)?.name}</span><span>× {line.quantity}</span></li>)}</ul></details></div><div className="completion-actions"><button className="button secondary large" onClick={printReceipt}><Printer/>列印明細</button><button className="button primary large" onClick={()=>void finishTransaction()} disabled={resetting}>結束交易<ArrowRight/></button></div><p className="small-note">列印會開啟瀏覽器列印視窗；需要已設定的印表機。</p><div className="print-receipt"><h1>結帳明細</h1><p>{new Date(state.completedAt??Date.now()).toLocaleString('zh-TW')}</p><p>交易編號：{state.transactionId}</p><ul>{state.cart.map(line=>{const product=catalog.products.find(p=>p.id===line.productId);return <li key={line.productId}>{product?.name} × {line.quantity}<span>NT$ {((product?.price??0)*line.quantity).toLocaleString('zh-TW')}</span></li>})}</ul><strong>合計 NT$ {sum.toLocaleString('zh-TW')}</strong><small>自助結帳展示明細 · 無實際扣款</small></div></div>;
    if(state.stage==='pay')return <div className="payment-flow"><div className="payment-header"><h1>{state.paymentMethod?'請感應展示付款卡':'選擇付款方式'}</h1><p className="lead">{state.paymentMethod?'將專用展示付款卡靠近感應區，稍等一下再移開。':'請選一個您習慣的方式；此展示不會實際扣款。'}</p></div>{rescueQuestion&&<div className="rescue-question" role="status"><span>需要感應示範嗎？</span><button onClick={acceptRescue}>需要</button><button onClick={declineRescue}>不用</button></div>}{!state.paymentMethod?<div className="payment-methods">{paymentOptions.map(([id,label,Icon])=><button className="payment-method" key={id} onClick={()=>selectPayment(id)}><Icon size={40} strokeWidth={1.5}/><span>{label}</span><ArrowRight size={22}/></button>)}</div>:<div className={`payment-sensing ${rescuePhase>=3&&!rescueDeclined?'has-demo':''}`}><div className="sensing-center"><div className="sensing-icon"><CreditCard size={56} strokeWidth={1.4}/><i/><i/></div><strong>感應中…</strong><span>{paymentOptions.find(([id])=>id===state.paymentMethod)?.[1]} · 請使用專用展示付款卡</span><p>請把卡片靠緊 RC522 感應區，看到「交易完成」後再移開。</p></div>{rescuePhase>=3&&!rescueDeclined&&rescueDemo('pay')}</div>}<div className="payment-bottom"><div className="total-block"><span>應付金額</span><strong><small>NT$</small> {sum.toLocaleString('zh-TW')}</strong></div><div>{state.paymentMethod?<button className="button secondary" onClick={()=>{commit({...stateRef.current,paymentMethod:null});resetRescue();}}><ArrowLeft/>更換付款方式</button>:<button className="button secondary" onClick={()=>dispatch({type:'BACK'})}><ArrowLeft/>返回確認</button>}</div></div></div>;
    return <div className={`shopping-content scripted-shopping ${rescuePhase>=3&&!rescueDeclined?'has-demo':''}`}><div className="section-heading"><div><h1>掃描商品</h1><p>請確認購買的商品都有感應到。</p></div><span className="item-count">{items} 件</span></div>{rescueQuestion&&<div className="rescue-question" role="status"><span>需要商品感應示範嗎？</span><button onClick={acceptRescue}>需要</button><button onClick={declineRescue}>不用</button></div>}<div className="shopping-workspace"><div className="cart-list" aria-label="商品清單"><div className="cart-columns" aria-hidden="true"><span>品名</span><span>單價</span><span>折扣</span><span>小計</span></div>{!state.cart.length?<div className="empty-cart"><ScanLine size={58} strokeWidth={1.2}/><h2>請感應第一件商品</h2></div>:state.cart.map(line=>{const product=catalog.products.find(p=>p.id===line.productId);if(!product)return null;return <article className="cart-row" key={product.id}><div className={`product-tile ${product.art}`}><ProductArt kind={product.art}/></div><div className="product-info"><h2>{product.name}</h2><p>{product.subtitle}</p><div className="quantity"><button aria-label={`減少${product.name}`} disabled={line.quantity<=1||state.stage==='review'} onClick={()=>dispatch({type:'QUANTITY',productId:product.id,delta:-1})}><Minus size={18}/></button><span>{line.quantity}</span><button aria-label={`增加${product.name}`} disabled={line.quantity>=99||state.stage==='review'} onClick={()=>dispatch({type:'QUANTITY',productId:product.id,delta:1})}><Plus size={18}/></button></div></div><span className="unit-price">NT$ {product.price}</span><span className="discount-price">—</span><strong className="line-price">NT$ {(product.price*line.quantity).toLocaleString('zh-TW')}</strong><button className={`icon-button remove-button ${highlight==='remove'&&(state.lastProductId===product.id||(!state.lastProductId&&state.cart.at(-1)?.productId===product.id))?'highlight':''}`} disabled={state.stage==='review'} onClick={()=>dispatch({type:'REMOVE',productId:product.id})} aria-label={`移除${product.name}`}><Trash2 size={21}/></button></article>})}</div>{rescuePhase>=3&&!rescueDeclined&&rescueDemo('scan')}</div><div className="scan-guidance"><ScanLine size={24}/><span>請將商品卡靠近感應區，看到商品出現後移開。</span></div><div className="cart-bottom"><div className="amount-breakdown"><span>總金額 <b>NT$ {sum.toLocaleString('zh-TW')}</b></span><span>折扣 <b>NT$ 0</b></span><strong>合計 <em>NT$ {sum.toLocaleString('zh-TW')}</em></strong></div><button className="button checkout-cta large" disabled={!items||state.stage==='review'} onClick={()=>dispatch({type:'REVIEW'})}>去結帳<ArrowRight/></button></div></div>;
  };
  return <main className={`kiosk scripted-kiosk ${isWelcome?'is-welcome':''}`}>
    <header className="journey-progress" aria-label="結帳進度"><div className="progress-heading"><span>結帳進度</span><strong>{progress}%</strong></div><div className="progress-track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><i style={{width:`${progress}%`}}/></div><ol><li className={progress===0?'current':''}>開始</li><li className={progress===33?'current':''}>掃描商品</li><li className={progress===67?'current':''}>選擇付款</li><li className={progress===100?'current':''}>交易完成</li></ol></header>
    {networkError&&<div className="connection-alert" role="status">{networkError} 清單已保留。</div>}
    <section className="checkout-main">{renderMain()}</section>
    <aside className="assistant-dock" aria-label="結帳小幫手"><button className="icon-button display-options" aria-label="展示選項" onClick={()=>setToolsOpen(true)}><MoreHorizontal/></button>{!isWelcome&&<Mascot mood={mood}/>}<div className="assistant-message"><div className="assistant-bubble" aria-live="polite"><p>{help.text}</p></div><span className={`voice-state ${voice.status}`}><i/>{mode==='simulation'&&<span className="mode-label">模擬展示 · </span>}{mode==='hardware'&&!isOnline&&<span className="mode-label offline">裝置未連線 · </span>}{voice.status==='loading'&&voice.progress?voice.progress:voiceLabels[voice.status]}</span></div><button className="icon-button mic-button" aria-label={voice.enabled?'關閉麥克風':'開啟麥克風'} aria-pressed={voice.enabled} onClick={voice.toggle}>{voice.enabled?<Mic size={23}/>:<MicOff size={23}/>}</button><button className="button secondary help-trigger" onClick={()=>setHelpOpen(true)}><HelpCircle size={22}/>需要幫忙</button></aside>
    {state.stage==='review'&&<div className="modal-backdrop"><section className="modal amount-confirm" role="dialog" aria-modal="true" aria-labelledby="amount-confirm-title"><span className="eyebrow">商品與金額確認</span><h2 id="amount-confirm-title">商品與金額是否正確？</h2><p>共 {items} 件商品，總共是 <strong>NT$ {sum.toLocaleString('zh-TW')}</strong> 元。</p><div className="confirm-summary">請核對商品清單。如果需要補掃或修改，點「否」返回。</div><div className="modal-actions"><button className="button secondary large" onClick={()=>dispatch({type:'BACK'})}>否，返回檢查</button><button className="button primary large" onClick={()=>dispatch({type:'PAY'})}>是，金額正確<Check/></button></div></section></div>}
    {helpOpen&&<div className="modal-backdrop"><section className="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><button className="icon-button modal-close" aria-label="關閉協助" onClick={()=>setHelpOpen(false)}><X/></button><h2 id="help-title">需要什麼協助？</h2><div className="help-options"><button onClick={()=>chooseHelp('next')}>接下來怎麼做？<ChevronRight/></button><button onClick={()=>chooseHelp(state.stage==='pay'?'pay':'scan')}>{state.stage==='pay'?'怎麼感應付款？':'怎麼感應商品？'}<ChevronRight/></button><button onClick={()=>chooseHelp('total')}>總共多少錢？<ChevronRight/></button><button onClick={()=>chooseHelp('remove')}>移除一件商品<ChevronRight/></button><button onClick={()=>chooseHelp('repeat')}>再說一次<Volume2/></button><button onClick={()=>chooseHelp('slow')}>說慢一點<Volume2/></button></div><button className="text-button" onClick={()=>{setHelpOpen(false);setTutorial('all');}}>查看操作教學</button>{voice.error&&<p className="voice-note error">{voice.error}</p>}{!voice.speechAvailable&&<p className="voice-note">裝置沒有中文聲音，請閱讀文字說明。</p>}{typed&&<p className="transcript">您剛才說：「{typed}」</p>}</section></div>}
    {toolsOpen&&<div className="modal-backdrop"><section className="modal tools-modal" role="dialog" aria-modal="true" aria-labelledby="tools-title"><button className="icon-button modal-close" aria-label="關閉展示選項" onClick={()=>setToolsOpen(false)}><X/></button><h2 id="tools-title">展示選項</h2><div className="tool-options"><Link className="button secondary" href="/settings"><Settings/>設備與卡片設定</Link>{isWelcome&&mode!=='none'&&<button className="button secondary" onClick={()=>{setToolsOpen(false);setSetup(true);}}>切換感測模式</button>}{mode==='simulation'&&<button className="button secondary" onClick={()=>{setToolsOpen(false);setTesting(true);}}>測試面板</button>}{mode!=='none'&&<button className="button secondary" onClick={()=>{setToolsOpen(false);requestReset();}} disabled={resetting}><RotateCcw/>重新開始</button>}</div></section></div>}
    {testing&&mode==='simulation'&&<section className="test-panel"><div className="test-title"><strong>模擬事件面板</strong><span>此處不會傳送實體裝置事件</span><button className="icon-button" aria-label="關閉測試面板" onClick={()=>setTesting(false)}><X/></button></div><div className="test-actions"><button onClick={()=>simulate('person_detected')}>有人靠近</button>{catalog.products.map(p=><button key={p.id} onClick={()=>simulate('rfid_scanned',catalog.bindings.find(b=>b.kind==='product'&&b.productId===p.id)?.uid)}>感應{p.name}</button>)}<button onClick={()=>simulate('rfid_scanned','DEFFFFFF')}>感應付款卡</button><button onClick={()=>simulate('rfid_scanned','DE123456')}>未知卡片</button></div><form onSubmit={e=>{e.preventDefault();voiceHandler.current(testInput,'test');}}><input aria-label="模擬辨識文字" placeholder="測試協助：輸入辨識後的文字" value={testInput} onChange={e=>setTestInput(e.target.value)}/><button className="button secondary">測試協助</button></form></section>}
    {setup&&<div className="modal-backdrop"><section className="modal setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title"><button className="icon-button modal-close" aria-label="關閉展示準備" onClick={()=>setSetup(false)}><X/></button><span className="eyebrow">展示前的小準備</span><h2 id="setup-title">準備開始體驗</h2><p>連接您的感應裝置，或先使用模擬卡片熟悉流程。</p><label className="check-label"><input type="checkbox" checked={useMic} onChange={e=>setUseMic(e.target.checked)}/><span>同時啟用中文語音<small>首次下載模型；錄音只在本機處理。</small></span></label>{setupError&&<p className="form-error" role="alert">{setupError}</p>}<button className="button primary full" disabled={connecting} onClick={()=>void activate('hardware')}>{connecting?'連線中…':'連接感應裝置'}<ArrowRight/></button><button className="button secondary full" disabled={connecting} onClick={()=>void activate('simulation')}>先使用模擬展示</button><Link className="setup-link" href="/settings">設定商品與卡片 <ChevronRight size={16}/></Link></section></div>}
    {confirmReset&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">要重新開始嗎？</h2><p>目前的 {items} 件商品會從清單移除。</p><div className="modal-actions"><button className="button secondary" onClick={()=>setConfirmReset(false)}>繼續結帳</button><button className="button primary" disabled={resetting} onClick={()=>void reset()}>確認重新開始</button></div></section></div>}
    {tutorial&&<Tutorial initial={tutorial} onClose={()=>{const fromIntro=tutorial==='all'&&stateRef.current.stage==='tutorial-choice';setTutorial(null);voice.cancelSpeech();lastActivity.current=Date.now();if(fromIntro)dispatch({type:'TUTORIAL_DONE'});}} onSpeak={text=>voiceRef.current.speak(text)}/>}
  </main>;
}
