# Market OS — 開發進度記錄

**最後更新：** 2026-05-27  
**當前狀態：** Phase 3 主要功能完成（P3-1 / P3-3 / P3-4 / P3-5 / 風險指標 / RSI策略 / 參數最佳化）

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

## Phase 3：進行中 ⏳

### P3-5：歷史資料回填 ✅（2026-05-27）

**目標：** 服務啟動時自動從 Binance REST 回填 500 筆歷史 K 線，確保回測有足夠資料。

**新增檔案：**
- `apps/market-data-service/src/services/historicalDataService.ts` — `backfillKlines()`：啟動時呼叫，4 個週期並行，跳過未收盤蠟燭

**修改檔案：**
- `apps/market-data-service/src/repositories/klineRepository.ts` — 新增 `findLatestOpenTime()` / `bulkUpsert()` / `countBySymbolInterval()`
- `apps/market-data-service/src/main.ts` — 啟動後 `Promise.allSettled` 並行回填

**關鍵邏輯：**
- `count < 500` 時直接抓最新 500 筆（忽略現有資料，覆蓋補齊）
- `count >= 500` 時改為缺口補齊模式（startTime = latestOpenTime + 1）
- 回填失敗不影響服務啟動（`allSettled`）

**驗收：** 4 個週期各 499 筆成功儲存，`/api/backtest` 回傳 17 筆交易完整結果

---

### P3-3：資金曲線視覺化 ✅（2026-05-27）

**目標：** 回測結果新增資金曲線圖，讓用戶直觀看到策略績效隨時間變化。

**新增檔案：**
- `apps/frontend/src/components/EquityCurveChart.vue` — ECharts 折線圖，Y 軸顯示累積報酬率（%），依最終損益自動配色（綠/紅），含保本線（markLine）
- `apps/frontend/src/components/BacktestPanel.vue` — 回測結果面板：5 個指標卡 + 資金曲線 + 交易明細表

**修改檔案：**
- `packages/shared-types/src/index.ts` — 新增 `EquityPoint` / `BacktestTrade` / `BacktestMetrics` / `BacktestResult` 介面
- `apps/api-gateway/src/services/backtestService.ts` — `calcMetrics()` 改回傳 `{ metrics, equityCurve }` 物件

**展示資料：**
- 指標卡：總報酬、交易次數、勝率、最大回撤、平均每筆報酬
- 曲線：以 1.0 為基準，每筆賣出後更新一個點
- 交易表：日期、方向、買/賣價、損益、輸贏

---

### P3-4：可調指標參數 ✅（2026-05-27）

**目標：** 讓用戶在 UI 上自訂 SMA / EMA 週期（5~100），動態驅動回測。

**修改檔案（後端）：**
- `apps/api-gateway/src/schemas/queryParams.ts` — `BacktestQuerySchema` 加入 `smaPeriod` / `emaPeriod`（預設 20，range 5-100）
- `apps/api-gateway/src/services/backtestService.ts` — `runMACross` / `runMACrossTw` 接受 `BacktestOptions` 可選參數
- `apps/api-gateway/src/handlers/backtest.ts` — 從 query string 傳入 smaPeriod/emaPeriod
- `apps/api-gateway/src/handlers/twStock.ts` — `/api/tw-stock/backtest` 同樣支援參數

**修改檔案（前端）：**
- `DashboardView.vue` / `TwStockView.vue` — SMA/EMA 數字輸入框，切換週期或股票代號時自動清空回測
- `stores/backtest.ts` / `stores/twBacktest.ts` — `run()` 帶入 smaPeriod/emaPeriod 參數

---

### C：參數最佳化掃描 ✅（2026-05-27）

**目標：** 批次跑多組 SMA × EMA 組合，找出指定指標最佳的參數，以熱力圖呈現。

**新增檔案：**
- `apps/api-gateway/src/handlers/optimize.ts` — `GET /api/backtest/optimize`
- `apps/frontend/src/components/OptimizePanel.vue` — ECharts 熱力圖（X軸EMA、Y軸SMA、顏色深淺=指標值）
- `apps/frontend/src/stores/optimize.ts` / `twOptimize.ts` — Pinia store

