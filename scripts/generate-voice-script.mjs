import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const lines = JSON.parse(readFileSync(join(root, 'voice/lines.json'), 'utf8'));
const names = new Set();
for (const line of lines) {
  if (!/^[a-z0-9_]+$/.test(line.id) || !line.text || names.has(line.id)) throw new Error(`配音台詞 ID 重複或不正確：${line.id}`);
  names.add(line.id);
}
const groups = [
  ['流程與感應', lines.filter(line => /^(idle_|welcome$|tutorial_choice$|scan_intro$|review$|payment_|complete$|farewell$|scan_success$|rescue_|print_)/.test(line.id))],
  ['語音協助', lines.filter(line => line.id.startsWith('help_'))],
  ['卡片與商品提示', lines.filter(line => line.id.startsWith('notice_'))],
  ['三段教學', lines.filter(line => line.id.startsWith('tutorial_') && line.id !== 'tutorial_choice')],
  ['動態金額前後句', lines.filter(line => line.id.startsWith('total_'))],
  ['數字與位數', lines.filter(line => line.id.startsWith('number_'))],
];
const out = [
  '# 小智配音台詞',
  '',
  '以下是目前網頁會播放的全部預錄台詞。請在 VoAI「短篇配音」每次貼入一列「配音文字」，下載 MP3 後依「音檔檔名」命名，放入 `public/voice-lines/`。所有檔案盡量使用同一位聲音、相同語速與音量。',
  '',
  '「再說一次」會重播上一則音檔；「說慢一點」會以 0.8 倍速重播，不必另外生成。商品件數與總金額使用下方的短句和數字音檔即時組合。原始商品價格與件數仍由畫面計算。',
  '',
];
for (const [title, items] of groups) {
  out.push(`## ${title}`, '', '| 音檔檔名 | 配音文字 |', '| --- | --- |');
  for (const line of items) out.push(`| ${line.id}.mp3 | ${line.text.replaceAll('|', '\\|')} |`);
  out.push('');
}
out.push('所有台詞的唯一資料來源是 `voice/lines.json`。修改台詞後執行 `node scripts/generate-voice-script.mjs` 更新這份表格；文字若有更動，也要重新輸出相同檔名的音檔。');
writeFileSync(join(root, 'voice/配音台詞.md'), `${out.join('\n')}\n`);
