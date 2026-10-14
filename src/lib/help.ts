import { Converter } from 'opencc-js';
import { type Checkout, type Catalog, total, count } from './domain';
export type Intent = 'scan' | 'next' | 'remove' | 'total' | 'pay' | 'repeat' | 'slow' | 'unknown';
export type Help = { text: string; target?: 'scanner' | 'next' | 'remove' | 'total'; tutorial?: 'scan' | 'pay'; intent: Intent };
const traditional = Converter({ from: 'cn', to: 'tw' });
export const normalizeSpeech = (text: string) => traditional(text).replace(/[\p{P}\p{S}\s]/gu, '').toLowerCase();
// Edit these phrases and replies to change the assistant's behavior; no API required.
export const intentPhrases: Record<Exclude<Intent,'unknown'>, string[]> = {
  slow:['慢一點','慢點','太快','說慢','講慢','慢慢說','慢慢講','放慢','跟不上','來不及聽','不要講那麼快','不要說那麼快'],
  repeat:['再說','再講','重複','沒聽清','聽不清','再播一次','重播','再唸一次','再念一次','再解釋一次','剛剛說什麼','剛才說什麼','你說什麼','沒聽到','沒聽懂','聽不懂','再教一次'],
  remove:['取消','不要了','移除','刪掉','刪除','拿掉','退掉','這個不要','這件不要','這個不買','這件不買','不想買','少一件','減一件','減少數量','買太多','多刷一件','刷錯了','掃錯了','重複刷','重複掃','取消上一件','刪掉最後一件'],
  total:['多少錢','多少元','總共','總額','合計','幾件','多少件','幾個商品','多少個商品','一共多少','加起來多少','一共幾個','一共幾件','總金額','總價','要付多少','要繳多少','需要付多少','付多少錢','現在多少','目前多少','買了多少','買了幾樣','幾樣東西','算一下金額','看一下金額'],
  pay:['付款','付錢','結賬','結帳','買單','信用卡','付費','怎麼付','如何付','在哪裡付','在哪付','可以付了嗎','可以結了嗎','刷卡付','付款卡放哪','付款沒反應','付不了','付不出去','付好了嗎','付過了嗎','付成功了嗎','買好了','買完了','掃完了','都掃好了','商品都好了'],
  scan:['掃商品','掃描','感應商品','刷商品','掃碼','怎麼刷','如何刷','怎麼加','加入商品','讀不到','刷不到','掃不到','感應不到','感應不了','沒有感應','沒感應','卡片沒反應','讀卡機沒反應','讀卡器沒反應','商品沒出現','清單沒出現','商品放哪','商品卡放哪','卡片放哪','卡要放哪','靠哪裡','感應區在哪','讀卡器在哪','讀卡機在哪','怎麼感應','如何感應','如何加入','多加一件','再加一件','增加數量','還要一件','再買一個','再買一件','同一個商品','卡片要移開嗎'],
  next:['下一步','接下來','怎麼做','幫我','幫忙','不會','卡住','需要協助','需要幫助','怎麼用','如何使用','怎麼操作','如何操作','教我','教學','操作說明','不知道按哪','要按哪','按哪個','點哪裡','點哪個','現在要做什麼','然後呢','接著呢','下一個步驟','我該做什麼','開始使用','開始購物','怎麼開始','第一次用','第一次使用','看不懂','請協助'],
};
// Match specific phrases before short, generic words such as「結帳」or「幫我」.
const phraseRules = Object.entries(intentPhrases)
  .flatMap(([intent,phrases])=>phrases.map(phrase=>({intent:intent as Intent,phrase:normalizeSpeech(phrase)})))
  .sort((a,b)=>b.phrase.length-a.phrase.length);
export function findIntent(text: string): Intent {
  const normalized = normalizeSpeech(text);
  return phraseRules.find(rule=>normalized.includes(rule.phrase))?.intent ?? 'unknown';
}
export function stepMessage(state: Checkout): string {
  return ({ idle:'感應到有人靠近後，即可開始結帳。', welcome:'歡迎光臨，請點「開始結帳」。', scan:'商品卡靠近感應區，感應後移開。', review:'確認商品後，點「確認並付款」。', pay:'使用專用付款卡，感應後就完成了。', complete:'付款完成，記得帶好商品。' })[state.stage];
}
export function answerHelp(intent: Intent, state: Checkout, catalog: Catalog, previous: string): Help {
  if (intent === 'repeat' || intent === 'slow') return { intent, text: previous || stepMessage(state) };
  if (intent === 'total') return { intent, text:`目前共有 ${count(state)} 件商品，合計新臺幣 ${total(state,catalog)} 元。`, target:'total' };
  if (intent === 'remove') return { intent, text:state.cart.length ? (['scan','review'].includes(state.stage) ? '請找到想移除的商品，點旁邊的垃圾桶按鈕。我已幫您標出最近加入的商品。' : '請先點「返回商品清單」，再點商品旁的垃圾桶按鈕。') : '清單裡還沒有商品。您可以先感應商品卡。', target: ['scan','review'].includes(state.stage) ? 'remove' : 'next' };
  if (intent === 'scan' && state.stage === 'scan') return {intent,text:'把商品卡平放、靠近讀卡器，聽到提示後再移開。每次感應會加入一件商品。',target:'scanner',tutorial:'scan'};
  if (intent === 'pay') {
    if (!state.cart.length) return {intent,text:'請先點開始結帳並加入商品，確認清單後就可以付款。',target:'next'};
    if (state.stage === 'pay') return {intent,text:'請使用專用付款卡感應。看到「結帳完成」才表示這次模擬付款成功。',target:'scanner',tutorial:'pay'};
    if (state.stage === 'complete') return {intent,text:'這一筆已經完成模擬付款，不需要再感應。'};
    return {intent,text:state.stage === 'scan' ? '核對清單後，點「確認並付款」。' : '核對清單後，點「確認並付款」。',target:'next'};
  }
  if (intent === 'next' && state.stage === 'scan' && state.cart.length) return {intent,text:'商品都齊了，就點「確認並付款」。',target:'next'};
  if (intent === 'next' || intent === 'scan') return {intent,text:stepMessage(state),target:state.stage === 'scan' || state.stage === 'pay' ? 'scanner' : 'next'};
  return {intent:'unknown',text:'我還不太明白。您可以問我「怎麼掃商品」、「總共多少錢」或「接下來怎麼做」，也可以點下面的協助按鈕。'};
}
