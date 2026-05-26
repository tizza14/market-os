# Market OS — Agent 派發指令（3 Waves）

**規格文件：** `/Users/tizza/Desktop/market-os-spec.md`  
**執行順序：** Wave 1 → 驗收 → Wave 2 → 驗收 → Wave 3 → 驗收  
**禁止平行：** 每個 wave 完成並通過驗收後才能啟動下一個

---

## Wave 1：基礎建設（Monorepo + 共用套件）

### 派發指令

```
角色：Senior TypeScript Engineer

請依照規格文件 /Users/tizza/Desktop/market-os-spec.md 完成 Wave 1：基礎建設。

【任務範圍】
1. 建立 monorepo 根目錄結構（第 17 節）
2. 設定 pnpm workspace（第 18.1 節）
3. 建立 packages/shared-types（第 10.5 節 + 第 18.6 節）
4. 建立 packages/config（含 REDIS_CHANNELS、SYMBOLS 等常數）
5. 設定 root tsconfig.base.json（第 18.7 節）
6. 建立 root .gitignore、.nvmrc、.dockerignore（第 19.5.4 節）
7. 建立各 app 的空殼資料夾與最小可運行 package.json
   - apps/market-data-service/src/main.ts → console.log("market-data-service started")
   - apps/api-gateway/src/main.ts → console.log("api-gateway started")
   - apps/frontend/ → vite + vue3 最小可啟動樣板

【明確禁止】
- 不要實作任何業務邏輯（Binance 連線、API handler、Vue component 等）
- 不要寫 Dockerfile（留到 Wave 3 整合時處理）
- 不要寫測試（留到對應 Wave 一起寫）
- 不要新增規格文件未列出的套件

【套件版本】
完全遵照第 18 節鎖定版本，不可自行升降版。

【驗收條件】
1. pnpm install 成功，產生 pnpm-lock.yaml
2. pnpm -r build 全 workspace 無 TypeScript error
3. 在 apps/api-gateway/src/main.ts 內 import 共用型別不報錯：
     import type { MarketTick } from '@market-os/shared-types'
4. pnpm --filter market-data-service dev 可印出 started 訊息
5. pnpm --filter api-gateway dev 可印出 started 訊息
6. pnpm --filter frontend dev 可啟動 vite 並訪問 http://localhost:5173

【回報項目】
- pnpm-lock.yaml 中關鍵套件實際安裝版本
- 是否有任何規格與實際相依性的衝突
- 建議補進規格的 Pattern（若有）
```

### 驗收 checklist（人工）

- [ ] `pnpm install` 無 ERR
- [ ] `pnpm -r build` 全綠
- [ ] `pnpm -r typecheck` 全綠（若已設定）
- [ ] `apps/api-gateway/src/main.ts` 可 import shared-types
- [ ] 三個 app 的 dev script 可獨立啟動
- [ ] `git status` 顯示 pnpm-lock.yaml 已產生
- [ ] 無多餘檔案（README 以外不應有額外 .md）

### 完成定義

✅ 三個服務都是「空殼」，但 monorepo 骨架已通電。

---

## Wave 2：後端資料流（Market Data Service + API Gateway）

### 前置條件

- ✅ Wave 1 全部驗收通過
- ✅ 本地已有 Docker，能啟動 `mongo:7` 與 `redis:7-alpine`

### 派發指令

