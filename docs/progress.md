# Market OS — 開發進度記錄

**最後更新：** 2026-05-27  
**當前狀態：** Phase 2 進行中（FinMind 台股整合完成）

---

## Git 狀態

| Branch | Commit | 說明 |
|---|---|---|
| `main` | `e4a5199` | Phase 2：台股公司名稱顯示（最新） |

**Remote：** `https://github.com/tizza14/market-os.git`

---

## Phase 1：完成 ✅（2026-05-27）

### Wave 1：Monorepo 骨架 ✅

- npm workspaces 正常運作
- `packages/shared-types`、`packages/config` 可被所有 apps import
- 三個 app 空殼可 `dev` 啟動
- TypeScript strict mode 全綠

### Wave 2：後端服務 ✅

**market-data-service：**

```
src/
├── schemas/binanceTrade.ts          ✅ Zod schema（b/a 欄位改為 optional）
├── services/tickProcessor.ts        ✅ formatTick()，輸出 ExtendedTick
├── services/klineAggregator.ts      ✅ 純函式 + KlineAggregator class
├── connectors/binanceWebSocket.ts   ✅ 指數退避重連
├── repositories/tickRepository.ts  ✅
├── repositories/klineRepository.ts ✅
├── publishers/redisPublisher.ts     ✅
└── main.ts                          ✅ 完整啟動邏輯、graceful shutdown
```

**api-gateway：**

```
src/
├── app.ts                       ✅ buildApp(deps) factory
├── services/marketBroadcast.ts  ✅ Redis fan-out → EventEmitter
├── schemas/queryParams.ts       ✅ KlinesQuerySchema (Zod)
├── handlers/health.ts           ✅ GET /api/health
├── handlers/market.ts           ✅ GET /api/market/latest、klines
├── handlers/websocket.ts        ✅ /ws/market（ping/pong）
└── main.ts                      ✅
```

**Unit Tests（Wave 2）：** 37/37 通過

### Wave 3：Frontend + Docker ✅

```
apps/frontend/src/
├── utils/priceChange.ts         ✅ calcPriceChange()
├── services/marketWebSocket.ts  ✅ 重連 + ping/pong
├── api/market.ts                ✅ fetchKlines()
├── stores/market.ts             ✅ Pinia store
├── components/PriceCard.vue     ✅
├── components/KlineChart.vue    ✅ ECharts K線 + 成交量
└── views/DashboardView.vue      ✅
```

**Docker Compose 驗收完成：**
- [x] `docker compose build` — 3 個映像全部成功
- [x] `docker compose up -d` — 5 個容器全部 healthy
- [x] http://localhost:5173 → dashboard 正常，K 線即時更新

---

## Phase 2：進行中 ⏳

### P2-1：多 K 線週期切換 ✅（2026-05-27）

**目標：** 在 BTC 儀表板新增 1m / 5m / 15m / 1h 切換按鈕。

**後端變更：**
- `packages/config` — `KLINE_INTERVALS` 加入 5m/15m/1h，新增 `KLINE_INTERVAL_MS`
- `klineAggregator` — `calcOpenTime / createKline / aggregateTick` 參數化，支援任意 intervalMs
- `market-data-service/main.ts` — 同時啟動 4 個 aggregator，每筆 tick 四週期並行聚合
- `api-gateway/queryParams.ts` — interval enum 擴展到四種週期

**前端變更：**
- `DashboardView` — 圖表上方加入週期按鈕（active 時 teal 底色）
- `store/market.ts` — `selectedInterval` + `setInterval()`，切換時重新拉取 K 線
- `KlineChart` — 1h 週期時間軸改顯示日期+時間

**Unit Tests：** 43/43（klineAggregator 新增 5m 跨週期邊界測試，+1 test）

---

### P2-2：FinMind 台股日 K 整合 ✅（2026-05-27）

**目標：** 新增台股查詢頁面，接入 FinMind TaiwanStockPrice API。

**新增檔案：**

