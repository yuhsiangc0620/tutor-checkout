'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, ChevronRight, CreditCard, HelpCircle, Leaf, Mic, MicOff, Minus, Plus, RotateCcw, ScanLine, Settings, Volume2, X, MoreHorizontal, Trash2 } from 'lucide-react';
import { activeStage, count, defaultCatalog, freshCheckout, reduceCheckout, simulationCatalog, total, type Action, type Catalog, type Checkout, type DeviceEvent } from '@/lib/domain';
import { answerHelp, findIntent, stepMessage, type Help, type Intent } from '@/lib/help';
import { useVoice } from '@/hooks/useVoice';
import { Mascot, ProductArt } from './Artwork';
import { Tutorial } from './Tutorial';
type Mode='none'|'simulation'|'hardware';
type Snapshot={version:2;state:Checkout;mode:Mode;catalog:Catalog};
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
  const [highlight,setHighlight]=useState<Help['target']>(),[typed,setTyped]=useState(''),[testInput,setTestInput]=useState('');
  const lastText=useRef(stepMessage(state)),lastActivity=useRef(Date.now()),prompted=useRef(new Set<string>()),oldStage=useRef(state.stage),eventEpoch=useRef(0),frozen=useRef(false),polling=useRef(false);
  const voiceHandler=useRef<(t:string)=>void>(()=>{});
  const voice=useVoice(t=>voiceHandler.current(t),activeStage(state.stage)&&!tutorial);
  const voiceRef=useRef(voice);voiceRef.current=voice;
  catalogRef.current=catalog;modeRef.current=mode;
  const commit=useCallback((next:Checkout)=>{stateRef.current=next;setState(next);},[]);
  const dispatch=useCallback((action:Action)=>{lastActivity.current=Date.now();commit(reduceCheckout(stateRef.current,action));},[commit]);
  const assist=useCallback((intent:Intent)=>{
    lastActivity.current=Date.now();const reply=answerHelp(intent,stateRef.current,catalogRef.current,lastText.current);
    setHelp(reply);setHighlight(reply.target);lastText.current=reply.text;
    if(reply.tutorial)setTutorial(reply.tutorial);else voiceRef.current.speak(reply.text,intent==='slow');
  },[]);
  voiceHandler.current=(text)=>{setTyped(text);assist(findIntent(text));};
  useEffect(()=>{try{const raw=sessionStorage.getItem('checkout-session-v2');if(raw){const data=JSON.parse(raw) as Snapshot;if(data.version===2&&['hardware','simulation'].includes(data.mode)&&['idle','welcome','scan','review','pay','complete'].includes(data.state.stage)&&Array.isArray(data.state.cart)){const saved=data.state.stage==='review'?{...data.state,stage:'scan' as const}:data.state;commit(saved);setMode(data.mode);setCatalog(data.catalog);setHelp({intent:'next',text:stepMessage(saved)});lastText.current=stepMessage(saved);oldStage.current=saved.stage;}}}catch{}setRestored(true);},[commit]);
  useEffect(()=>{if(restored){try{sessionStorage.setItem('checkout-session-v2',JSON.stringify({version:2,state,mode,catalog}));}catch{}}},[state,mode,catalog,restored]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[]);
  const applyEvent=useCallback((event:DeviceEvent)=>{
    const previous=stateRef.current;const next=reduceCheckout(previous,{type:'EVENT',event,catalog:catalogRef.current});commit(next);
    if(event.type==='rfid_scanned'){lastActivity.current=Date.now();if(next.cart!==previous.cart || next.stage==='complete')setTutorial(null);if(next.notice&&next.notice!==previous.notice){setHelp({intent:'next',text:next.notice});lastText.current=next.notice;voiceRef.current.speak(next.notice);}}
  },[commit]);
  useEffect(()=>{
    if(mode!=='hardware'||!restored)return;let stopped=false;
    const poll=async()=>{
      if(polling.current||frozen.current||document.hidden)return;polling.current=true;const epoch=eventEpoch.current;
      try{const response=await fetch(`/api/events?view=checkout&after=${stateRef.current.cursor}`,{cache:'no-store'});if(response.status===401){await connectGuest();return;}const data=await response.json();if(!response.ok)throw new Error(data.error??'連線中斷');if(stopped||epoch!==eventEpoch.current||frozen.current)return;
        setNetworkError('');setLastSeen(data.lastSeen);
        if(data.gap){commit({...stateRef.current,cursor:data.cursor,notice:'連線中斷較久，請核對清單後重新感應未加入的商品。'});return;}
        for(const event of data.events as DeviceEvent[]){if(Date.now()-event.receivedAt>10000){commit({...stateRef.current,cursor:event.cursor});continue;}applyEvent(event);}
      }catch(e){if(!stopped)setNetworkError(e instanceof Error?e.message:'連線中斷');}finally{polling.current=false;}
    };void poll();const timer=setInterval(poll,1000);return()=>{stopped=true;clearInterval(timer);};
  },[mode,restored,commit,applyEvent]);
  useEffect(()=>{
    if(oldStage.current===state.stage)return;oldStage.current=state.stage;lastActivity.current=Date.now();
    const text=stepMessage(state);lastText.current=text;setHelp({intent:'next',text});setHighlight(undefined);setTyped('');
    if(mode!=='none')voiceRef.current.speak(text);
    if(state.stage==='idle')prompted.current.clear();
  },[state.stage,mode,state]);
  useEffect(()=>{if(!highlight)return;const timer=setTimeout(()=>setHighlight(undefined),9000);return()=>clearTimeout(timer);},[highlight,help]);
  useEffect(()=>{
    const timer=setInterval(()=>{
      const s=stateRef.current;const busy=['listening','thinking','speaking','loading'].includes(voiceRef.current.status);
      if(busy||tutorial){lastActivity.current=Date.now();return;}
      if(activeStage(s.stage)&&!prompted.current.has(s.stage)&&Date.now()-lastActivity.current>=15000){prompted.current.add(s.stage);const text='需要幫忙嗎？可以問我，或點「需要幫忙」。';setHelp({intent:'next',text});lastText.current=text;voiceRef.current.speak(text);}
    },1000);return()=>clearInterval(timer);
  },[tutorial]);
  const reset=useCallback(async()=>{
    frozen.current=true;eventEpoch.current++;setResetting(true);voiceRef.current.cancelSpeech();
    try{let cursor=stateRef.current.cursor;if(modeRef.current==='hardware'){await connectGuest();const response=await fetch('/api/events?view=checkout&after=latest',{cache:'no-store'});const data=await response.json();if(!response.ok)throw new Error('目前無法開始新交易，請先恢復連線。');cursor=data.cursor;}
      commit(freshCheckout(cursor));prompted.current.clear();setConfirmReset(false);setTutorial(null);
    }catch(e){setNetworkError(e instanceof Error?e.message:'重設失敗');}finally{frozen.current=false;setResetting(false);}
  },[commit]);
  useEffect(()=>{if(state.stage!=='complete')return;const remaining=Math.max(0,10000-(Date.now()-(state.completedAt??Date.now())));const timer=setTimeout(()=>void reset(),remaining);return()=>clearTimeout(timer);},[state.stage,state.completedAt,reset]);
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
  const sum=total(state,catalog),items=count(state),isOnline=!!lastSeen&&now-lastSeen<45000&&!networkError;
  const stepIndex={idle:-1,welcome:-1,scan:0,review:0,pay:1,complete:2}[state.stage];
  const voiceLabels={off:'語音關閉',loading:'準備語音中',ready:'可以直接說話',listening:'我在聽',thinking:'正在理解您的問題',speaking:'正在說明',error:'語音暫時無法使用'};
  const mood=state.stage==='complete'?'complete':voice.status==='speaking'?'speaking':voice.status==='listening'?'listening':voice.status==='thinking'?'thinking':state.stage==='welcome'?'welcome':highlight?'guide':'idle';
  const requestReset=()=>{if(state.cart.length&&state.stage!=='complete')setConfirmReset(true);else void reset();};
  const isWelcome=state.stage==='idle'||state.stage==='welcome';
  const chooseHelp=(intent:Intent)=>{setHelpOpen(false);assist(intent);};
  const renderMain=()=>{
    if(isWelcome)return <div className="welcome-content"><Mascot mood={mood}/><h1>{state.stage==='idle'&&mode==='hardware'?'等待顧客靠近':state.stage==='idle'&&mode==='simulation'?'準備好開始結帳':'歡迎，開始結帳'}</h1><p className="lead">{state.stage==='idle'&&mode==='hardware'?'感應到有人靠近後，這裡會顯示歡迎畫面。':help.text}</p><button className="button primary large" disabled={connecting} onClick={()=>void start()}>{connecting?'準備中…':state.stage==='idle'&&mode!=='none'?'手動開始結帳':'開始結帳'}<ArrowRight/></button></div>;
    if(state.stage==='complete')return <div className="complete-content"><div className="success-mark"><Check size={44}/></div><h1>結帳完成</h1><p className="lead">請帶好您的商品。</p><div className="receipt"><strong>NT$ {sum.toLocaleString()}</strong><span>共 {items} 件 · 模擬付款成功</span><details><summary>查看商品明細</summary><ul className="receipt-items">{state.cart.map(line=><li key={line.productId}><span>{catalog.products.find(p=>p.id===line.productId)?.name}</span><span>× {line.quantity}</span></li>)}</ul></details></div><button className="button primary" onClick={()=>void reset()} disabled={resetting}>開始下一筆<ArrowRight/></button><p className="small-note">{Math.max(0,Math.ceil((10000-(now-(state.completedAt??now)))/1000))} 秒後回到首頁</p></div>;
    if(state.stage==='pay')return <div className="payment-content"><div className="payment-copy"><h1>請感應付款卡</h1><p className="lead">將專用付款卡靠近感應區。</p><div className={`pay-total ${highlight==='total'?'highlight':''}`}><span>應付金額</span><strong><small>NT$</small> {sum.toLocaleString()}</strong><p className="small-note">模擬付款，不會實際扣款</p></div><button className={`button secondary ${highlight==='next'?'highlight':''}`} onClick={()=>dispatch({type:'BACK'})}><ArrowLeft/>返回商品清單</button></div><div className={`payment-illustration ${highlight==='scanner'?'highlight':''}`}><div className="payment-card"><CreditCard size={32}/><span>付款卡</span></div><div className="payment-waves"><i/><i/><i/></div><div className="payment-reader"><ScanLine size={48}/></div></div></div>;
    return <div className="shopping-content"><div className="section-heading"><h1>您的商品</h1><span className="item-count">{items} 件</span></div><div className={`cart-list ${highlight==='scanner'?'highlight':''}`} aria-label="商品清單">{!state.cart.length?<div className="empty-cart"><ScanLine size={58} strokeWidth={1.2}/><h2>請感應第一件商品</h2></div>:state.cart.map(line=>{const product=catalog.products.find(p=>p.id===line.productId);if(!product)return null;return <article className="cart-row" key={product.id}><div className={`product-tile ${product.art}`}><ProductArt kind={product.art}/></div><div className="product-info"><h2>{product.name}</h2><p>每件 NT$ {product.price}</p></div><div className="quantity"><button aria-label={`減少${product.name}`} disabled={line.quantity<=1} onClick={()=>dispatch({type:'QUANTITY',productId:product.id,delta:-1})}><Minus size={20}/></button><span>{line.quantity}</span><button aria-label={`增加${product.name}`} disabled={line.quantity>=99} onClick={()=>dispatch({type:'QUANTITY',productId:product.id,delta:1})}><Plus size={20}/></button></div><strong className="line-price">${(product.price*line.quantity).toLocaleString()}</strong><button className={`icon-button remove-button ${highlight==='remove'&&(state.lastProductId===product.id||(!state.lastProductId&&state.cart.at(-1)?.productId===product.id))?'highlight':''}`} onClick={()=>dispatch({type:'REMOVE',productId:product.id})} aria-label={`移除${product.name}`}><Trash2 size={21}/></button></article>;})}</div><div className="cart-bottom"><div className={`total-block ${highlight==='total'?'highlight':''}`}><span>合計</span><strong><small>NT$</small> {sum.toLocaleString()}</strong></div><button className={`button primary large ${highlight==='next'?'highlight':''}`} disabled={!items} onClick={()=>dispatch({type:'PAY'})}>確認並付款<ArrowRight/></button></div></div>;
  };
  return <main className={`kiosk ${isWelcome?'is-welcome':''}`}>{!isWelcome&&<nav className="stepper" aria-label="結帳進度">{['商品','付款','完成'].map((label,i)=><div key={label} className={`step ${i===stepIndex?'current':i<stepIndex?'done':''}`} aria-current={i===stepIndex?'step':undefined}><span className="step-number">{i<stepIndex?<Check size={14}/>:i+1}</span><span>{label}</span>{i<2&&<span className="step-line"/>}</div>)}</nav>}
    {networkError&&<div className="connection-alert" role="status">{networkError} 清單已保留。</div>}
    <section className="checkout-main">{renderMain()}</section>
    <aside className="assistant-dock" aria-label="結帳小幫手"><button className="icon-button display-options" aria-label="展示選項" onClick={()=>setToolsOpen(true)}><MoreHorizontal/></button>{!isWelcome&&<Mascot mood={mood}/>}<div className="assistant-message">{!isWelcome&&<div className="assistant-bubble" aria-live="polite"><p>{help.text}</p></div>}<span className={`voice-state ${voice.status}`}><i/>{mode==='simulation'&&<span className="mode-label">模擬展示 · </span>}{mode==='hardware'&&!isOnline&&<span className="mode-label offline">裝置未連線 · </span>}{voice.status==='loading'&&voice.progress?voice.progress:voiceLabels[voice.status]}</span></div><button className="icon-button mic-button" aria-label={voice.enabled?'關閉麥克風':'開啟麥克風'} aria-pressed={voice.enabled} onClick={voice.toggle}>{voice.enabled?<Mic size={23}/>:<MicOff size={23}/>}</button><button className="button secondary help-trigger" onClick={()=>setHelpOpen(true)}><HelpCircle size={22}/>需要幫忙</button></aside>
    {helpOpen&&<div className="modal-backdrop"><section className="modal help-modal" role="dialog" aria-modal="true" aria-labelledby="help-title"><button className="icon-button modal-close" aria-label="關閉協助" onClick={()=>setHelpOpen(false)}><X/></button><h2 id="help-title">需要什麼協助？</h2><div className="help-options"><button onClick={()=>chooseHelp('next')}>接下來怎麼做？<ChevronRight/></button><button onClick={()=>chooseHelp(state.stage==='pay'?'pay':'scan')}>{state.stage==='pay'?'怎麼感應付款？':'怎麼感應商品？'}<ChevronRight/></button><button onClick={()=>chooseHelp('total')}>總共多少錢？<ChevronRight/></button><button onClick={()=>chooseHelp('remove')}>移除一件商品<ChevronRight/></button><button onClick={()=>chooseHelp('repeat')}>再說一次<Volume2/></button><button onClick={()=>chooseHelp('slow')}>說慢一點<Volume2/></button></div><button className="text-button" onClick={()=>{setHelpOpen(false);setTutorial('all');}}>查看操作教學</button>{voice.error&&<p className="voice-note error">{voice.error}</p>}{!voice.speechAvailable&&<p className="voice-note">裝置沒有中文聲音，請閱讀文字說明。</p>}{typed&&<p className="transcript">您剛才說：「{typed}」</p>}</section></div>}
    {toolsOpen&&<div className="modal-backdrop"><section className="modal tools-modal" role="dialog" aria-modal="true" aria-labelledby="tools-title"><button className="icon-button modal-close" aria-label="關閉展示選項" onClick={()=>setToolsOpen(false)}><X/></button><h2 id="tools-title">展示選項</h2><div className="tool-options"><Link className="button secondary" href="/settings"><Settings/>設備與卡片設定</Link>{mode==='simulation'&&<button className="button secondary" onClick={()=>{setToolsOpen(false);setTesting(true);}}>測試面板</button>}{mode!=='none'&&<button className="button secondary" onClick={()=>{setToolsOpen(false);requestReset();}} disabled={resetting}><RotateCcw/>重新開始</button>}</div></section></div>}
    {testing&&mode==='simulation'&&<section className="test-panel"><div className="test-title"><strong>模擬事件面板</strong><span>此處不會傳送實體裝置事件</span><button className="icon-button" aria-label="關閉測試面板" onClick={()=>setTesting(false)}><X/></button></div><div className="test-actions"><button onClick={()=>simulate('person_detected')}>有人靠近</button>{catalog.products.map(p=><button key={p.id} onClick={()=>simulate('rfid_scanned',catalog.bindings.find(b=>b.kind==='product'&&b.productId===p.id)?.uid)}>感應{p.name}</button>)}<button onClick={()=>simulate('rfid_scanned','DEFFFFFF')}>感應付款卡</button><button onClick={()=>simulate('rfid_scanned','DE123456')}>未知卡片</button></div><form onSubmit={e=>{e.preventDefault();voiceHandler.current(testInput);}}><input aria-label="模擬辨識文字" placeholder="測試協助：輸入辨識後的文字" value={testInput} onChange={e=>setTestInput(e.target.value)}/><button className="button secondary">測試協助</button></form></section>}
    {setup&&<div className="modal-backdrop"><section className="modal setup-modal" role="dialog" aria-modal="true" aria-labelledby="setup-title"><button className="icon-button modal-close" aria-label="關閉展示準備" onClick={()=>setSetup(false)}><X/></button><span className="eyebrow">展示前的小準備</span><h2 id="setup-title">準備開始體驗</h2><p>連接您的感應裝置，或先使用模擬卡片熟悉流程。</p><label className="check-label"><input type="checkbox" checked={useMic} onChange={e=>setUseMic(e.target.checked)}/><span>同時啟用中文語音<small>首次下載模型；錄音只在本機處理。</small></span></label>{setupError&&<p className="form-error" role="alert">{setupError}</p>}<button className="button primary full" disabled={connecting} onClick={()=>void activate('hardware')}>{connecting?'連線中…':'連接感應裝置'}<ArrowRight/></button><button className="button secondary full" disabled={connecting} onClick={()=>void activate('simulation')}>先使用模擬展示</button><Link className="setup-link" href="/settings">設定商品與卡片 <ChevronRight size={16}/></Link></section></div>}
    {confirmReset&&<div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true" aria-labelledby="reset-title"><h2 id="reset-title">要重新開始嗎？</h2><p>目前的 {items} 件商品會從清單移除。</p><div className="modal-actions"><button className="button secondary" onClick={()=>setConfirmReset(false)}>繼續結帳</button><button className="button primary" disabled={resetting} onClick={()=>void reset()}>確認重新開始</button></div></section></div>}
    {tutorial&&<Tutorial initial={tutorial} onClose={()=>{setTutorial(null);voice.cancelSpeech();lastActivity.current=Date.now();}} onSpeak={text=>voiceRef.current.speak(text)}/>}
  </main>;
}
