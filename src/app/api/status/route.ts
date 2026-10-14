import { authorized, configured, redisConfigured } from '@/lib/server/auth';
export const dynamic='force-dynamic';
export async function GET() { return Response.json({configured:configured(),redisConfigured:redisConfigured(),authenticated:await authorized(),deviceId:process.env.DEVICE_ID??'checkout-01'}); }
