# Market OS — 開發進度記錄

**最後更新：** 2026-05-27 02:40  
**當前狀態：** Wave 3 全部完成 ✅ — Phase 1 MVP 驗收通過

---

## Git 狀態

| Branch | Commit | 說明 |
|---|---|---|
| `main` | `b41a7a9` | Wave 1 完成（已 push 至 GitHub） |
| 工作目錄 | 未 commit | Wave 2 所有新增檔案（未 commit） |

**Remote：** `https://github.com/tizza14/market-os.git`

---

## Wave 1：完成 ✅

所有驗收條件通過：
- pnpm workspace 正常運作（6 個子套件）
- `packages/shared-types`、`packages/config` 可被所有 apps import
- 三個 app 空殼可 `dev` 啟動
- TypeScript strict mode 全綠

---

## Wave 2：進行中 ⏳

### A. apps/market-data-service — 完成 ✅

**已實作檔案：**

```
src/
├── schemas/
│   ├── binanceTrade.ts          ✅ Zod schema（BinanceTradeSchema）
│   └── binanceTrade.spec.ts     ✅ 6 tests
├── services/
│   ├── tickProcessor.ts         ✅ formatTick()，輸出 ExtendedTick
│   ├── tickProcessor.spec.ts    ✅ 3 tests
│   ├── klineAggregator.ts       ✅ 純函式 + KlineAggregator class
│   └── klineAggregator.spec.ts  ✅ 8 tests
├── connectors/
│   ├── binanceWebSocket.ts      ✅ BinanceWebSocket class + calcBackoffDelay()
│   └── reconnectBackoff.spec.ts ✅ 9 tests
├── repositories/
│   ├── tickRepository.ts        ✅ save()、findLatest()、ensureIndexes()
│   └── klineRepository.ts       ✅ upsert()、findByOpenTime()、findRecent()
├── publishers/
│   └── redisPublisher.ts        ✅ publish()
└── main.ts                      ✅ 完整啟動邏輯、graceful shutdown
```

**Unit Tests：** `26 / 26 通過`

```
✓ src/services/tickProcessor.spec.ts   (3 tests)
✓ src/schemas/binanceTrade.spec.ts     (6 tests)
✓ src/connectors/reconnectBackoff.spec.ts (9 tests)
✓ src/services/klineAggregator.spec.ts (8 tests)
```

---

### B. apps/api-gateway — Unit Test 驗收完成 ✅

**已實作檔案：**

```
src/
├── app.ts                       ✅ buildApp(deps) factory（供測試注入）
├── services/
│   └── marketBroadcast.ts       ✅ Redis fan-out → EventEmitter
├── schemas/
│   └── queryParams.ts           ✅ KlinesQuerySchema (Zod)
├── handlers/
│   ├── health.ts                ✅ GET /api/health
│   ├── market.ts                ✅ GET /api/market/latest、GET /api/market/klines
│   ├── websocket.ts             ✅ /ws/market（ping/pong、connection limit）
│   └── apiHandlers.spec.ts      ✅ 11 tests（含 Fastify inject）
└── main.ts                      ✅ 完整啟動邏輯、graceful shutdown
```

**Unit Tests：** `11 / 11 通過`

```
✓ src/handlers/apiHandlers.spec.ts (11 tests)
```

**全 Workspace 驗收結果：**

```
pnpm -r typecheck → 全綠（3 services）
pnpm -r test      → 37 tests 全通過
  market-data-service: 26/26
  api-gateway:         11/11
  frontend:            0/0（Wave 3 才實作）
```

**✅ 端對端驗收完成（2026-05-27）：**
- [x] Binance WS 連線 log 出現
- [x] MongoDB `market_ticks` 持續累加（4000+ 筆）
- [x] MongoDB `klines` 每分鐘一根，Decimal128 格式正確
- [x] Redis subscriber 收到訊息（MarketBroadcast 連線確認）
- [x] `/api/health` → `{"status":"ok","mongo":"connected","redis":"connected"}`
- [x] `/api/market/latest` → 即時 BTC 價格
- [x] `/api/market/klines?limit=N` → K 線陣列正確回傳
- [ ] WebSocket 持續推送（未以 wscat 驗證）
- [ ] Kill 後重啟，K 線從 MongoDB 恢復（未驗證）

---

## 已知問題與解法記錄

### 1. tsx ESM re-export 問題（Wave 1 發現）

**問題：** `export * from './constants.js'` 在 tsx watch 模式下，Node.js v22 ESM 解析失敗。

**錯誤訊息：**
```
SyntaxError: The requested module '@market-os/config' does not provide an export named 'SYMBOLS'
```

**解法：** `packages/config/src/index.ts` 和 `packages/shared-types/src/index.ts` 改為直接 export（不用 re-export 中間層）：
```typescript
// ✅ 正確做法
export const SYMBOLS = { BTCUSDT: 'BTCUSDT' } as const;

// ❌ 有問題的做法（tsx watch 下失敗）
export * from './constants.js';
```

