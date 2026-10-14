import { authorized, authorizedCheckout, checkoutUid, denied, redisConfigured } from '@/lib/server/auth';
import { readEvents } from '@/lib/server/store';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  if(!await authorizedCheckout()) return denied();
  if(!redisConfigured()) return Response.json({error:'Redis 尚未設定，請先在設定頁完成連線。'},{status:503});
  const raw=new URL(request.url).searchParams.get('after')??'latest';
  if(raw!=='latest' && !/^\d{1,15}$/.test(raw)) return Response.json({error:'游標格式不正確'},{status:400});
  try {
    const data=await readEvents(raw==='latest'?'latest':Number(raw));
    if(new URL(request.url).searchParams.get('view')!=='checkout' && await authorized()) return Response.json(data);
    return Response.json({...data,events:data.events.map(event=>({...event,uid:event.uid?checkoutUid(event.uid):undefined}))});
  }
  catch { return Response.json({error:'暫時無法取得感測資料，請檢查連線。'},{status:503}); }
}
