# 好好結帳｜AI 智慧導引自助結帳原型

繁體中文、平板橫向的互動結帳展示。畫面與流程依研究文件的「起始與教學 → 商品掃描與金額確認 → 選擇付款與感應 → 交易完成」四段設計。Next.js / TypeScript 網頁、ESP32 PIR / RC522 感測、Upstash Redis 事件中繼、瀏覽器 Whisper、預設協助及語音朗讀。**僅模擬付款，沒有實際扣款，也不呼叫 OpenAI API。**

## 本次交付

- [Vercel 預覽版](https://tutor-checkout-gf5rtkgp9-hsiang11.vercel.app)（需登入您的 Vercel 帳號）
- 結帳免輸入代碼；商品與卡片設定頁仍需管理密碼。現有部署沿用 `DEMO_CODE` 作為管理密碼，新部署請設定 `ADMIN_PASSWORD`。
- `firmware/CheckoutDevice/secrets.h` 已填入可繼續使用的事件網址、裝置密鑰與預覽存取密鑰，只需填 Wi-Fi 名稱與密碼。本次介面更新不需更改韌體事件網址。
- 預覽存取密鑰已依使用者授權建立，瀏覽器預覽登入保護仍保留。

## 先看畫面

```bash
npm ci
npm run dev
```

Chrome 開啟 http://localhost:3000，點「點我開始結帳」→「先使用模擬展示」。在畫面右上角「⋯」→「測試面板」點「有人靠近」可測歡迎畫面。接著點「點我開始結帳」，選擇是否看教學；感應商品後點「我要結帳」，確認金額，選付款方式，再感應展示付款卡。面板文字欄位只測試預設語意規則，**不代表 Whisper 已辨識音訊**。

模擬模式不需要 Redis。若只想先看結帳流程，可取消「同時啟用中文語音」。

## 平板介面

以橫向單頁設計：待機／歡迎（0%）→ 教學選擇 → 商品掃描與金額確認（33%）→ 選擇付款方式與感應（67%）→ 交易完成（100%）。掃描頁列出項次、品項、單價、數量與金額，底部固定合計與「取消交易／我要結帳」；按鈕後先確認金額。助理保留在右下角，卡關時依 15／25／30 秒提供安撫、詢問與側邊示範。

研究文件中的條碼紅光掃描器、真實支付設備和紙本出紙口是概念示意；現有硬體只有 PIR 與 RC522。因此商品以已登記 RFID 卡感應，三種付款方式是畫面上的展示選擇，均須使用另一張指定展示付款卡才會模擬成功。「列印明細」使用瀏覽器列印視窗，需要另外配置印表機。

## 完整展示步驟

1. 設定雲端環境變數與 ESP32 Wi-Fi、事件網址、裝置密鑰，燒錄整合程式。
2. 開啟 `/settings`，輸入管理密碼。
3. 設定商品名稱、說明、整數單價，點「儲存商品」。
4. 選商品用途，點「讀取下一張卡」，感應實體卡後「確認登記」。
5. 使用**另一張卡**，選「專用付款卡」並登記。同 UID 不能同時擔任商品與付款卡。
6. 回結帳頁，點「點我開始結帳」→「連接感應裝置」，無需輸入代碼。可允許麥克風並等待語音模型就緒。
7. PIR 感應到移動會進入歡迎畫面；點「點我開始結帳」後選擇「需要」或「不需要」教學，也可以不等 PIR 直接手動開始。
8. 感應商品卡並核對清單 → 點綠色「我要結帳」→ 確認商品與金額 → 選一種展示付款方式 → 感應指定付款卡 → 交易完成。點「結束交易」回待機，或用已設定的印表機列印明細。

商品設定在下一筆開始時重新取得；若清單仍為空且刷到對不上舊設定的卡，畫面也會更新設定後再判斷。已有商品的交易保留當時商品設定。設定與結帳畫面請由同一位操作者依序使用，預設只有一台 ESP32、一個操作中分頁。

待機畫面會顯示「實體感測模式 · 裝置已連線」或「模擬展示模式」。感測紀錄是後台已收到的歷史事件；結帳頁只接收連接感應裝置**之後**的新事件，且超過 10 秒的事件不會重新播放。若先前選了模擬展示，在待機畫面點右下角「⋯」→「切換感測模式」→「連接感應裝置」；交易中「⋯」位於右上角。測 PIR 時請先讓感測器回到低電位，再重新走近；持續站在前方不會產生新的上升沿事件。

## 環境設定與 Vercel

複製 `.env.example` 為 `.env.local`。本次建立的專案是 Vercel `hsiang11/tutor-checkout`，免費 Redis 是 `tutor-checkout-events`（東京），自動升級關閉。已產生的私人設定在 `.env.local`，請勿分享或提交。

| 變數 | 用途 |
|---|---|
| `ADMIN_PASSWORD` | 工作人員設定頁的管理密碼；舊部署可暫用 `DEMO_CODE` |
| `SESSION_SECRET` | 至少 32 字元的工作階段簽章密鑰 |
| `DEVICE_ID` | 預設 `checkout-01`，需與 ESP32 相同 |
| `DEVICE_TOKEN` | ESP32 傳送事件的獨立密鑰 |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | Upstash REST 憑證 |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | Vercel Marketplace 自動注入的等效名稱，程式也支援 |

雲端憑證只在後端；ESP32 的 `DEVICE_TOKEN` 必須與 Vercel 設定相同。結帳訪客可免密碼連接，但不能修改商品或卡片設定；訪客讀到的卡片 UID 會以代號表示。`.env.local`、韌體 `secrets.h`、`.vercel/` 已忽略提交。管理登入有效 12 小時；設定頁可登出。

```bash
vercel link --project tutor-checkout --scope hsiang11
vercel env pull .env.local --environment=development --yes
npm run build
vercel deploy --target=preview -y
```

環境變數變更後需重新部署。`env pull` 會覆寫同名檔案，先保留尚未上傳的自訂值。預覽 URL 若有 Vercel 登入保護，ESP32 必須在 `secrets.h` 填入專案的 Protection Bypass for Automation secret；不要把該密鑰放進網頁。無保護的預覽仍需 `DEVICE_TOKEN` 才能傳送事件，管理設定仍需密碼。

## 接線與 Arduino

板型選 **ESP32 Dev Module**。已依 ESP32-WROOM-32E / ESP32-E DevKit 配置。

| 模組腳位 | ESP32 |
|---|---|
| Keyestudio PIR S | GPIO27 |
| PIR V | 沿用已測通的 5V / VIN |
| PIR G | GND |
| RC522 3.3V | 3V3（不可接 5V） |
| RC522 GND | GND |
| RC522 SDA / SS | GPIO21 |
| RC522 RST | GPIO22 |
| RC522 SCK | GPIO18 |
| RC522 MISO | GPIO19 |
| RC522 MOSI | GPIO23 |
| RC522 IRQ | 不接 |

1. Arduino IDE 安裝 Espressif ESP32 開發板套件，程式庫安裝 **MFRC522**、**ArduinoJson 7**。
2. 開啟 `firmware/CheckoutDevice/CheckoutDevice.ino`。
3. 將同目錄的 `secrets.example.h` 複製成 `secrets.h`；若已產生 `secrets.h`，直接填入自己的 2.4 GHz Wi-Fi 名稱與密碼。
4. `EVENT_URL` 是 HTTPS 網址加 `/api/device/events`，`DEVICE_ID`、`DEVICE_TOKEN` 必須與伺服器相同。
5. 上傳後開 115200 鮑率序列埠，確認 `[WIFI] Connected`、`[SENT ...] OK`。
6. 開機 PIR 暖機 10 秒；NTP 校時成功後才傳 TLS。RC522 持續貼卡只送一次，移開約 0.45 秒後同卡再刷可加一件。

`root_ca.h` 提供 ISRG / GTS 根憑證，不關閉 TLS 驗證。若部署平台更換憑證鏈，先確認實際原因，再以 `node scripts/update-firmware-ca.mjs` 更新並重編譯。HTTP 401 請檢查裝置密鑰或 Vercel 預覽保護；503 檢查 Redis；負數錯誤先檢查 Wi-Fi、NTP 和 TLS。

感測迴圈與網路傳送分開執行。佇列 20 筆；同事件重試沿用 bootId/sequence。等待超過 10 秒就丟棄，序列埠提示重新感應。每 15 秒心跳，超過 45 秒畫面顯示等待裝置。PIR 沒動靜不代表使用者離開，不會自動清空交易。

## 語音行為

- Transformers.js 3.8.1，在 Worker 執行多語言 `onnx-community/whisper-base`，指定中文轉錄。
- WebGPU 使用 fp32 encoder + q4 decoder。全 q8 的 WebGPU 在這台測試機出現異常結果，因此保留 encoder 精度；仍使用量化 decoder。WebGPU 初始化失敗時切 WASM q8。
- 首次從 Hugging Face 下載模型並顯示進度，之後使用瀏覽器快取。下載時間及效能依裝置／網路而異。
- VAD 使用 Silero v5；停頓門檻 1.2 秒，最短 350 ms、最長一段 15 秒。一次僅辨識一段。朗讀前暫停 VAD、播完再恢復，並開啟回音消除。
- 語音不會直接刪商品、進入付款或付款；只解說、標示按鈕、播放教學。
- OpenCC 統一繁簡中文，移除標點，依 `src/lib/help.ts` 的詞句規則回覆。
- 朗讀優先台灣中文女聲，其次其他中文女聲與可用中文聲音。沒有中文聲音、麥克風遭拒、模型載入失敗或辨識不清時仍可使用文字與大型協助按鈕。
- 語音樣本在記憶體處理後釋放，不送伺服器、不儲存原始錄音。切到背景會關閉自動聆聽；回來後點麥克風重新啟用。
- 工作人員設定頁會顯示同一分頁最近 20 次「語音轉錄／測試輸入 → 助理回應」及時間，並可清除。這些文字只暫存在該分頁的 `sessionStorage`，不送到 Redis；換裝置或另開分頁看不到紀錄。
- 重新整理會保留本分頁的交易與游標；麥克風需再次點選開啟，瀏覽器仍可能要求使用者手勢才能朗讀。

可測句型：「怎麼掃商品」「接下來怎麼做」「取消上一件」「總共多少錢」「我要付款」「再說一次」「說慢一點」。英文或其他非預設問題會顯示可用協助項目。

## 事件協定

`POST /api/device/events`，header `Authorization: Bearer <DEVICE_TOKEN>`：

```json
{"deviceId":"checkout-01","bootId":"a1b2c3d4e5f60708","sequence":1,"type":"rfid_scanned","uid":"AABBCCDD","ageMs":20}
```

種類：`person_detected`、`rfid_scanned`、`heartbeat`。UID 支援 4 / 7 / 10 bytes。伺服器以 Lua 原子操作去重和分配游標；保留最近 500 筆事件、事件清單最多 24 小時。心跳不進交易事件清單。`GET /api/events?after=123` 每秒取得較新事件；`after=latest` 建立新的起點。

結帳畫面使用 `view=checkout` 取得卡片 UID 的代號，管理設定頁登入後才能查看原始 UID。重新開始會先取得最新游標；斷網時保留交易，恢復後超過 10 秒的事件不補加商品。若游標遺漏太久，提示核對清單並重新感應。模擬付款只存在同分頁工作階段，並非真實金流交易記錄。

## 可替換的位置

| 內容 | 檔案 |
|---|---|
| 商品預設資料、結帳狀態與卡片規則 | `src/lib/domain.ts` |
| 關鍵詞、同義句、預設協助文案 | `src/lib/help.ts` |
| 角色狀態與商品插圖 | `src/components/Artwork.tsx` |
| 起始角色原圖與四個透明示意動畫幀 | `public/reference-intro.png`、`public/assistant-poses.png` |
| 深綠外框、米白圓角、卡片教學動畫與平板橫向版面 | `src/app/flow.css` |
| 三段操作教學 | `src/components/Tutorial.tsx` |
| VAD／麥克風／朗讀 | `src/hooks/useVoice.ts` |
| Whisper 模型與推論 | `src/workers/whisper.worker.ts` |
| 卡片登記與連線紀錄 | `src/app/settings/page.tsx` |

## 驗證與限制

```bash
npm test
npm run typecheck
npm run build
# 先啟動 npm run start；下列測試使用 Mac 已安裝的 Google Chrome：
node tests/browser-smoke.mjs
node tests/relay-smoke.mjs
```

`relay-smoke.mjs` 對本機網站及 `.env.local` 的真實 Redis 測試，會暫時替換卡片登記並於結束還原，請勿與現場展示同時執行。語音測試 `tests/voice-smoke.mjs` 需要 `/private/tmp/tutor-voice-test.wav`，16 kHz 單聲道 PCM；可用 Mac `say` 產生「請問這些商品總共多少錢」後轉 WAV、前後加靜音。它驗證的是合成中文音訊，不能取代真人現場測試。

交給別人重新部署的步驟見 [HANDOFF.md](HANDOFF.md)。已完成與待驗收項目見 `VALIDATION.md`。請務必用實體卡測連刷、持續貼卡、移開再刷、斷網與 ESP32 重啟；用真人中文測七類協助、背景聲與喇叭回音。iPad 尺寸檢查僅驗證排版，真正 iPad 的麥克風、中文聲音與辨識速度仍需實機。

參考：原研究 PDF、[Whisper 模型](https://huggingface.co/onnx-community/whisper-base)、[Transformers.js 精度設定](https://huggingface.co/docs/transformers.js/en/guides/dtypes)、[瀏覽器語音清單](https://developer.mozilla.org/en-US/docs/Web/API/SpeechSynthesis/getVoices)。