```
apps/api-gateway/src/handlers/twStock.ts   ✅ GET /api/tw-stock/klines 代理路由
apps/frontend/src/stores/twStock.ts        ✅ Pinia store（symbol、days、klines）
apps/frontend/src/views/TwStockView.vue    ✅ 台股查詢頁面
apps/frontend/src/components/TwKlineChart.vue  ✅ 日 K 圖表
packages/shared-types/src/index.ts        ✅ 新增 TwStockKline 介面
```

**修改檔案：**
- `app.ts`、`main.ts` — 注入 finmindToken，註冊台股路由
- `apps/frontend/src/main.ts` — 新增 `/tw-stock` 路由
- `apps/frontend/src/App.vue` — 頂部導覽列（BTC 即時 / 台股日K）
- `docker-compose.yml` — 加入 `FINMIND_TOKEN` 環境變數（從根目錄 `.env` 讀取）

**功能：**
- 輸入任意台股代號（Enter 或按查詢）
- 60 / 120 / 240 日切換
- ECharts 日 K 線 + 成交量，風格與 BTC 一致
- 顯示最新收盤價、漲跌金額與漲跌幅

**API：** `GET /api/tw-stock/klines?symbol=2330&days=120`
- 後端代理 FinMind，Token 不暴露前端
- 回傳：`{ symbol, companyName, industry, data: TwStockKline[] }`

---

### P2-3：台股公司名稱與產業別 ✅（2026-05-27）

**目標：** 在台股頁面顯示公司中文名稱和產業類別。

**實作：**
- `twStock.ts` 新增 `TaiwanStockInfo` 查詢，以 `Map<stockId, { name, industry }>` 快取（24h TTL）
- 查詢 klines 時同步查公司名稱，一起回傳
- `TwStockView` 標頭顯示「公司名稱 代號 [產業]」三層資訊

**範例回應：**
```json
{ "symbol": "2330", "companyName": "台積電", "industry": "電子工業", "data": [...] }
```

---

## 已知問題與解法記錄

### 1. tsx ESM re-export 問題（Wave 1）

**問題：** `export * from './constants.js'` 在 tsx watch 模式下，Node.js v22 ESM 解析失敗。

**解法：** `packages/config` 和 `packages/shared-types` 改為直接 export，不用 re-export 中間層。

---

### 2. Binance trade stream 移除 b/a 欄位（Wave 2）

**問題：** Binance 移除 `b`（buyer order ID）和 `a`（seller order ID）欄位。

**解法：** `BinanceTradeSchema` 將 `b` 和 `a` 改為 `.optional()`。

---

### 3. packages main 指向 .ts 原始檔（Wave 3）

**問題：** Docker 生產環境中 Node.js 無法執行 .ts 檔案。

**解法：** 為 `packages/config` 和 `packages/shared-types` 加入 `tsconfig.json` + build script，`exports` 指向 `dist/*.js`。

---

### 4. api-gateway healthcheck wget 不可用（Wave 3）

**問題：** `node:20-alpine` 映像無 `wget`。

**解法：** 改用 `node -e "require('http').get(...)"` 進行健康檢查。

---

## 測試總覽

| 服務 | 測試數 | 狀態 |
|---|---|---|
| market-data-service | 27 | ✅ 全通過 |
| api-gateway | 11 | ✅ 全通過 |
| frontend | 5 | ✅ 全通過 |
| **合計** | **43** | ✅ |

---

## 開發環境資訊

| 項目 | 版本 |
|---|---|
| Node.js | v22.13.1（.nvmrc 指定 20，但 22 相容） |
| npm | 10.x |
| OS | Windows 11 |
| 專案路徑 | `~/Desktop/market-os` |

---

## 規格文件位置

| 文件 | 路徑 |
|---|---|
| 文件索引 | `docs/README.md` |
| API 契約 | `docs/spec/api.md` |
| 資料契約 | `docs/spec/data.md` |
| 外部 API | `docs/spec/external.md` |
| 系統架構 | `docs/design/architecture.md` |
| 設計決策 | `docs/design/decisions.md` |
| 開發流程 | `CONTRIBUTING.md`（root） |
| 本進度記錄 | `docs/progress.md`（本文件） |