**修改檔案：**
- `packages/shared-types` — 新增 `OptimizeResult` / `OptimizeCell` 介面
- `schemas/queryParams.ts` — 新增 `OptimizeQuerySchema`（smaMin/Max/Step、emaMin/Max/Step、metric）
- `backtestService.ts` — 新增 `runOptimize` / `runOptimizeTw`
- `handlers/twStock.ts` — 新增 `/api/tw-stock/optimize` 路由
- `DashboardView` / `TwStockView` — 新增「最佳化」按鈕（琥珀色），點擊後顯示熱力圖面板

**掃描規格（預設）：** SMA 10~50 步距5、EMA 10~50 步距5 = **81 組合**  
**可選指標：** totalReturn（總報酬）/ winRate（勝率）/ sharpeRatio（Sharpe Ratio）  
**驗收：** 9×9=81 cells，best=SMA30×EMA45=+3%（1h 週期實測）

---

### A：RSI 回測策略 ✅（2026-05-27）

**目標：** 新增第二種回測策略，讓用戶比較 MA 交叉 vs RSI 超買超賣的績效差異。

**訊號規則：**
- 買進：RSI 從 ≤30 升破 30（超賣回升）
- 賣出：RSI 從 ≥70 跌破 70（超買回落）

**修改檔案：**
- `backtestService.ts` — 新增 `findRSISignals` / `runRSI` / `runRSITw`
- `schemas/queryParams.ts` / 兩個 handler — `strategy` 欄位（ma_cross | rsi）
- 前端兩個 view — `MA交叉` / `RSI` 切換按鈕（紫色）；選 MA 交叉時才顯示 SMA/EMA 輸入欄
- `BacktestPanel.vue` — 標題動態顯示策略名稱

---

### B：風險指標擴充 ✅（2026-05-27）

**目標：** 在回測面板新增 Sharpe Ratio 和 Calmar Ratio。

- **Sharpe Ratio** = 平均每筆報酬 ÷ 標準差（越高代表報酬/風險比越好）
- **Calmar Ratio** = 總報酬 ÷ 最大回撤絕對值（越高代表相對回撤產生的報酬越多）

**修改檔案：**
- `shared-types` — `BacktestMetrics` 加入 `sharpeRatio` / `calmarRatio`
- `backtestService.ts` — `calcMetrics` 計算兩個指標 + `stddev()` 輔助函式
- `BacktestPanel.vue` — 指標卡從 5 張擴充到 7 張

---

### P3-1：技術指標層 ✅（2026-05-27）

**目標：** 後端計算 SMA20 / EMA20 / RSI14，與 K 線資料一起回傳，前端疊加在圖表上。

**新增檔案：**
- `apps/api-gateway/src/services/indicatorService.ts` — 純函式：`calcSMA / calcEMA / calcRSI / calcIndicators`
- `apps/api-gateway/src/services/indicatorService.spec.ts` — 12 個單元測試

**修改檔案：**
- `packages/shared-types/src/index.ts` — 新增 `IndicatorResult` 介面
- `apps/api-gateway/src/handlers/market.ts` — `/api/market/klines` 回應加入 `indicators` 欄位
- `apps/frontend/src/api/market.ts` — `fetchKlines` 回傳完整 `KlinesResponse`（含 indicators）
- `apps/frontend/src/stores/market.ts` — 新增 `indicators` 狀態
- `apps/frontend/src/components/KlineChart.vue` — SMA20/EMA20 疊加線 + RSI14 面板（有資料時自動顯示）
- `apps/frontend/src/views/DashboardView.vue` — 傳入 `indicators` prop，圖表高度調整為 560px

**指標計算規格：**
- SMA(20)：前 20 筆收盤均值，不足 20 筆回傳 null
- EMA(20)：以 SMA 為種子，k=2/21，不足 20 筆回傳 null
- RSI(14)：Wilder smoothing，不足 15 筆回傳 null，全漲=100、全跌=0

**Unit Tests：** 55/55（+12 tests）

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
| market-data-service | 29 | ✅ 全通過 |
| api-gateway | 45 | ✅ 全通過 |
| frontend | 0 | ✅（無測試） |
| **合計** | **74** | ✅ |

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
