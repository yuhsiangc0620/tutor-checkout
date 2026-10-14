import { safeEqual, redisConfigured } from '@/lib/server/auth';
import { ingest } from '@/lib/server/store';
import { parseIncoming } from '@/lib/server/input';
export async function POST(request:Request) {
  const expected=process.env.DEVICE_TOKEN;
  if(!expected || !safeEqual(request.headers.get('authorization')??'',`Bearer ${expected}`)) return Response.json({error:'裝置驗證失敗'},{status:401});
  if(!redisConfigured()) return Response.json({error:'Redis 尚未設定'},{status:503});
  if(Number(request.headers.get('content-length'))>2048) return new Response(null,{status:413});
  let input;
  try { const raw=await request.text(); if(raw.length>2048) return new Response(null,{status:413}); input=parseIncoming(JSON.parse(raw),process.env.DEVICE_ID??'checkout-01'); }
  catch { return Response.json({error:'無效或過期的事件'},{status:400}); }
  try { return Response.json({ok:true,cursor:await ingest(input)}); }
  catch { return Response.json({error:'事件儲存暫時無法使用，請稍後重試'},{status:503}); }
}