```
角色：Senior Backend Engineer，熟悉即時資料流與量化系統

請依照規格文件 /Users/tizza/Desktop/market-os-spec.md 完成 Wave 2：後端資料流。

【前置確認】
Wave 1 已完成，monorepo 骨架可運行。
本地請先執行：docker run -d -p 27017:27017 mongo:7
              docker run -d -p 6379:6379 redis:7-alpine

【任務範圍】

A. apps/market-data-service
   1. Binance WebSocket 連線（第 8.1、8.4 節）
   2. Zod schema 驗證（第 8.5 節）
   3. 指數退避重連（第 8.3 節）
   4. Tick 寫入 MongoDB（第 6.1 節 schema + indexes）
   5. K 線聚合 + upsert（第 6.2 節 + 第 19.1.3 節）
   6. K 線重啟恢復邏輯（第 19.4 節）
   7. Redis Pub/Sub 發布（第 7 節）
   8. Graceful shutdown（第 8.6 節）
   9. Pino structured logging（第 11.3 節）

B. apps/api-gateway
   1. Fastify server + plugin 註冊（第 18.4 節）
   2. MongoDB / Redis plugin（連線管理）
   3. REST API（第 9.1 節三個 endpoint，含 error schema）
   4. WebSocket endpoint（第 9.2 節）
   5. Redis → WS broadcast 採 fan-out pattern（第 19.2 節）
   6. CORS + Rate Limiting（第 9.3、9.4 節）
   7. Graceful shutdown

C. Unit Tests（第 12.1 節）
   - binanceParser.spec.ts（6 條）
   - klineAggregator.spec.ts（8 條，含 string decimal 精度測試）
   - reconnectBackoff.spec.ts（9 條）
   - marketFormatter.spec.ts（3 條）
   - apiHandlers.spec.ts（10 條，使用 Fastify inject）

【明確禁止】
- 不要碰 apps/frontend
- 不要寫 Dockerfile（Wave 3 處理）
- 不要實作規格未列出的 endpoint
- 不要用 any，不要 magic string（第 15 節）
- Decimal 處理嚴格遵照第 19.1 節（不可用 parseFloat 或 Number 處理 price/quantity）

【實作 Pattern 必須遵守】
- 第 19.1 節：Decimal128 與 decimal.js 的使用規則
- 第 19.2 節：Redis Subscriber → WS Broadcast（fan-out 單例）
- 第 19.4 節：K 線重啟從 MongoDB 讀回未完成 K 線

【驗收條件】
1. pnpm --filter market-data-service test → 全綠
2. pnpm --filter api-gateway test → 全綠
3. pnpm -r typecheck → 全綠

4. 端到端手動驗證：
   a. 啟動 market-data-service，log 顯示 Binance WS 連線成功
   b. 等待 10 秒
   c. redis-cli SUBSCRIBE market:btcusdt → 收到即時 tick
   d. mongosh 進入 db.market_ticks.countDocuments() → > 0
   e. mongosh 進入 db.klines.find().sort({openTime:-1}).limit(1) → 看到當前分鐘 K 線
   f. 啟動 api-gateway
   g. curl http://localhost:3000/api/health → 200 services 全 connected
   h. curl http://localhost:3000/api/market/latest → 回傳最新價格
   i. curl http://localhost:3000/api/market/klines?limit=10 → 回傳 K 線陣列
   j. wscat -c ws://localhost:3000/ws/market → 持續收到 market:update 事件

5. 容錯驗證：
   a. 強制 kill market-data-service，5 秒後重啟 → log 顯示「Resumed in-progress kline」
   b. 強制斷網 30 秒再恢復 → 自動重連成功，無未捕獲例外
   c. 停止 Redis 後 → api-gateway /api/health 回 503，重啟 Redis 自動恢復

6. 精度驗證：
   db.klines.findOne() 內 price/volume 為 Decimal128 型別（非 Double）

【回報項目】
- 各 Unit Test 通過數 / 總數
- 端到端手動驗收的截圖或 log
- 實作過程發現的規格缺口（若有）
- Decimal 處理是否有遇到 MongoDB driver 的特殊行為
```

### 驗收 checklist（人工）

- [ ] 所有 unit test 通過（至少 36 條，見第 12.1 節）
- [ ] `tsc --noEmit` 全綠
- [ ] Binance WS 連線 log 出現
- [ ] MongoDB `market_ticks` 持續累加，**無重複 tradeId**
- [ ] MongoDB `klines` 每分鐘一根，`tradeCount > 0`
- [ ] Redis subscriber 收到訊息
- [ ] 三個 REST endpoint 回應符合 schema
- [ ] WebSocket 持續推送
- [ ] Kill 後重啟，K 線從 MongoDB 恢復
- [ ] 連續運行 10 分鐘無 unhandled rejection

### 完成定義

✅ 後端資料流完全打通，可獨立運作。Frontend 還沒做，但所有上游服務 ready。

---

## Wave 3：Frontend + Docker 整合

### 前置條件

- ✅ Wave 2 全部驗收通過
- ✅ market-data-service 與 api-gateway 持續穩定運行

### 派發指令

