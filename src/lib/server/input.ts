import { normalizeUid, validUid } from '../domain';
import type { IncomingEvent } from './store';
export function parseIncoming(value: unknown, deviceId: string): IncomingEvent {
  const v=value as IncomingEvent;
  if (!v || v.deviceId!==deviceId || typeof v.bootId!=='string' || !/^[a-zA-Z0-9-]{8,64}$/.test(v.bootId) || !Number.isSafeInteger(v.sequence) || v.sequence<1 || !['heartbeat','person_detected','rfid_scanned'].includes(v.type) || !Number.isFinite(v.ageMs) || v.ageMs<0 || v.ageMs>10000) throw new Error('事件格式或時效不正確');
  const uid=typeof v.uid==='string'?normalizeUid(v.uid):undefined;
  if (v.type==='rfid_scanned' && (!uid || !validUid(uid))) throw new Error('UID 格式不正確');
  return {deviceId:v.deviceId,bootId:v.bootId,sequence:v.sequence,type:v.type,ageMs:v.ageMs,uid};
}
