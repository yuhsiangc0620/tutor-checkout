export type Stage = 'idle' | 'welcome' | 'tutorial-choice' | 'scan' | 'review' | 'pay' | 'complete';
export type PaymentMethod = 'mobile' | 'credit' | 'transit';
export type Product = { id: string; name: string; subtitle: string; price: number; art: 'milk' | 'apple' | 'bread' };
export type Binding = { uid: string; kind: 'product'; productId: string } | { uid: string; kind: 'payment' };
export type Catalog = { products: Product[]; bindings: Binding[] };
export type DeviceEvent = { cursor: number; type: 'person_detected' | 'rfid_scanned'; uid?: string; receivedAt: number };
export type CartLine = { productId: string; quantity: number };
export type Checkout = { stage: Stage; cart: CartLine[]; cursor: number; lastProductId: string | null; notice: string; transactionId: string; completedAt: number | null; paymentMethod: PaymentMethod | null };
export type Action = { type: 'EVENT'; event: DeviceEvent; catalog: Catalog } | { type: 'START' | 'TUTORIAL_DONE' | 'REVIEW' | 'BACK' | 'PAY' } | { type: 'SELECT_PAYMENT'; method: PaymentMethod } | { type: 'QUANTITY'; productId: string; delta: number } | { type: 'REMOVE'; productId: string } | { type: 'RESET'; cursor: number };
export const defaultCatalog: Catalog = {
  products: [
    { id: 'milk', name: '牧場鮮乳', subtitle: '每日新鮮・936 ml', price: 89, art: 'milk' },
    { id: 'apple', name: '青森蘋果', subtitle: '清甜爽脆・1 顆', price: 45, art: 'apple' },
    { id: 'bread', name: '原味吐司', subtitle: '柔軟厚切・1 袋', price: 65, art: 'bread' },
  ], bindings: [],
};
export const simulationCatalog: Catalog = { ...defaultCatalog, bindings: [
  { uid: 'DE000001', kind: 'product', productId: 'milk' },
  { uid: 'DE000002', kind: 'product', productId: 'apple' },
  { uid: 'DE000003', kind: 'product', productId: 'bread' },
  { uid: 'DEFFFFFF', kind: 'payment' },
] };
export const normalizeUid = (uid: string) => uid.replace(/[\s:-]/g, '').toUpperCase();
export const validUid = (uid: string) => /^(?:[0-9A-F]{8}|[0-9A-F]{14}|[0-9A-F]{20})$/.test(uid);
export const freshCheckout = (cursor = 0): Checkout => ({ stage: 'idle', cart: [], cursor, lastProductId: null, notice: '', transactionId: '', completedAt: null, paymentMethod: null });
export const total = (state: Checkout, catalog: Catalog) => state.cart.reduce((sum, line) => sum + (catalog.products.find(p => p.id === line.productId)?.price ?? 0) * line.quantity, 0);
export const count = (state: Checkout) => state.cart.reduce((n, item) => n + item.quantity, 0);
export const activeStage = (stage: Stage) => ['tutorial-choice', 'scan', 'review', 'pay'].includes(stage);
export function reduceCheckout(state: Checkout, action: Action): Checkout {
  switch (action.type) {
    case 'RESET': return freshCheckout(action.cursor);
    case 'START': return ['idle','welcome'].includes(state.stage) ? { ...state, stage: 'tutorial-choice', notice: '', transactionId: `TX-${Date.now()}`, completedAt: null, paymentMethod: null } : state;
    case 'TUTORIAL_DONE': return state.stage === 'tutorial-choice' ? { ...state, stage: 'scan', notice: '' } : state;
    case 'REVIEW': return state.stage === 'scan' && state.cart.length ? { ...state, stage: 'review', notice: '' } : state;
    case 'BACK': return state.stage === 'pay' ? {...state,stage:'review',paymentMethod:null,notice:''} : state.stage === 'review' ? {...state,stage:'scan',notice:''} : state;
    case 'PAY': return state.stage === 'review' && state.cart.length ? { ...state, stage: 'pay', paymentMethod: null, notice: '' } : state;
    case 'SELECT_PAYMENT': return state.stage === 'pay' ? {...state,paymentMethod:action.method,notice:''} : state;
    case 'REMOVE': return state.stage === 'scan' ? { ...state, cart: state.cart.filter(l => l.productId !== action.productId), notice: '已移除這項商品。', lastProductId: null } : state;
    case 'QUANTITY': {
      if (state.stage !== 'scan') return state;
      return { ...state, cart: state.cart.map(l => l.productId === action.productId ? { ...l, quantity: Math.max(1, Math.min(99, l.quantity + action.delta)) } : l), notice: '' };
    }
    case 'EVENT': {
      if (action.event.cursor <= state.cursor) return state;
      const next = { ...state, cursor: action.event.cursor };
      if (action.event.type === 'person_detected') return state.stage === 'idle' ? { ...next, stage: 'welcome', notice: '' } : next;
      if (!['scan', 'review', 'pay'].includes(state.stage)) return next;
      const binding = action.catalog.bindings.find(b => b.uid === normalizeUid(action.event.uid ?? ''));
      if (!binding) return { ...next, notice: '這張卡還沒有設定，請換一張商品卡或請工作人員協助。' };
      if (state.stage === 'pay') {
        if (!state.paymentMethod) return { ...next, notice: '請先選擇付款方式，再感應展示付款卡。' };
        return binding.kind === 'payment' ? { ...next, stage: 'complete', completedAt: action.event.receivedAt, notice: '' } : { ...next, notice: '這是商品卡。請使用專用展示付款卡感應。' };
      }
      if (binding.kind === 'payment') return { ...next, notice: '請先確認商品，再進入感應付款。' };
      if (state.stage === 'review') return { ...next, notice: '請先確認金額；如需補掃商品，請點「否」。' };
      const product = action.catalog.products.find(p => p.id === binding.productId);
      if (!product) return { ...next, notice: '商品資料不存在，請工作人員協助。' };
      const found = next.cart.find(l => l.productId === product.id);
      if (found && found.quantity >= 99) return { ...next, notice: '這項商品已達 99 件。' };
      return { ...next, cart: found ? next.cart.map(l => l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l) : [...next.cart, { productId: product.id, quantity: 1 }], lastProductId: product.id, notice: `已加入${product.name}。` };
    }
  }
}
export function validateCatalog(input: unknown): Catalog {
  const c = input as Catalog;
  if (!c || !Array.isArray(c.products) || !Array.isArray(c.bindings) || c.products.length < 1 || c.products.length > 30 || c.bindings.length > 100) throw new Error('商品或卡片數量不正確');
  const ids = new Set<string>(); const uids = new Set<string>();
  for (const p of c.products) {
    if (!p || typeof p.id !== 'string' || !/^[a-z0-9_-]{1,32}$/.test(p.id) || ids.has(p.id) || typeof p.name !== 'string' || !p.name.trim() || p.name.length > 40 || typeof p.subtitle !== 'string' || p.subtitle.length > 80 || !Number.isInteger(p.price) || p.price < 0 || p.price > 100000 || !['milk','apple','bread'].includes(p.art)) throw new Error('商品名稱、價格或識別碼不正確');
    ids.add(p.id);
  }
  for (const b of c.bindings) {
    if (!b || typeof b.uid !== 'string' || !validUid(b.uid) || uids.has(b.uid) || !['product','payment'].includes(b.kind) || (b.kind === 'product' && !ids.has(b.productId))) throw new Error('卡片重複、UID 格式不正確，或商品不存在');
    uids.add(b.uid);
  }
  return { products: c.products.map(p => ({ id:p.id, name:p.name.trim(), subtitle:p.subtitle, price:p.price, art:p.art })), bindings:c.bindings.map(b => b.kind === 'payment' ? {uid:b.uid,kind:'payment'} : {uid:b.uid,kind:'product',productId:b.productId}) };
}
