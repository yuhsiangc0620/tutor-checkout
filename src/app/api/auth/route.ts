import { adminPassword, configured, createSession, safeEqual, sameOrigin } from '@/lib/server/auth';
import { cookies } from 'next/headers';
import { redis } from '@/lib/server/store';
import { redisConfigured } from '@/lib/server/auth';
import { createHash } from 'node:crypto';
export async function POST(request:Request) {
  if (!sameOrigin(request)) return Response.json({error:'來源不允許'},{status:403});
  if (!configured()) return Response.json({error:'尚未設定管理密碼，可先使用模擬展示。'},{status:503});
  try {
    if (redisConfigured()) {
      const ip=request.headers.get('x-forwarded-for')?.split(',')[0]??'local';
      const key=`login:${createHash('sha256').update(ip).digest('hex')}:${Math.floor(Date.now()/60000)}`;
      const n=await redis().incr(key); if(n===1) await redis().expire(key,120);
      if(n>10) return Response.json({error:'嘗試次數過多，請稍後再試。'},{status:429});
    }
    const {code}=await request.json();
    if(typeof code!=='string'||code.length>200||!safeEqual(code,adminPassword()!)) return Response.json({error:'管理密碼不正確。'},{status:401});
    (await cookies()).set('checkout-session',createSession(),{httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:12*3600});
    return Response.json({ok:true});
  } catch { return Response.json({error:'登入服務暫時無法使用。'},{status:503}); }
}
export async function DELETE(request:Request) { if(!sameOrigin(request)) return new Response(null,{status:403}); (await cookies()).delete('checkout-session'); return Response.json({ok:true}); }
