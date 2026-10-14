import { authorized, authorizedCheckout, checkoutUid, denied, redisConfigured, sameOrigin } from '@/lib/server/auth';
import { getCatalog, putCatalog } from '@/lib/server/store';
import { validateCatalog } from '@/lib/domain';
export const dynamic='force-dynamic';
export async function GET(request:Request) {
  if(!await authorizedCheckout()) return denied();
  if(!redisConfigured()) return Response.json({error:'Redis 尚未設定'},{status:503});
  try {
    const catalog=await getCatalog();
    if(new URL(request.url).searchParams.get('view')!=='checkout' && await authorized()) return Response.json(catalog);
    return Response.json({...catalog,bindings:catalog.bindings.map(binding=>({...binding,uid:checkoutUid(binding.uid)}))});
  } catch {return Response.json({error:'無法讀取商品設定'},{status:503});}
}
export async function PUT(request:Request) {
  if(!sameOrigin(request)) return new Response(null,{status:403});
  if(!await authorized()) return denied();
  if(!redisConfigured()) return Response.json({error:'Redis 尚未設定'},{status:503});
  let catalog;
  try { const raw=await request.text(); if(raw.length>50000)return new Response(null,{status:413}); catalog=validateCatalog(JSON.parse(raw)); } catch {return Response.json({error:'商品資料不正確，或同一張卡已登記其他用途。'},{status:400});}
  try { await putCatalog(catalog); return Response.json({ok:true}); } catch {return Response.json({error:'儲存失敗，請重試。'},{status:503});}
}
