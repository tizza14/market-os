# 架構與設計

系統架構、服務邊界、非功能性需求、實作 pattern。此文件允許在實作完成後 7 天內更新。

---

## 1. 系統架構

```
Binance WebSocket (wss://stream.binance.com:9443/ws/btcusdt@trade)
       ↓
market-data-service (Node.js / TypeScript)
  ├── 格式化 tick
  ├── 寫入 MongoDB (market_ticks)
  ├── 聚合 K線（1m / 5m / 15m / 1h），寫入 MongoDB (klines)
  └── 發布 Redis Pub/Sub (market:btcusdt)
       ↓
api-gateway (Fastify / TypeScript)
  ├── 訂閱 Redis (market:btcusdt) → fan-out 到 WS 客戶端
  ├── REST API (/api/market/*)
  ├── REST API (/api/tw-stock/*) → 代理 FinMind
  └── WebSocket (/ws/market)
       ↓
frontend (Vue 3 / TypeScript)
  ├── BTC 即時儀表板
  │   ├── PriceCard：WebSocket 即時價格
  │   └── KlineChart：歷史 + 即時 K 線（多週期）
  └── 台股日 K 查詢
      └── TwKlineChart：FinMind 日 K 資料
```

---

## 2. 服務邊界

| 服務 | 職責 | 不負責 |
|---|---|---|
| market-data-service | Binance 連線、資料格式化、DB 寫入、Redis 發布 | HTTP API、前端推播、台股資料 |
| api-gateway | Redis 訂閱、WS 推播、REST API、FinMind 代理 | Binance 連線、DB 寫入 |
| frontend | 顯示資料、WS 接收、使用者互動 | 資料計算、DB 存取、直連外部 API |

**核心原則：** 任何外部 API 都不由 frontend 直接呼叫。所有 token / 密鑰只存在於後端。

---

## 3. 非功能性需求（NFR）

### 3.1 延遲

| 路徑 | P50 | P95 | P99 |
|---|---|---|---|
| Binance → Redis Pub/Sub | < 50ms | < 100ms | < 200ms |
| Redis → WS 推播 | < 30ms | < 80ms | < 150ms |
| 端對端（Binance → 前端顯示） | < 200ms | < 500ms | < 1s |
| REST API 回應（內部資料） | < 50ms | < 200ms | < 500ms |
| REST API 回應（FinMind 代理） | < 500ms | < 2s | < 5s |

### 3.2 可靠性

| 情境 | 要求 |
|---|---|
| Binance WS 斷線 | 指數退避自動重連 |
| MongoDB 寫入失敗 | 記 error log，**不阻塞** Redis Pub/Sub |
| Redis 發布失敗 | 記 warn log，**不阻塞** MongoDB 寫入 |
| FinMind 不可用 | 回傳 502，**不影響** BTC 路徑 |
| api-gateway 重啟 | 重連 Redis，恢復 WS 推播 |

### 3.3 資料保留

| Collection | 策略 |
|---|---|
| `market_ticks` | TTL 7 天 |
| `klines` | 永久保留 |

---

## 4. Monorepo 結構

```
market-os/
├── apps/
│   ├── frontend/               Vue 3 + ECharts
│   ├── api-gateway/            Fastify REST + WS
│   └── market-data-service/    Binance WS → MongoDB + Redis
├── packages/
│   ├── shared-types/           共用 TS 介面（build → dist）
│   └── config/                 共用常數（build → dist）
├── docs/
│   ├── spec/                   契約規格
│   ├── design/                 設計筆記
│   └── progress.md             開發進度
├── docker-compose.yml
├── .env                        FINMIND_TOKEN（root，不進 git）
└── tsconfig.base.json          所有 app 繼承
```

### 4.1 套件依賴規則

- `apps/*` 可 import `packages/*`，**不可** import 其他 `apps/*`
- `packages/*` 之間可互相依賴，**不可** import `apps/*`
- 所有跨 package 共用型別 → `shared-types`
- 所有跨 package 常數 → `config`

### 4.2 工具版本

| 工具 | 版本 |
|---|---|
| Node.js | ≥ 20 |
| npm | ≥ 10 |
| TypeScript | 5.5.x |

`.nvmrc` 指定 20，實測 22 相容。

---

## 5. 實作 Pattern

### 5.1 Decimal128 處理流程

```
傳輸層 (string)
   ↓ Decimal128.fromString()
儲存層 (Decimal128)
   ↓ doc.field.toString()
傳輸層 (string)
   ↓ new Decimal(...) → toFixed()
聚合運算層 (decimal.js)
   ↓ .toFixed(8)
傳輸層 (string)
   ↓ parseFloat / toLocaleString
顯示層 (number)
```

**禁止：** 在聚合層用 `parseFloat`、`+`、`-`、`*`、`/` 直接運算字串轉的數字。一律走 `decimal.js`。

**MongoDB `$inc` 對 Decimal128 有精度損失風險。** K 線聚合採用 read-modify-write（讀回現值，decimal.js 算完再 `$set`），不用 `$inc`。`tradeCount` 是 integer 可安全 `$inc`。

