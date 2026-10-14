'use client';
import { useEffect, useState } from 'react';
import { ArrowRight, Check, CreditCard, ScanLine, X } from 'lucide-react';
export function Tutorial({initial,onClose,onSpeak}:{initial:'all'|'scan'|'pay';onClose:()=>void;onSpeak:(text:string)=>void}) {
  const [step,setStep]=useState(initial==='pay'?2:0);
  const lessons=[{title:'把商品卡靠近感應區',text:'將商品卡靠近讀卡器，看到商品出現後再移開。',label:'感應商品'}, {title:'確認商品與數量',text:'檢查清單，可以調整數量，也可以移除不需要的商品。',label:'核對清單'}, {title:'使用專用付款卡',text:'進入付款畫面後，再將專用付款卡靠近讀卡器。',label:'感應付款'}];
  useEffect(()=>{onSpeak(lessons[step].text);/* narration follows the lesson */},[step]); // eslint-disable-line
  return <div className="modal-backdrop" role="presentation"><section className="tutorial modal" role="dialog" aria-modal="true" aria-labelledby="tutorial-title"><button className="icon-button modal-close" aria-label="關閉教學" onClick={onClose}><X/></button><span className="eyebrow">一步一步，跟著做</span><h2 id="tutorial-title">{lessons[step].title}</h2><div className={`tutorial-art lesson-${step}`}><div className="teaching-card"><CreditCard size={54}/><span>{step===2?'付款卡':'商品卡'}</span></div><div className="teaching-reader">{step===1?<Check size={48}/>:<ScanLine size={48}/>}<span>{lessons[step].label}</span></div></div><p>{lessons[step].text}</p><div className="tutorial-dots">{lessons.map((l,i)=><button key={i} className={step===i?'selected':''} aria-label={`教學 ${i+1}：${l.title}`} onClick={()=>setStep(i)}/>)}</div><div className="modal-actions"><button className="button secondary" onClick={()=>onSpeak(lessons[step].text)}>再聽一次</button><button className="button primary" onClick={()=>initial==='all'&&step<2?setStep(step+1):onClose()}>{initial==='all'&&step<2?'下一步':'我知道了'}<ArrowRight/></button></div></section></div>;
}
