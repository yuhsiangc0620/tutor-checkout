import { createGuestSession, redisConfigured, sameOrigin } from '@/lib/server/auth';
import { cookies } from 'next/headers';

export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({error:'來源不允許'},{status:403});
  if ((process.env.SESSION_SECRET?.length ?? 0)<32 || !redisConfigured())
    return Response.json({error:'感應裝置服務尚未設定，請使用模擬展示。'},{status:503});
  (await cookies()).set('checkout-guest',createGuestSession(),{
    httpOnly:true,sameSite:'strict',secure:process.env.NODE_ENV==='production',path:'/',maxAge:12*3600,
  });
  return Response.json({ok:true});
}
