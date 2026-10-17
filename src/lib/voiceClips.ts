import lines from '../../voice/lines.json';

export type VoiceLine = { id: string; text: string };
export const voiceLines = lines as VoiceLine[];
const byText = new Map(voiceLines.map(line => [line.text, line.id]));
export const voiceFile = (id: string) => `/voice-lines/${id}.mp3`;

function underTenThousand(value: number): string[] {
  const digits = [1000, 100, 10, 1];
  const result: string[] = [];
  let gap = false;
  for (const unit of digits) {
    const digit = Math.floor(value / unit) % 10;
    if (!digit) { if (result.length) gap = true; continue; }
    if (gap && result.length) result.push('number_0');
    gap = false;
    if (!(unit === 10 && digit === 1 && result.length === 0)) result.push(`number_${digit}`);
    if (unit > 1) result.push(`number_${unit}`);
  }
  return result;
}

export function numberVoiceIds(value: number): string[] {
  if (!Number.isSafeInteger(value) || value < 0) return [];
  if (value === 0) return ['number_0'];
  const groups = [Math.floor(value / 100000000), Math.floor(value / 10000) % 10000, value % 10000];
  const units = ['number_100000000', 'number_10000', ''];
  const result: string[] = [];
  let gap = false;
  groups.forEach((group, index) => {
    if (!group) { if (result.length) gap = true; return; }
    if (result.length && (gap || group < 1000)) result.push('number_0');
    result.push(...underTenThousand(group));
    if (units[index]) result.push(units[index]);
    gap = false;
  });
  return result;
}

export function voiceIdsForText(text: string): string[] | null {
  const direct = byText.get(text);
  if (direct) return [direct];
  const total = /^目前共有\s*(\d+)\s*件商品，合計新臺幣\s*(\d+)\s*元。$/.exec(text);
  if (!total) return null;
  return ['total_prefix', ...numberVoiceIds(Number(total[1])), 'total_middle', ...numberVoiceIds(Number(total[2])), 'total_suffix'];
}
