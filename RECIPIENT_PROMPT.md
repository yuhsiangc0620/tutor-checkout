# 貼給接手者 ChatGPT 的指令

請將下面整段複製到**接手者自己的 ChatGPT 對話**：

> 我已取得這個自助結帳專案的 GitHub 倉庫讀取權限：https://github.com/yuhsiangc0620/tutor-checkout 。請先閱讀倉庫根目錄的 `HANDOFF.md`、`README.md`、`.env.example`、`firmware/CheckoutDevice/secrets.example.h`，並核對程式實際使用的環境變數名稱。請協助我用**我自己的** Vercel 與 Upstash 帳號完成部署，再重新設定 ESP32。
>
> 請持續做到結帳首頁可免密碼連接、`/settings` 能用管理密碼登入、ESP32 序列埠出現 `[SENT ...] OK`、商品卡加入清單、專用付款卡完成模擬付款。每完成一階段告訴我已驗證的結果與下一步；若缺少 GitHub、Vercel、Upstash 或本機 Arduino 的工具／權限，請明確指出，並帶我在對應介面完成，完成後再接續驗證。
>
> 使用新的 `ADMIN_PASSWORD`、`SESSION_SECRET`、`DEVICE_TOKEN`，不要沿用原作者的值。密鑰請存入我的 Vercel 環境變數與本機被 Git 忽略的 Arduino `secrets.h`，不要提交到 GitHub，也不要在對話中顯示密鑰全文。請檢查正式部署環境有完整的 Upstash REST URL／Token，並用我自己的固定網址設定 ESP32 的 `EVENT_URL`。第一次部署若未設定好變數，完成設定後請重新部署。

若她的 ChatGPT 只有 GitHub **讀取**能力，仍可使用這段指令取得逐步協助；要代為建立雲端資源、修改倉庫或燒錄 ESP32，還需要它能存取對應帳號或本機環境。請勿把原作者的預覽網址當成接手者的新服務。
