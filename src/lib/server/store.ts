import { Redis } from '@upstash/redis';
import { defaultCatalog, type Catalog, type DeviceEvent } from '../domain';
export function redis() { return new Redis({url:(process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL)!,token:(process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN)!}); }
const prefix=()=>`tutor:${process.env.DEVICE_ID ?? 'checkout-01'}`;
export type IncomingEvent = { deviceId:string; bootId:string; sequence:number; type:'heartbeat'|'person_detected'|'rfid_scanned'; uid?:string; ageMs:number };
// All writes happen atomically. A retried firmware packet retains its original cursor.
export const ingestScript = `
local old=redis.call('GET',KEYS[3])
redis.call('SET',KEYS[4],ARGV[1],'EX',120)
if old then return tonumber(old) end
if ARGV[2]=='heartbeat' then return 0 end
local n=redis.call('INCR',KEYS[2])
local e=cjson.encode({cursor=n,type=ARGV[2],uid=ARGV[3],receivedAt=tonumber(ARGV[1])})
redis.call('RPUSH',KEYS[1],e)
redis.call('LTRIM',KEYS[1],-500,-1)
redis.call('EXPIRE',KEYS[1],86400)
redis.call('SET',KEYS[3],n,'EX',86400)
return n`;
export async function ingest(input: IncomingEvent) {
  const p=prefix();
  return redis().eval<unknown[],number>(ingestScript,[`${p}:events`,`${p}:seq`,`${p}:dedup:${input.bootId}:${input.sequence}`,`${p}:lastSeen`],[Date.now(),input.type,input.uid??'']);
}
export async function readEvents(after: number | 'latest') {
  const p=prefix();
  const values=await redis().eval<unknown[],[number,string|null,string[]]>(`return {tonumber(redis.call('GET',KEYS[1]) or '0'),redis.call('GET',KEYS[2]) or '',redis.call('LRANGE',KEYS[3],0,-1)}`,[`${p}:seq`,`${p}:lastSeen`,`${p}:events`],[]);
  const [cursor,lastSeen,rows]=values;
  const all=rows.map(v => typeof v === 'string' ? JSON.parse(v) as DeviceEvent : v as DeviceEvent);
  const events=after==='latest'?[]:all.filter(e=>e.cursor>after);
  const gap=typeof after==='number' && after<cursor && (!all.length || all[0].cursor>after+1);
  return {cursor,events,lastSeen:Number(lastSeen)||null,gap};
}
export async function getCatalog(): Promise<Catalog> { return (await redis().get<Catalog>(`${prefix()}:catalog`)) ?? defaultCatalog; }
export async function putCatalog(catalog: Catalog) { await redis().set(`${prefix()}:catalog`,catalog); }