### 5.2 Redis Subscriber Fan-out

單一 Redis subscriber + EventEmitter → 多個 WS client。

| 比較 | Fan-out | Per-client subscriber |
|---|---|---|
| Redis 連線數 | 1 | N |
| 記憶體 | 低 | 高 |
| 50 client 負載 | 1 sub | 50 sub |

實作：`apps/api-gateway/src/services/marketBroadcast.ts`。`setMaxListeners` 與 `WS_MAX_CONNECTIONS` 對齊。

### 5.3 多週期 K 線聚合

`market-data-service/main.ts` 啟動時建立 4 個 `KlineAggregator` 實例（1m / 5m / 15m / 1h），每筆 tick 平行 `processTick`：

```typescript
const aggregators = Object.entries(KLINE_INTERVAL_MS).map(
  ([interval, ms]) => new KlineAggregator(interval, ms, klineRepo, logger),
);
await Promise.all(aggregators.map((a) => a.initialize(SYMBOLS.BTCUSDT)));

// 每筆 tick：
await Promise.allSettled(aggregators.map((a) => a.processTick(tick)));
```

`klineAggregator` 純函式 `calcOpenTime / createKline / aggregateTick` 都接 `intervalMs` 參數，與週期解耦。

### 5.4 K 線重啟恢復

服務重啟時可能正處於某根 K 線中間。`KlineAggregator.initialize()` 從 MongoDB 撈出當下 `openTime` 的 K 線繼續累加。

### 5.5 Frontend WS 重連

`apps/frontend/src/services/marketWebSocket.ts`：
- 斷線觸發 `onclose` → `scheduleReconnect`
- delay = `min(2^N * 1000, 30000)`，N 為重連次數
- 重連成功後重新拉一次 `klines`（補資料缺口）
- 每 30 秒發 `ping`

### 5.6 後端代理外部 API

任何外部 API 都不直接從 frontend 呼叫。原因：
1. Token 不暴露於 browser
2. CORS 統一處理
3. 後端可加快取層
4. 統一錯誤格式（外部 API 各家 schema 不同 → 後端統一轉為 `UPSTREAM_ERROR`）

範例：`/api/tw-stock/klines` 代理 FinMind。

---

## 6. 容器化

### 6.1 Dockerfile pattern

所有 Node.js 服務採 multi-stage build：

```
Stage 1 (builder):
  - npm ci --include-workspace-root --workspaces
  - npm run build -w packages/shared-types
  - npm run build -w packages/config
  - npm run build -w apps/<service>

Stage 2 (runtime):
  - npm ci --omit=dev
  - COPY --from=builder dist/
  - USER node
  - CMD ["node", "dist/main.js"]
```

Frontend 採 Vue build → Nginx 靜態檔，nginx.conf 代理 `/api` 與 `/ws` 到 api-gateway。

### 6.2 Healthcheck

- `node:alpine` 映像無 `wget` / `curl`，healthcheck 用 `node -e "require('http').get(...)"`
- mongo: `mongosh --quiet --eval "db.adminCommand('ping').ok"`
- redis: `redis-cli ping`

### 6.3 Docker 網路

- 所有服務在 `market-os-network` bridge 網路
- service name 即為內部 DNS（如 `redis://redis:6379`）
- frontend nginx 透過 service name 反代 api-gateway

---

## 7. 測試策略

| 層級 | 工具 | 範圍 |
|---|---|---|
| Unit | Vitest | 純函式（parser、aggregator、indicator、formatter） |
| Integration | Vitest + Fastify inject | API handler（用 mock deps） |
| E2E | 手動 / Playwright（未自動化） | Dashboard 渲染、WS 即時更新 |

**測試檔慣例：** `*.spec.ts`，與 source 同目錄。

**目前測試數：** 43（market-data-service 27 / api-gateway 11 / frontend 5）。

---

## 8. 開發 vs 生產

| 項目 | Dev | Prod |
|---|---|---|
| TS 執行 | `node --env-file=.env --import tsx/esm --watch src/main.ts` | `node dist/main.js` |
| Frontend | `vite dev`（5173，proxy /api） | Nginx 靜態檔 |
| Log 格式 | `pino-pretty` 彩色 | JSON line |
| Source map | 開 | 關 |
| Docker | 不建議跑 dev 模式 | multi-stage build |

---

## 9. Logging

使用 `pino`，JSON line，level 由 `LOG_LEVEL` 控制。

**必須記錄：**

| 事件 | Level | 必要欄位 |
|---|---|---|
| Service 啟動/關閉 | info | `service`, `signal` |
| Binance WS 連線/重連 | info/warn | `url`, `attempt`, `delayMs` |
| Mongo/Redis 連線 | info/error | `url`（不含密碼） |
| Tick 寫入失敗（非 duplicate） | error | `tradeId`, `error` |
| Duplicate tick 忽略 | debug | `tradeId` |
| WS client 連線/斷線 | info | `clientIp`, `totalConnections` |
| REST API 5xx | error | `method`, `path`, `statusCode` |
| FinMind 失敗 | warn | `symbol`, `error` |