```
角色：Senior Frontend Engineer，熟悉 Vue 3 + ECharts，且具備 Docker 整合經驗

請依照規格文件 /Users/tizza/Desktop/market-os-spec.md 完成 Wave 3：前端 + Docker 整合。

【前置確認】
Wave 2 已完成，後端可獨立運作。
請先啟動：
  cd apps/market-data-service && pnpm dev &
  cd apps/api-gateway && pnpm dev &
確認 ws://localhost:3000/ws/market 可連線後再開始。

【任務範圍】

A. apps/frontend 業務邏輯
   1. Pinia store（第 10.4 節 MarketState）
   2. WebSocket service（第 19.3.3 節樣板，含重連 + ping）
   3. REST API client（fetch klines 初始資料）
   4. PriceCard 元件（第 10.2.1 節，含漲跌色彩、連線狀態）
   5. KlineChart 元件（第 10.2.2 節，ECharts candlestick + 即時更新）
   6. VolumeChart（成交量 bar，整合於 KlineChart 下方）
   7. DashboardView（路由 / 整合三個元件）
   8. TailwindCSS 設定（第 10.0 節，含 tailwind.config.js + postcss.config.js + main.css）
      - 使用規格定義的量化配色（price-up / price-down / bg-primary / bg-card）
      - ECharts 配色使用 CHART_COLORS 常數對齊 Tailwind（第 10.0 節）
   9. Vite proxy 設定（第 19.3.2 節）
   10. .env.example 與 .env.production（第 19.3.1 節）

B. Unit Tests
   - priceChange.spec.ts（第 12.1 節，5 條）

C. Dockerfile 整合
   1. apps/market-data-service/Dockerfile（第 19.5.1 節 multi-stage）
   2. apps/api-gateway/Dockerfile（同上樣板）
   3. apps/frontend/Dockerfile（第 19.5.2 節）
   4. apps/frontend/nginx.conf（第 19.5.3 節，含 WS upgrade）
   5. root docker-compose.yml（第 13 節，含 healthcheck 第 13.1 節）

【明確禁止】
- 不要更動 Wave 2 的後端程式碼（如發現缺陷，回報而非自行修改）
- 不要引入規格未列出的 UI 套件（例如 element-plus、naive-ui）
- 不要使用 any
- 不要直接操作 fetch 內的 price 為 number 顯示（必須走 decimal.js 或 string）
- 圖表更新時不可重繪整個圖（必須用 ECharts setOption 增量更新）

【實作 Pattern 必須遵守】
- 第 19.3 節：環境變數與 Vite proxy
- 第 19.3.3 節：WebSocket service 重連 + ping
- 第 5.1 節：price/quantity 維持 string，顯示層才轉 number

【驗收條件】
1. pnpm --filter frontend test → 全綠（5 條 priceChange 測試）
2. pnpm --filter frontend build → 無 vue-tsc 錯誤
3. 開發模式驗證：
   a. pnpm --filter frontend dev
   b. 訪問 http://localhost:5173
   c. 2 秒內顯示 K 線圖
   d. PriceCard 即時更新，價格漲綠跌紅
   e. 斷網 → 連線狀態顯示「重連中」
   f. 恢復網路 → 連線恢復，K 線無缺口
4. Docker Compose 驗證：
   a. docker compose build
   b. docker compose up -d
   c. 等待 30 秒
   d. docker compose ps → 所有服務 healthy
   e. 訪問 http://localhost:5173 → 同開發模式行為
   f. docker compose logs market-data-service → 無 error
5. 穩定性驗證：
   a. docker compose up 後連續運行 1 小時
   b. 觀察 docker stats → memory 穩定（無持續上升）
   c. mongosh → db.market_ticks.aggregate([{$group:{_id:"$tradeId",c:{$sum:1}}},{$match:{c:{$gt:1}}}]) 應為空（無重複）
   d. mongosh → db.klines.countDocuments() ≈ 運行分鐘數（±2）
6. Lighthouse Performance > 70（無痕視窗）

【回報項目】
- 所有驗收條件的執行結果
- 連續運行 1 小時的 memory / log 觀察結果
- Lighthouse 報告分數
- 若發現後端問題，列出但不自行修復
```

### 驗收 checklist（人工）

- [ ] 前端 unit test 全綠
- [ ] `vue-tsc` 全綠
- [ ] 開發模式（vite dev）可看到即時 K 線
- [ ] `docker compose up` 一鍵啟動成功
- [ ] 所有 healthcheck 通過
- [ ] PriceCard 漲跌色彩正確
- [ ] WebSocket 斷線顯示「重連中」
- [ ] K 線跨分鐘自動新增
- [ ] 連續運行 1 小時無 memory leak
- [ ] `market_ticks` 無重複 tradeId
- [ ] Lighthouse Performance > 70

### 完成定義

✅ 完整 MVP 跑通，可一鍵啟動，可對外 demo。Phase 1 結束。

---

## 三個 Wave 的依賴與時序

```
Wave 1（半天）
   ↓ 驗收通過
Wave 2（1–2 天）  ← 最重資 wave
   ↓ 驗收通過
Wave 3（1 天）
   ↓ 驗收通過
Phase 1 完成 ✅
```

---

## 通用規則（所有 Wave 共用）

### 1. Agent 不可自行修改規格

若實作中發現規格錯誤或不足：
- 回報問題給人類
- 等待規格更新後再實作
- 不要自行決策

### 2. 不可跨 Wave 修改

- Wave 2 不可改 Wave 1 的 monorepo 設定（如需，回報）
- Wave 3 不可改 Wave 2 的後端程式碼（如需，回報）

### 3. 規格優先順序

當規格內部出現衝突時，優先順序：
1. 第 4 節 NFR
2. 第 5 節 資料精度與品質
3. 第 19 節 實作 Pattern
4. 其他章節

### 4. Commit 規範

每完成一個 Wave 至少分為以下 commit（依第 15.5 節）：
- `chore:` 設定檔與依賴
- `feat:` 核心功能
- `test:` 測試
- `docs:` 若有補充規格

---

## 風險與緩解

| 風險 | 影響 Wave | 緩解 |
|---|---|---|
| Binance WS 在某地區被擋 | Wave 2 | 提供 mock server 替代方案 |
| pnpm workspace + Docker COPY 路徑問題 | Wave 3 | 採用第 19.5 節的 multi-stage 範例 |
| MongoDB Decimal128 序列化 bug | Wave 2 | 嚴格遵照第 19.1.4 節 toString() pattern |
| ECharts 即時更新效能差 | Wave 3 | 用 setOption 的 notMerge:false 增量更新 |

---

*文件版本：v1.0 | 最後更新：2026-05-25*
