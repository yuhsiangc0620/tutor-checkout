'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MicVAD as MicVADType } from '@ricky0123/vad-web';
import { voiceFile, voiceIdsForText } from '@/lib/voiceClips';
export type VoiceStatus='off'|'loading'|'ready'|'listening'|'thinking'|'speaking'|'error';
export function useVoice(onTranscript:(text:string)=>void,active:boolean) {
  const [status,setStatus]=useState<VoiceStatus>('off');
  const [enabled,setEnabled]=useState(false);
  const [progress,setProgress]=useState('');
  const [error,setError]=useState('');
  const [speechAvailable,setSpeechAvailable]=useState(true);
  const [lastTranscript,setLastTranscript]=useState('');
  const [latency,setLatency]=useState<number|null>(null);
  const [backend,setBackend]=useState('');
  const callback=useRef(onTranscript); callback.current=onTranscript;
  const flags=useRef({active,enabled:false,ready:false,busy:false,speaking:false,loading:false}); flags.current.active=active;
  const vad=useRef<MicVADType|null>(null), worker=useRef<Worker|null>(null), stream=useRef<MediaStream|null>(null);
  const audio=useRef<HTMLAudioElement|null>(null),stopPart=useRef<(()=>void)|null>(null);
  const segmentTimer=useRef<ReturnType<typeof setTimeout>|null>(null), resultTimer=useRef<ReturnType<typeof setTimeout>|null>(null), speechTimer=useRef<ReturnType<typeof setTimeout>|null>(null);
  const generation=useRef(0), requestId=useRef(0), speechId=useRef(0);
  const discardResult=useRef(false);
  const slow=useRef(false), mounted=useRef(true);
  const canListen=()=>{const f=flags.current; return f.active&&f.enabled&&f.ready&&!f.busy&&!f.speaking;};
  const sync=useCallback(()=>{
    if(!mounted.current)return;
    const f=flags.current;
    stream.current?.getAudioTracks().forEach(t=>{t.enabled=f.enabled&&f.active;});
    if(canListen()) { void vad.current?.start().catch(()=>{setError('麥克風暫時無法啟動，請關閉後再開啟。');setStatus('error');});setStatus('ready'); }
    else { vad.current?.setOptions({submitUserSpeechOnPause:false});void vad.current?.pause(); if(segmentTimer.current)clearTimeout(segmentTimer.current);if(!f.speaking&&!f.busy&&!f.loading)setStatus('off'); }
  },[]);
  const speak=useCallback((text:string,slower=false)=>{
    if(typeof window==='undefined')return;
    const ids=voiceIdsForText(text);
    const id=++speechId.current;
    stopPart.current?.();
    if(speechTimer.current)clearTimeout(speechTimer.current);
    if(!ids?.length){setSpeechAvailable(false);flags.current.speaking=false;sync();return;}
    if(slower)slow.current=true;
    flags.current.speaking=true;sync();setStatus('speaking');
    void (async()=>{
      let completed=true;
      for(const part of ids){
        if(id!==speechId.current||!mounted.current){completed=false;break;}
        const clip=new Audio(voiceFile(part));
        clip.playbackRate=slow.current?0.8:1;
        audio.current=clip;
        const played=await new Promise<boolean>(resolve=>{
          let settled=false;
          const done=(ok:boolean)=>{if(settled)return;settled=true;clip.onended=null;clip.onerror=null;if(audio.current===clip)audio.current=null;stopPart.current=null;resolve(ok);};
          stopPart.current=()=>{clip.pause();done(false);};
          clip.onended=()=>done(true);
          clip.onerror=()=>done(false);
          void clip.play().catch(()=>done(false));
        });
        if(!played){completed=false;break;}
      }
      if(id!==speechId.current||!mounted.current)return;
      setSpeechAvailable(completed);
      if(!completed)setError('配音檔尚未放入，或瀏覽器暫時無法播放。請閱讀畫面文字。');
      speechTimer.current=setTimeout(()=>{flags.current.speaking=false;sync();},250);
    })();
  },[sync]);
  const initialize=useCallback(async()=>{
    if(flags.current.loading)return;
    if(flags.current.ready){flags.current.enabled=true;setEnabled(true);sync();return;}
    const token=++generation.current;flags.current.loading=true;flags.current.enabled=true;setEnabled(true);setError('');setStatus('loading');setProgress('準備麥克風…');
    try {
      worker.current?.terminate();await vad.current?.destroy();vad.current=null;stream.current?.getTracks().forEach(t=>t.stop());
      if(!navigator.mediaDevices?.getUserMedia)throw new Error('請以 HTTPS 或 localhost 開啟網頁，才能使用麥克風。');
      const media=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      if(token!==generation.current||!mounted.current){media.getTracks().forEach(t=>t.stop());return;}
      stream.current=media;
      const w=new Worker(new URL('../workers/whisper.worker.ts',import.meta.url));worker.current=w;
      const modelReady=new Promise<void>((resolve,reject)=>{
        const timer=setTimeout(()=>reject(new Error('模型載入逾時，請檢查網路後重試。')),180000);
        w.onerror=()=>{clearTimeout(timer);if(resultTimer.current)clearTimeout(resultTimer.current);if(!flags.current.ready)reject(new Error('無法啟動語音模型。'));else {flags.current.ready=false;flags.current.busy=false;flags.current.enabled=false;setEnabled(false);setError('語音模型已停止，請重新啟用麥克風。');sync();setStatus('error');}};
        w.onmessage=(event)=>{
          if(token!==generation.current||!mounted.current)return;
          const d=event.data;
          if(d.type==='progress')setProgress(d.detail.status==='progress'?`下載語音模型 ${Math.round(d.detail.progress??0)}%`:'準備語音模型…');
          if(d.type==='fallback')setProgress('切換相容辨識模式…');
          if(d.type==='ready'){clearTimeout(timer);setBackend(d.backend);resolve();}
          if(d.type==='error'){
            clearTimeout(timer);if(resultTimer.current)clearTimeout(resultTimer.current);
            if(!flags.current.ready)reject(new Error('模型無法載入，請檢查網路或改用 Chrome。'));
            else {flags.current.busy=false;setError('辨識失敗，請再說一次或點選協助。');sync();}
          }
          if(d.type==='result'&&d.id===requestId.current){
            if(resultTimer.current)clearTimeout(resultTimer.current);flags.current.busy=false;setLatency(d.ms);
            if(discardResult.current||!flags.current.enabled||!flags.current.active){sync();return;}
            const text=String(d.text??'').trim();setLastTranscript(text);sync();
            if(text)callback.current(text);else setError('沒有聽清楚，請再說一次。');
          }
        };
        w.postMessage({type:'init'});
      });
      // Attach a rejection handler immediately while the VAD module loads.
      void modelReady.catch(()=>{});
      const {MicVAD}=await import('@ricky0123/vad-web');
      const detector=await MicVAD.new({
        model:'v5',baseAssetPath:'/voice/',onnxWASMBasePath:'/voice/',startOnLoad:false,
        redemptionMs:1200,minSpeechMs:350,preSpeechPadMs:300,submitUserSpeechOnPause:false,
        ortConfig:(ort)=>{ort.env.wasm.numThreads=1;},
        getStream:async()=>media,pauseStream:async()=>{},resumeStream:async()=>media,
        onSpeechStart:()=>{
          if(!canListen())return;setStatus('listening');
          if(segmentTimer.current)clearTimeout(segmentTimer.current);
          segmentTimer.current=setTimeout(()=>{if(canListen()){vad.current?.setOptions({submitUserSpeechOnPause:true});void vad.current?.pause();}},15000);
        },
        onVADMisfire:()=>{if(segmentTimer.current)clearTimeout(segmentTimer.current);if(canListen())setStatus('ready');},
        onSpeechEnd:(audio)=>{
          if(segmentTimer.current)clearTimeout(segmentTimer.current);
          if(!canListen()||audio.length<5600)return;
          flags.current.busy=true;discardResult.current=false;sync();setStatus('thinking');
          const samples=audio.slice(0,240000);const id=++requestId.current;
          w.postMessage({type:'transcribe',audio:samples,id},[samples.buffer]);
          resultTimer.current=setTimeout(()=>{
            requestId.current++;flags.current.busy=false;flags.current.ready=false;flags.current.enabled=false;w.terminate();setEnabled(false);setError('這台裝置辨識較慢，請使用協助按鈕，或重新啟用語音。');sync();setStatus('error');
          },45000);
        },
      });
      if(token!==generation.current){await detector.destroy();return;}
      vad.current=detector;await modelReady;
      flags.current.ready=true;flags.current.loading=false;setProgress('');sync();
    } catch(e) {
      if(token!==generation.current||!mounted.current)return;
      flags.current.loading=false;flags.current.enabled=false;flags.current.ready=false;setEnabled(false);setStatus('error');
      setError(e instanceof DOMException&&e.name==='NotAllowedError'?'麥克風尚未獲得允許，您仍可點選協助按鈕。':e instanceof Error?e.message:'無法啟用語音');
      worker.current?.terminate();void vad.current?.destroy();vad.current=null;stream.current?.getTracks().forEach(t=>t.stop());
    }
  },[sync]);
  const toggle=()=>{if(flags.current.enabled){flags.current.enabled=false;setEnabled(false);discardResult.current=true;sync();}else void initialize();};
  const cancelSpeech=useCallback(()=>{speechId.current++;stopPart.current?.();if(speechTimer.current)clearTimeout(speechTimer.current);flags.current.speaking=false;sync();},[sync]);
  useEffect(()=>{if(!active)discardResult.current=true;sync();},[active,sync]);
  useEffect(()=>{mounted.current=true;const visible=()=>{if(document.hidden){flags.current.enabled=false;setEnabled(false);discardResult.current=true;cancelSpeech();sync();}};document.addEventListener('visibilitychange',visible);return()=>{mounted.current=false;generation.current++;document.removeEventListener('visibilitychange',visible);worker.current?.terminate();void vad.current?.destroy();stream.current?.getTracks().forEach(t=>t.stop());stopPart.current?.();[segmentTimer,resultTimer,speechTimer].forEach(t=>{if(t.current)clearTimeout(t.current);});};},[sync,cancelSpeech]);
  return {status,enabled,progress,error,initialize,toggle,speak,cancelSpeech,speechAvailable,lastTranscript,latency,backend};
}
