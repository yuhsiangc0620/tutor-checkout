# 自助結帳裝置交接手冊

本手冊給接手者及協助她的 ChatGPT 使用。專案包含 Next.js 結帳網頁、ESP32 Arduino 程式與 Upstash Redis 事件資料庫。這是**模擬付款**，沒有真實扣款，也沒有使用 OpenAI API。可直接複製 [RECIPIENT_PROMPT.md](RECIPIENT_PROMPT.md) 給接手者的 ChatGPT。

## 交接前，原作者要交給接手者

1. 本專案的公開 GitHub 倉庫網址：[yuhsiangc0620/tutor-checkout](https://github.com/yuhsiangc0620/tutor-checkout)。倉庫根目錄是網頁專案，`firmware/CheckoutDevice/` 是獨立的 Arduino 草圖資料夾。
2. ESP32、已接妥的 PIR 與 RC522、USB 供電線，以及至少兩張可區分的 RFID 卡。告知接線表在 [README.md](README.md) 的「接線與 Arduino」。
3. 告知接手者哪些商品要綁定哪張卡、哪張卡用作付款。若她建立自己的 Upstash 資料庫，需要**重新登記**這些卡；GitHub 不會帶走現有資料庫內容。

不必交出原作者的 Vercel、Upstash 帳號或現有密鑰。交接者會用自己的帳號建立服務與新密鑰。分享 GitHub 前，確認 `.env.local`、`.env.display.local`、`firmware/CheckoutDevice/secrets.h` 和 `.vercel/` 沒有進入倉庫；它們已列入 `.gitignore`。`.env.example`、`firmware/CheckoutDevice/secrets.example.h` 才是可分享的範本。

## 接手者需要的帳號與設備

- 能讀取 GitHub 倉庫的 GitHub 帳號。
- 自己的 Vercel 與 Upstash 帳號，以及建立專案／資料庫的權限。
- 裝有 Arduino IDE 的電腦與 ESP32 USB 線；新場地可上網的 **2.4 GHz Wi-Fi**。
- 展示用電腦或平板的瀏覽器。要用語音時，需允許麥克風並等待第一次模型下載。

她的 ChatGPT 若可連接 GitHub 倉庫，就能閱讀程式與本手冊。能否直接建立 Vercel／Upstash 資源，取決於她的 ChatGPT 是否有對應工具、帳號連線與操作權限；缺少權限時，請它根據手冊帶她操作各服務介面，完成後再請它核對結果。

## 步驟一：建立 Vercel 網頁專案

1. 從 GitHub 匯入**整個倉庫**到接手者的 Vercel 帳號。框架選 Next.js；**Root Directory 選倉庫根目錄**，不是 `src/` 或 `firmware/`。Vercel 可由 Git 倉庫建立專案，並為主要分支建立正式部署。[Vercel Git 部署說明](https://vercel.com/docs/git)
2. 記下專案名稱；先不要將原作者目前的預覽網址填進 ESP32。接手者的長期展示應使用自己專案的固定網址。若第一次部署時尚未設定環境變數，網站可以建置，但實體裝置連線會提示服務未設定；完成步驟二、三後重新部署即可。
3. 後續所有環境變數須套用到**實際展示網址使用的環境**。例如使用正式網址就設定 Production；另外測試預覽版才設定 Preview。[Vercel 環境變數說明](https://vercel.com/docs/environment-variables)

## 步驟二：建立自己的 Upstash Redis

1. 在 Upstash 建立 Redis 資料庫，選擇適合展示地點的區域。使用可持續存在的資料庫，不要用短期試用資料庫。
2. 在資料庫頁面找到 **REST URL** 與 **REST Token**。[Upstash 取得 REST 憑證](https://upstash.com/docs/redis/howto/connect-with-upstash-redis)
3. 在 Vercel 專案環境變數填入 `UPSTASH_REDIS_REST_URL` 和 `UPSTASH_REDIS_REST_TOKEN`，值分別為上一步取得的 URL 與 Token。兩個值都要填，別把值提交到 GitHub。

也可以走 [Upstash 與 Vercel 的整合流程](https://upstash.com/docs/redis/howto/vercelintegration)，把 Redis 連到 Vercel 專案。整合完成後，**檢查實際注入的變數名稱**：本程式接受 `UPSTASH_REDIS_REST_URL`／`UPSTASH_REDIS_REST_TOKEN`，也接受 `KV_REST_API_URL`／`KV_REST_API_TOKEN`。使用一組完整且有值的 URL／Token 即可；重新部署後新變數才會生效。

## 步驟三：填入其餘 Vercel 設定

在 Vercel 專案環境變數新增下表，並套用到展示網址所用的環境。值由**接手者重新設定**，不要複製原作者的現有密鑰。

| 變數 | 接手者填入的內容 | 用在哪裡 |
|---|---|---|
| `ADMIN_PASSWORD` | 自訂的新管理密碼 | `/settings` 商品與卡片設定頁 |
| `SESSION_SECRET` | 至少 32 個隨機字元 | 網站簽署登入及結帳工作階段 |
| `DEVICE_ID` | `checkout-01`，或另一個自行決定的代號 | 與 ESP32 的 `DEVICE_ID` 一致 |
| `DEVICE_TOKEN` | 至少 32 個隨機字元，與 `SESSION_SECRET` **不同** | 網站辨識 ESP32；稍後寫入 Arduino `secrets.h` |
| Redis REST URL／Token | 步驟二取得的值 | 網站儲存商品設定與感測事件 |

可使用可信任的密碼管理工具產生隨機字元。請讓接手者在自己的 Vercel 帳號中輸入；不要把值貼到 ChatGPT 對話、GitHub、README 或截圖。設定後重新部署。`.env.example` 是變數名稱範本，並非現成憑證。

## 步驟四：重新設定並燒錄 ESP32

1. 在 Arduino IDE 安裝 **Espressif ESP32 開發板套件**、**MFRC522** 與 **ArduinoJson 7**。開啟 `firmware/CheckoutDevice/CheckoutDevice.ino`，板型選 **ESP32 Dev Module**，選對 USB 連接埠。
2. 將 `firmware/CheckoutDevice/secrets.example.h` 複製為同資料夾的 `secrets.h`，填入：
   - `WIFI_SSID`、`WIFI_PASSWORD`：新場地的 2.4 GHz Wi-Fi。
   - `EVENT_URL`：接手者的固定 Vercel 網址後加 `/api/device/events`，例如 `https://YOUR-SITE.vercel.app/api/device/events`。
   - `DEVICE_ID`、`DEVICE_TOKEN`：與步驟三在 Vercel 填入的值完全相同。
   - `VERCEL_BYPASS`：若使用受 Vercel 登入保護的預覽部署，需建立該專案自己的 Protection Bypass for Automation secret；可直接開啟的部署則留空。**不要使用原作者的預覽存取密鑰。**
3. 上傳草圖。以 **115200 鮑率**開啟 Arduino 序列埠，確認出現 `[WIFI] Connected` 和 `[SENT ...] OK`。ESP32 開機後 PIR 約需 10 秒暖機，HTTPS 傳送前還會等待網路校時。

`DEVICE_TOKEN` 是 ESP32 發送感測事件的身分證明，與 `ADMIN_PASSWORD` 不同。它同時存在 Vercel 和 ESP32，其他 Vercel 變數不需放進 Arduino。**更換 Vercel 網址、Wi-Fi 或裝置密鑰後都要重新燒錄 ESP32。**

## 步驟五：登記卡片並驗收

1. 瀏覽器開啟接手者的網站 `/settings`，用新 `ADMIN_PASSWORD` 登入。檢查「ESP32 裝置」最後回報時間有更新，以及 Redis 已設定。
2. 編輯示意商品名稱與單價並儲存。選一項商品，點「讀取下一張卡」，刷卡後點「確認登記」。再用**另一張卡**登記為「專用付款卡」。新 Redis 不會自動帶入原作者的卡片 UID。
3. 回結帳首頁，點「開始結帳」→「連接感應裝置」。**結帳訪客不用輸入密碼。**刷商品卡後，畫面應出現商品；點「確認並付款」後刷專用付款卡，畫面應顯示模擬完成。
4. 再試一次商品卡連刷、同卡貼住不重複加入、付款階段刷錯卡不完成、重新整理後清單保留，以及 ESP32 斷線後畫面的提示。若要用語音，另外在實際平板上測麥克風權限、中文辨識與朗讀。

### 常見卡點

| 現象 | 先檢查 |
|---|---|
| 網站出現 Vercel 登入頁 | 這是 Vercel 部署保護；改用接手者可直接開啟的網址，或依該專案設定預覽存取。管理密碼不能解除這一層登入。 |
| 按「連接感應裝置」後顯示服務未設定／503 | Vercel 的 `SESSION_SECRET`、Redis URL／Token 是否完整，是否套用正確環境並重新部署。 |
| Arduino 顯示 401 | `DEVICE_TOKEN`、`EVENT_URL` 或受保護預覽的 `VERCEL_BYPASS` 是否對應到接手者的新專案。 |
| Arduino 無法連上 Wi-Fi | 使用 2.4 GHz Wi-Fi，核對名稱與密碼，再重新燒錄。 |
| Arduino `[SENT ...] OK`，畫面卻沒有商品 | 先在 `/settings` 看最後回報與刷卡紀錄，再檢查卡片是否在**這個新資料庫**登記；確定首頁選的是「連接感應裝置」。 |

交接完成後，網站和資料庫由接手者的帳號維持運作。GitHub 保存的是程式與手冊，Upstash 保存的是展示資料；兩者需要分別準備。