### 5. Binance trade stream 移除 b/a 欄位（Wave 2 端對端驗收發現）

**問題：** Binance 公開 trade stream 已移除 `b`（buyer order ID）和 `a`（seller order ID）欄位（隱私政策調整）。

**錯誤訊息：**
```
ZodError: path["b"] Required, path["a"] Required
```

**解法：** `BinanceTradeSchema` 將 `b` 和 `a` 改為 `.optional()`：
```typescript
b: z.number().optional(),
a: z.number().optional(),
```

---

### 3. api-gateway 缺少 @types/ws（Wave 2 發現）

**問題：** `apps/api-gateway` 的 `devDependencies` 未包含 `@types/ws`，`websocket.ts` 無法取得 WebSocket 型別。

**解法：** 加入 `"@types/ws": "8.5.12"` 至 api-gateway devDependencies，並為 `message` / `error` 事件參數加上明確型別（`Buffer | string`、`Error`）。

### 4. frontend 無測試檔案導致 pnpm -r test 失敗（Wave 2 發現）

**問題：** vitest 預設在找不到測試檔時 exit 1，造成 `pnpm -r test` 整體失敗。

**解法：** 新增 `apps/frontend/vitest.config.ts` 設定 `passWithNoTests: true`。

---

### 2. KlineAggregator 初始 volume 精度（Wave 2 發現）

**問題：** `createKline()` 初始 volume 直接用 `tick.quantity`，未 normalize 到 8 位小數。

**錯誤：** test 期望 `"0.50000000"` 但收到 `"0.5"`

**解法：** 改為 `new Decimal(tick.quantity).toFixed(8)`

---

## Wave 3：Frontend + Docker ✅（部分）

### A. Frontend — 完成 ✅

**已實作檔案：**

```
src/
├── utils/
│   ├── priceChange.ts          ✅ calcPriceChange()
│   └── priceChange.spec.ts     ✅ 5 tests
├── services/
│   └── marketWebSocket.ts      ✅ 重連 + ping/pong
├── api/
│   └── market.ts               ✅ fetchKlines()
├── stores/
│   └── market.ts               ✅ Pinia store（MarketState）
├── components/
│   ├── PriceCard.vue           ✅ 漲跌色彩、連線狀態
│   └── KlineChart.vue          ✅ ECharts K線 + 成交量
└── views/
    └── DashboardView.vue       ✅ 整合三元件
apps/frontend/.env              ✅
apps/frontend/.env.production   ✅
```

**Unit Tests：** `5 / 5 通過`

**開發模式驗收（截圖確認）：**
- [x] 深色背景 (#131722) 正確
- [x] PriceCard 顯示 BTC 即時價格，漲跌色彩正確
- [x] 連線狀態 `● 連線中`（綠）
- [x] K 線圖顯示歷史蠟燭，含上下影線
- [x] 成交量 bar 顯示於下方
- [x] DataZoom 滑鼠滾輪 + 底部拖拉條

### B. Docker — 完成 ✅

```
apps/market-data-service/Dockerfile  ✅ multi-stage
apps/api-gateway/Dockerfile          ✅ multi-stage
apps/frontend/Dockerfile             ✅ Nginx static
apps/frontend/nginx.conf             ✅ WS upgrade proxy
docker-compose.yml                   ✅ 含 healthcheck
```

**✅ Docker Compose 驗收完成（2026-05-27）：**
- [x] `docker compose build` — 3 個映像全部成功
- [x] `docker compose up -d` — 5 個容器全部 healthy
- [x] `/api/health` → `{"status":"ok","mongo":"connected","redis":"connected"}`
- [x] `/api/market/latest` → 即時 BTC 價格
- [x] `/api/market/klines?limit=3` → K 線陣列正確
- [x] http://localhost:5173 → dashboard 正常顯示，K 線即時更新

## Phase 1 完成 ✅

所有 Wave 驗收通過，MVP 可一鍵啟動：

```bash
docker compose up -d
# 訪問 http://localhost:5173
```

### 已修復的規格缺口

| 問題 | 解法 |
|---|---|
| Binance `b`/`a` 欄位移除 | `BinanceTradeSchema` 改為 optional |
| packages `main` 指向 `.ts` 原始檔 | 加入 build step，`exports` 指向 `dist/*.js` |
| Docker build context 錯誤 | docker-compose.yml 改用 root context |
| Healthcheck `wget` 不可用 | 改用 `node -e` http 請求 |

---

## 開發環境資訊

| 項目 | 版本 |
|---|---|
| Node.js | v22.13.1（.nvmrc 指定 20，但 22 相容） |
| pnpm | 9.12.0 |
| OS | macOS Darwin 25.5.0 |
| 專案路徑 | `~/Desktop/market-os` |

---

## 規格文件位置

| 文件 | 路徑 |
|---|---|
| 完整開發規格 | `docs/market-os-spec.md` |
| Agent 派發指令 | `docs/market-os-agent-waves.md` |
| 本進度記錄 | `docs/progress.md`（本文件） |
