import assert from 'node:assert/strict';
import test from 'node:test';
import { numberVoiceIds, voiceIdsForText, voiceLines } from '../src/lib/voiceClips';
import { answerHelp, stepMessage, type Intent } from '../src/lib/help';
import { defaultCatalog, type Checkout, type Stage } from '../src/lib/domain';

const ids = new Set(voiceLines.map(line => line.id));
test('every stage and help reply has a prepared audio script', () => {
  const stages: Stage[] = ['idle', 'welcome', 'tutorial-choice', 'scan', 'review', 'pay', 'complete'];
  const intents: Intent[] = ['scan', 'next', 'remove', 'total', 'pay', 'repeat', 'slow', 'unknown'];
  for (const stage of stages) {
    for (const hasItems of [false, true]) {
      for (const paymentMethod of [null, 'credit'] as const) {
        const state: Checkout = {
          stage, cart: hasItems ? [{productId:'milk',quantity:2}] : [], cursor:0,
          lastProductId:null, notice:'', transactionId:'test', completedAt:null, paymentMethod,
        };
        for (const text of [stepMessage(state), ...intents.map(intent => answerHelp(intent,state,defaultCatalog,'').text)]) {
          const files = voiceIdsForText(text);
          assert.ok(files?.length, `Missing prepared audio for ${text}`);
          for (const file of files) assert.ok(ids.has(file), `Missing script ID ${file}`);
        }
      }
    }
  }
});

test('number clips cover zeros and larger checkout totals', () => {
  assert.deepEqual(numberVoiceIds(0), ['number_0']);
  assert.deepEqual(numberVoiceIds(10), ['number_10']);
  assert.deepEqual(numberVoiceIds(105), ['number_1','number_100','number_0','number_5']);
  for (const value of [1, 19, 1005, 20408, 100000001, 297000000]) {
    for (const part of numberVoiceIds(value)) assert.ok(ids.has(part), `Missing number clip ${part}`);
  }
  assert.deepEqual(voiceIdsForText('目前共有 2 件商品，合計新臺幣 178 元。'), [
    'total_prefix','number_2','total_middle','number_1','number_100','number_7','number_10','number_8','total_suffix',
  ]);
});
