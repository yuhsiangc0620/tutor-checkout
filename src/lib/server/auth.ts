import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
export const adminPassword = () => process.env.ADMIN_PASSWORD ?? process.env.DEMO_CODE;
export const configured = () => Boolean(adminPassword() && (process.env.SESSION_SECRET?.length ?? 0) >= 32);
export const redisConfigured = () => Boolean((process.env.UPSTASH_REDIS_REST_URL||process.env.KV_REST_API_URL) && (process.env.UPSTASH_REDIS_REST_TOKEN||process.env.KV_REST_API_TOKEN));
export function safeEqual(a: string, b: string) { const x = Buffer.from(a); const y = Buffer.from(b); return x.length === y.length && timingSafeEqual(x,y); }
function sign(value: string) { return createHmac('sha256',process.env.SESSION_SECRET ?? '').update(value).digest('base64url'); }
export function createSession() { const expiry = String(Date.now()+12*3600*1000); return `${expiry}.${sign(expiry)}`; }
export function createGuestSession() { const value = `guest:${Date.now()+12*3600*1000}`; return `${value}.${sign(value)}`; }
function validSession(token: string, prefix = '') {
  const [value,signature]=token.split('.');
  const expiry=prefix ? value?.startsWith(prefix) ? value.slice(prefix.length) : '' : value;
  return /^\d+$/.test(expiry ?? '') && Number(expiry)>Date.now() && safeEqual(signature ?? '',sign(value ?? ''));
}
export async function authorized() {
  if (!configured()) return false;
  const token=(await cookies()).get('checkout-session')?.value ?? '';
  return validSession(token);
}
export async function authorizedCheckout() {
  if (await authorized()) return true;
  if ((process.env.SESSION_SECRET?.length ?? 0)<32) return false;
  return validSession((await cookies()).get('checkout-guest')?.value ?? '', 'guest:');
}
export function sameOrigin(request: Request) {
  const origin=request.headers.get('origin');
  if(!origin)return true;
  // Next's internal URL can use 0.0.0.0/localhost behind the public host.
  try {const incoming=new URL(origin);return ['http:','https:'].includes(incoming.protocol)&&incoming.host===(request.headers.get('host')??new URL(request.url).host);}
  catch{return false;}
}
export const denied = () => Response.json({error:'請先登入管理設定。'},{status:401});
export function checkoutUid(uid: string) {
  return createHmac('sha256',process.env.SESSION_SECRET ?? '').update(uid).digest('hex').slice(0,16).toUpperCase();
}
