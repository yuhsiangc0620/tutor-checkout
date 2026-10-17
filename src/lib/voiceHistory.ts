export type VoiceExchange={id:string;at:number;source:'voice'|'test';transcript:string;reply:string};

const key='checkout-voice-history-v1';
const limit=20;

export function readVoiceHistory():VoiceExchange[]{
  try{
    const value=JSON.parse(sessionStorage.getItem(key)??'[]');
    if(!Array.isArray(value))return [];
    return value.filter((item):item is VoiceExchange=>
      item&&typeof item.id==='string'&&Number.isFinite(item.at)&&
      (item.source==='voice'||item.source==='test')&&
      typeof item.transcript==='string'&&typeof item.reply==='string'
    ).slice(0,limit);
  }catch{return [];}
}

export function recordVoiceExchange(source:VoiceExchange['source'],transcript:string,reply:string){
  const entry:VoiceExchange={id:crypto.randomUUID(),at:Date.now(),source,transcript:transcript.slice(0,500),reply:reply.slice(0,1000)};
  try{sessionStorage.setItem(key,JSON.stringify([entry,...readVoiceHistory()].slice(0,limit)));}catch{}
}

export function clearVoiceHistory(){try{sessionStorage.removeItem(key);}catch{}}
