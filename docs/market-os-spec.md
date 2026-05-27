# Market OS — 規格驅動開發文件（Spec-Driven Development）

**版本：** v1.2  
**日期：** 2026-05-27  
**狀態：** Phase 2 進行中

---

## 目錄

1. [專案目標與範圍](#1-專案目標與範圍)
20. [Phase 2 規格](#20-phase-2-規格)（新）
2. [術語定義](#2-術語定義)
3. [系統架構](#3-系統架構)
4. [非功能性需求（NFR）](#4-非功能性需求nfr)
5. [資料精度與品質規格](#5-資料精度與品質規格)
6. [MongoDB Schema 規格](#6-mongodb-schema-規格)
7. [Redis 規格](#7-redis-規格)
8. [Market Data Service 規格](#8-market-data-service-規格)
9. [API Gateway 規格](#9-api-gateway-規格)
10. [Frontend 規格](#10-frontend-規格)
11. [錯誤處理規格](#11-錯誤處理規格)
12. [測試規格](#12-測試規格)
13. [Docker Compose 規格](#13-docker-compose-規格)
14. [環境變數規格](#14-環境變數規格)
15. [開發規範](#15-開發規範)
16. [開發順序與驗收條件](#16-開發順序與驗收條件)
17. [Monorepo 結構](#17-monorepo-結構)
18. [套件版本與相依性](#18-套件版本與相依性)
19. [實作 Pattern 指引](#19-實作-pattern-指引)

---

## 1. 專案目標與範圍

### 1.1 專案定位

Market OS 是一套可擴展的即時市場資料研究平台，定位為：

- 即時市場資料流處理學習平台
- WebSocket 即時推播實作
- 量化基礎設施（Quant Infrastructure）學習專案
- AI 協作開發與 DevOps 實踐

### 1.2 MVP 範圍（Phase 1）

| 功能 | 包含 | 排除 |
|---|---|---|
| 即時行情接收 | BTCUSDT trade tick | 其他交易對 |
| 資料儲存 | MongoDB tick + kline | 歷史資料回填 |
| 前端圖表 | 即時價格、K線、成交量 | 訂單簿、深度圖 |
| 容器化 | Docker Compose 本地開發 | Kubernetes |
| AI 分析 | 簡單波動 summary（Optional） | 策略建議 |

### 1.3 Out of Scope（Phase 1）

- 使用者認證與授權
- 多交易對支援
- 回測引擎
- 策略管理
- 訂單執行

---

## 2. 術語定義

| 術語 | 定義 |
|---|---|
| Tick | 單筆成交資料，來自 Binance `@trade` stream |
| K線（Kline/Candlestick） | OHLCV 聚合資料，MVP 僅支援 1m interval |
| OHLCV | Open / High / Low / Close / Volume |
| eventTime | Binance 事件時間，Unix 毫秒（ms），UTC |
| tradeId | Binance 唯一成交 ID，用於去重 |
| Symbol | 交易對識別符，MVP 固定為 `BTCUSDT`（全大寫） |

---

## 3. 系統架構

```
Binance WebSocket (wss://stream.binance.com:9443/ws/btcusdt@trade)
       ↓
Market Data Service (Node.js / TypeScript)
  ├── 格式化 tick 資料
  ├── 寫入 MongoDB (market_ticks)
  ├── 聚合 1m K線，寫入 MongoDB (klines)
  └── 發布 Redis Pub/Sub (market:btcusdt)
       ↓
API Gateway (Fastify / TypeScript)
  ├── 訂閱 Redis (market:btcusdt)
  ├── 推播 WebSocket (/ws/market)
  └── 提供 REST API (/api/*)
       ↓
Frontend (Vue 3 / TypeScript)
  ├── WebSocket 接收即時資料
  ├── ECharts 即時 K 線圖
  └── 價格卡片 + 成交量圖
```

### 3.1 服務邊界

| 服務 | 職責 | 不負責 |
|---|---|---|
| market-data-service | Binance 連線、資料格式化、DB寫入、Redis發布 | HTTP API、前端推播 |
| api-gateway | Redis訂閱、WS推播、REST API | Binance連線、DB寫入 |
| frontend | 顯示資料、WebSocket接收 | 資料計算、DB存取 |

---

## 4. 非功能性需求（NFR）

### 4.1 延遲需求

| 路徑 | P50 | P95 | P99 |
|---|---|---|---|
| Binance → Redis Pub/Sub | < 50ms | < 100ms | < 200ms |
| Redis → WebSocket 推播 | < 30ms | < 80ms | < 150ms |
| 端對端（Binance → 前端顯示） | < 200ms | < 500ms | < 1s |
| REST API 回應 | < 50ms | < 200ms | < 500ms |

### 4.2 可靠性需求

| 情境 | 要求 |
|---|---|
| Binance WS 斷線重連 | 自動重連，指數退避（見 8.3 節） |
| MongoDB 寫入失敗 | 記錄 error log，**不阻塞** Redis Pub/Sub |
| Redis 發布失敗 | 記錄 warn log，**不阻塞** MongoDB 寫入 |
| API Gateway 重啟 | 重連 Redis，恢復 WS 推播 |

### 4.3 資料保留

| Collection | 保留策略 |
|---|---|
| market_ticks | TTL 7 天（透過 MongoDB TTL index） |
| klines | 永久保留（Phase 1 無上限） |

---

## 5. 資料精度與品質規格

### 5.1 數值精度

| 欄位 | 精度 | 型別 | 範例 |
|---|---|---|---|
| price | 小數點後 2 位 | `Decimal128`（MongoDB）/ `string`（傳輸） | `"104523.45"` |
| quantity | 小數點後 8 位 | `Decimal128`（MongoDB）/ `string`（傳輸） | `"0.00123456"` |
| volume（K線） | 小數點後 8 位 | `Decimal128` | `"1234.56789012"` |

> **重要**：價格與數量在服務間傳輸時使用 `string` 型別，避免 JavaScript 浮點數精度損失。僅在前端顯示層才轉為 `number`。

### 5.2 時間規格

| 欄位 | 格式 | 時區 | 範例 |
|---|---|---|---|
| eventTime | Unix 毫秒（ms） | UTC | `1748131200000` |
| kline.openTime | Unix 毫秒（ms） | UTC | `1748131200000` |
| createdAt | ISO 8601 | UTC | `"2026-05-25T00:00:00.000Z"` |

> 所有時間戳記統一使用 **UTC**，前端顯示時再轉換為本地時間。

### 5.3 資料去重規格

**Tick 去重：**
- 使用 Binance `tradeId`（欄位名：`t`）作為唯一鍵
- MongoDB `market_ticks` collection 對 `tradeId` 建立 `unique index`
- 若寫入時發生 `duplicate key error`，**靜默忽略**（非錯誤，記錄 debug log）

**K線去重：**
- 使用 `(symbol, interval, openTime)` 作為複合唯一鍵
- 使用 `upsert` 操作更新 K線（同一根 K 線持續更新 close/high/low/volume）

### 5.4 亂序資料處理

- Tick 資料若 `eventTime` 早於最近一筆已存資料超過 **5 秒**，記錄 warn log 並丟棄
- K 線以 `openTime` 為準，不依賴接收順序

### 5.5 資料缺口處理

- Phase 1 **不填補** K 線缺口（無成交的分鐘不產生 K 線）
- 前端圖表以現有資料顯示，缺口自然呈現

---

## 6. MongoDB Schema 規格

### 6.1 Collection: `market_ticks`

```typescript
interface MarketTick {
  _id: ObjectId;
  symbol: string;          // "BTCUSDT"
  tradeId: number;         // Binance trade ID，unique index
  price: Decimal128;       // 成交價，string-serialized
  quantity: Decimal128;    // 成交量（BTC 單位）
  buyerOrderId: number;    // 買方訂單 ID
  sellerOrderId: number;   // 賣方訂單 ID
  isBuyerMaker: boolean;   // true = 主動賣出（taker sell）
  eventTime: number;       // Unix ms, UTC
  createdAt: Date;         // 寫入時間，用於 TTL index
}
```

**Indexes：**

```javascript
// 唯一索引（去重用）
{ tradeId: 1 },  { unique: true }

// 查詢索引
{ symbol: 1, eventTime: -1 }

// TTL 索引（7天自動刪除）
{ createdAt: 1 }, { expireAfterSeconds: 604800 }
```

### 6.2 Collection: `klines`

```typescript
interface Kline {
  _id: ObjectId;
  symbol: string;       // "BTCUSDT"
  interval: string;     // "1m"
  openTime: number;     // K線開始時間 Unix ms, UTC
  closeTime: number;    // K線結束時間 Unix ms, UTC（openTime + 59999）
  open: Decimal128;     // 開盤價
  high: Decimal128;     // 最高價
  low: Decimal128;      // 最低價
  close: Decimal128;    // 收盤價（最新成交價）
  volume: Decimal128;   // 成交量（BTC 單位）
  tradeCount: number;   // 該 K 線包含的成交筆數
  updatedAt: Date;      // 最後更新時間
}
```

**Indexes：**

```javascript
// 唯一索引（upsert key）
{ symbol: 1, interval: 1, openTime: 1 }, { unique: true }

// 查詢索引
{ symbol: 1, interval: 1, openTime: -1 }
```

### 6.3 K線聚合邏輯

Market Data Service 負責從 tick 即時聚合 1m K 線：

```
openTime  = floor(eventTime / 60000) * 60000
closeTime = openTime + 59999

upsert klines where (symbol, interval="1m", openTime):
  $setOnInsert: { open, openTime, closeTime, symbol, interval }
  $set:         { close, updatedAt }
  $max:         { high }
  $min:         { low }
  $inc:         { volume, tradeCount }
```

---

## 7. Redis 規格

### 7.1 Channel 設計

| Channel | 用途 |
|---|---|
| `market:btcusdt` | BTCUSDT 即時 tick 資料 |

### 7.2 訊息格式

```typescript
interface RedisMarketMessage {
  type: "market:update";
  data: {
    symbol: string;       // "BTCUSDT"
    price: string;        // 字串，避免浮點數損失，e.g. "104523.45"
    quantity: string;     // 字串，e.g. "0.00123456"
    isBuyerMaker: boolean;
    tradeId: number;
    eventTime: number;    // Unix ms, UTC
  };
}
```

### 7.3 訊息大小限制

- 單則 Redis 訊息 < 1KB
- 超過則記錄 warn 並截斷非必要欄位

---

## 8. Market Data Service 規格

### 8.1 Binance WebSocket 連線

```
URL: wss://stream.binance.com:9443/ws/btcusdt@trade
Protocol: WebSocket
```

**Binance Trade Stream Payload（原始）：**

```json
{
  "e": "trade",
  "E": 1710000000000,
  "s": "BTCUSDT",
  "t": 123456789,
  "p": "104523.45",
  "q": "0.00123456",
  "b": 88,
  "a": 50,
  "T": 1710000000000,
  "m": false
}
```

**欄位對應：**

| Binance 欄位 | 意義 | 對應 MarketTick 欄位 |
|---|---|---|
| `E` | Event time | `eventTime` |
| `s` | Symbol | `symbol` |
| `t` | Trade ID | `tradeId` |
| `p` | Price | `price` |
| `q` | Quantity | `quantity` |
| `b` | Buyer order ID | `buyerOrderId` |
| `a` | Seller order ID | `sellerOrderId` |
| `m` | Is buyer maker | `isBuyerMaker` |

### 8.2 資料流程

```
Binance WS message
  → 驗證 event type === "trade"
  → 解析欄位（zod schema 驗證）
  → 建立 MarketTick 物件
  → 並行執行：
      ├── 寫入 MongoDB (market_ticks)  ← 失敗不影響下一步
      ├── 更新 MongoDB K線 (klines)    ← 失敗不影響下一步
      └── 發布 Redis Pub/Sub           ← 失敗記錄 warn
```

### 8.3 重連機制

```
初始連線失敗 或 連線中斷：
  重試次數 N = 0
  delay = min(2^N * 1000ms, 30000ms)  // 指數退避，最大 30 秒
  最大重試次數：無限（持續嘗試）

  N=0: 立即重試
  N=1: 1s
  N=2: 2s
  N=3: 4s
  N=4: 8s
  N=5: 16s
  N=6+: 30s

連線成功後重置 N = 0

每次重連記錄 log：
  warn: "Binance WS reconnecting, attempt={N}, delay={delay}ms"
```

### 8.4 Heartbeat / Ping-Pong

- Binance Server 每 3 分鐘發送 ping frame
- Market Data Service 必須在收到 ping 後 **10 秒內** 回覆 pong
- 若超過 60 秒未收到任何訊息，主動觸發重連

### 8.5 Zod Schema（Binance Payload 驗證）

```typescript
const BinanceTradeSchema = z.object({
  e: z.literal("trade"),
  E: z.number(),           // eventTime
  s: z.string(),           // symbol
  t: z.number(),           // tradeId
  p: z.string(),           // price（string）
  q: z.string(),           // quantity（string）
  b: z.number(),           // buyerOrderId
  a: z.number(),           // sellerOrderId
  m: z.boolean(),          // isBuyerMaker
});
```

驗證失敗時：記錄 error log 並丟棄該筆資料，**不拋出例外**。

### 8.6 Graceful Shutdown

```
收到 SIGTERM / SIGINT：
  1. 停止接收新的 Binance WS 訊息
  2. 等待進行中的 MongoDB 寫入完成（最多 5 秒）
  3. 關閉 Redis 連線
  4. 關閉 MongoDB 連線
  5. 退出 process，exit code 0
```

---

## 9. API Gateway 規格

### 9.1 REST API

#### `GET /api/health`

**Response 200：**

```json
{
  "status": "ok",
  "timestamp": 1748131200000,
  "services": {
    "redis": "connected",
    "mongo": "connected"
  }
}
```

**Response 503（任一服務異常）：**

```json
{
  "status": "degraded",
  "timestamp": 1748131200000,
  "services": {
    "redis": "disconnected",
    "mongo": "connected"
  }
}
```

---

#### `GET /api/market/latest`

回傳最新一筆 tick 資料。

**Response 200：**

```json
{
  "symbol": "BTCUSDT",
  "price": "104523.45",
  "quantity": "0.00123456",
  "eventTime": 1748131200000
}
```

**Response 404（無資料）：**

```json
{
  "error": {
    "code": "NO_DATA",
    "message": "No market data available yet"
  }
}
```

---

#### `GET /api/market/klines`

**Query Parameters：**

| 參數 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `symbol` | string | 否 | `BTCUSDT` | 交易對（Phase 1 僅支援 BTCUSDT） |
| `interval` | string | 否 | `1m` | K線週期（Phase 1 僅支援 1m） |
| `limit` | number | 否 | `100` | 回傳筆數，最大 500 |

**Response 200：**

```json
{
  "symbol": "BTCUSDT",
  "interval": "1m",
  "data": [
    {
      "openTime": 1748131200000,
      "closeTime": 1748131259999,
      "open": "104000.00",
      "high": "104523.45",
      "low": "103800.00",
      "close": "104200.00",
      "volume": "12.34567890",
      "tradeCount": 145
    }
  ]
}
```

**Validation 錯誤（400）：**

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid query parameters",
    "details": [
      { "field": "limit", "message": "Must be between 1 and 500" }
    ]
  }
}
```

---

### 9.2 WebSocket

**Endpoint：** `ws://{host}/ws/market`

#### 連線流程

```
Client 發起連線
  → Server 接受
  → Server 立即推播最新一筆資料（若有）
  → Server 持續推播每筆新 tick
```

#### Server → Client 事件：`market:update`

```json
{
  "type": "market:update",
  "data": {
    "symbol": "BTCUSDT",
    "price": "104523.45",
    "quantity": "0.00123456",
    "isBuyerMaker": false,
    "eventTime": 1748131200000
  }
}
```

#### Server → Client 事件：`market:error`

```json
{
  "type": "market:error",
  "data": {
    "code": "SOURCE_DISCONNECTED",
    "message": "Market data source temporarily unavailable"
  }
}
```

#### Client Ping / Server Pong

- Client 每 **30 秒** 發送 `{"type": "ping"}`
- Server 回應 `{"type": "pong", "timestamp": 1748131200000}`
- Server 若 **60 秒** 未收到 ping，關閉連線（code: 4000）

#### 並發連線上限

- Phase 1：最多 **50** 個並發 WebSocket 連線
- 超過上限時回傳 HTTP 503 拒絕升級

---

### 9.3 CORS 設定

```
開發環境：允許所有 origin（*）
生產環境：僅允許 frontend service origin
```

---

### 9.4 Rate Limiting

| Endpoint | 限制 |
|---|---|
| `GET /api/*` | 100 req / 分鐘 / IP |
| `GET /api/health` | 無限制 |
| WebSocket 連線建立 | 10 次 / 分鐘 / IP |

---

## 10. Frontend 規格

### 10.0 TailwindCSS 設定

**初始化設定檔：**

```javascript
// apps/frontend/tailwind.config.js
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{vue,ts}'],
  theme: {
    extend: {
      colors: {
        // 量化圖表配色
        'price-up':   '#26a69a',   // 漲（綠）
        'price-down': '#ef5350',   // 跌（紅）
        'price-flat': '#90a4ae',   // 平盤（灰）
        'bg-primary': '#131722',   // 主背景（深色）
        'bg-card':    '#1e222d',   // 卡片背景
        'border-dim': '#2a2e39',   // 邊框
      },
    },
  },
  plugins: [],
};
```

```css
/* apps/frontend/src/assets/main.css */
@tailwind base;
@tailwind components;
@tailwind utilities;

body {
  @apply bg-bg-primary text-white;
}
```

```javascript
// apps/frontend/postcss.config.js
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

**ECharts 配色對齊 Tailwind（在 KlineChart 元件中使用）：**

```typescript
const CHART_COLORS = {
  up:         '#26a69a',  // price-up
  down:       '#ef5350',  // price-down
  background: '#131722',  // bg-primary
  grid:       '#2a2e39',  // border-dim
  text:       '#90a4ae',  // price-flat
} as const;
```

---

### 10.1 頁面路由

| 路徑 | Component | 說明 |
|---|---|---|
| `/` | `DashboardView` | 唯一頁面（Phase 1） |

### 10.2 Dashboard 元件規格

#### 10.2.1 PriceCard 元件

| 顯示項目 | 資料來源 | 格式 |
|---|---|---|
| Symbol | `BTCUSDT` | 靜態字串 |
| Current Price | WebSocket `price` | `$104,523.45`（逗號分隔，2位小數） |
| Price Change | 與前一筆比較 | `+$123.45 (+0.12%)` 綠色 / `-$123.45 (-0.12%)` 紅色 |
| Timestamp | WebSocket `eventTime` | 轉為本地時間 `HH:mm:ss.SSS` |
| 連線狀態 | WebSocket 狀態 | `● 連線中`（綠）/ `● 重連中`（黃）/ `● 離線`（紅） |

**Acceptance Criteria：**
- [ ] 收到新 tick 後，Price 更新延遲 < 100ms（視覺更新）
- [ ] 價格上漲顯示綠色，下跌顯示紅色，平盤顯示白色
- [ ] WebSocket 斷線時顯示離線狀態，不顯示過時資料標記

#### 10.2.2 KlineChart 元件（ECharts）

| 功能 | 規格 |
|---|---|
| 圖表類型 | Candlestick（K線）+ Volume bar |
| 初始載入 | 呼叫 `GET /api/market/klines?limit=100` |
| 即時更新 | 收到 WebSocket tick 後更新最後一根 K 線 |
| X 軸 | 時間軸，顯示本地時間 `HH:mm` |
| Y 軸（價格） | 自動縮放，顯示 2 位小數 |
| Y 軸（成交量） | 顯示於下方，單位 BTC |
| Tooltip | 顯示 OHLCV + tradeCount |
| Zoom | DataZoom 滑鼠滾輪 + 底部拖拉條 |

**Acceptance Criteria：**
- [ ] 頁面載入後 2 秒內顯示 K 線圖
- [ ] 每筆新 tick 到達後，最後一根 K 線即時更新（不閃爍整圖）
- [ ] 跨越整點時，自動新增下一根 K 線

### 10.3 WebSocket 重連機制（前端）

```
連線中斷：
  delay = min(2^N * 1000ms, 30000ms)，N 從 0 開始
  重連時顯示 "重連中" 狀態
  重連成功後：重新請求 klines 資料（避免缺口）
  重連成功後重置 N = 0
```

### 10.4 Pinia Store 設計

```typescript
// stores/market.ts
interface MarketState {
  symbol: string;
  latestTick: MarketTick | null;
  klines: Kline[];
  connectionStatus: 'connected' | 'reconnecting' | 'disconnected';
  lastUpdated: number | null;
}
```

### 10.5 型別定義（shared-types 套件）

前後端共用型別統一放置於 `packages/shared-types`：

```typescript
// packages/shared-types/src/market.ts

export interface MarketTick {
  symbol: string;
  price: string;
  quantity: string;
  isBuyerMaker: boolean;
  tradeId: number;
  eventTime: number;
}

export interface Kline {
  openTime: number;
  closeTime: number;
  open: string;
  high: string;
  low: string;
  close: string;
  volume: string;
  tradeCount: number;
}

export type WebSocketMessage =
  | { type: 'market:update'; data: MarketTick }
  | { type: 'market:error'; data: { code: string; message: string } }
  | { type: 'pong'; timestamp: number };
```

---

## 11. 錯誤處理規格

### 11.1 統一錯誤回應格式

```typescript
interface ErrorResponse {
  error: {
    code: string;       // 大寫底線，如 "VALIDATION_ERROR"
    message: string;    // 人類可讀訊息
    details?: Array<{   // 僅 validation error 使用
      field: string;
      message: string;
    }>;
    requestId?: string; // 追蹤用（Phase 2）
  };
}
```

### 11.2 Error Code 清單

| Code | HTTP Status | 說明 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 請求參數驗證失敗 |
| `NOT_FOUND` | 404 | 資源不存在 |
| `NO_DATA` | 404 | 查詢無結果 |
| `RATE_LIMITED` | 429 | 超過速率限制 |
| `INTERNAL_ERROR` | 500 | 未預期的伺服器錯誤 |
| `SOURCE_DISCONNECTED` | 503 | 上游資料源斷線 |
| `SERVICE_UNAVAILABLE` | 503 | 服務暫時不可用 |

### 11.3 Logging 規格

使用 `pino`，log 格式 JSON，level 由環境變數 `LOG_LEVEL` 控制（預設 `info`）。

**必須記錄的事件：**

| 事件 | Level | 必要欄位 |
|---|---|---|
| Service 啟動 | `info` | `service`, `port`, `env` |
| Binance WS 連線成功 | `info` | `url`, `attempt` |
| Binance WS 連線失敗 | `warn` | `url`, `attempt`, `error` |
| Binance WS 重連 | `warn` | `attempt`, `delayMs` |
| MongoDB 連線成功/失敗 | `info`/`error` | `url`（不含密碼） |
| Redis 連線成功/失敗 | `info`/`error` | `url` |
| Tick 寫入失敗（非 duplicate） | `error` | `tradeId`, `error` |
| Duplicate tick 忽略 | `debug` | `tradeId` |
| REST API 錯誤（5xx） | `error` | `method`, `path`, `statusCode`, `error` |
| WS client 連線/斷線 | `info` | `clientIp`, `totalConnections` |
| Graceful shutdown 啟動 | `info` | `signal` |

---

## 12. 測試規格

**測試框架：** Vitest  
**測試檔案慣例：** `*.spec.ts`，與 source 同目錄  
**執行指令：** `pnpm test`（各 app 內）、`pnpm -r test`（全 monorepo）  
**覆蓋率目標：** 核心業務邏輯（parser、aggregator、backoff）> 80%

---

### 12.1 Unit Tests

#### `binanceParser.spec.ts`

測試對象：`apps/market-data-service/src/schemas/binanceTrade.ts`（Zod schema + parse function）

```
✅ 合法 payload → 正確對應所有欄位
  input:  { e:"trade", E:1748131200000, s:"BTCUSDT", t:123, p:"104523.45", q:"0.001", b:1, a:2, m:false }
  expect: { eventTime:1748131200000, symbol:"BTCUSDT", tradeId:123, price:"104523.45", quantity:"0.001", isBuyerMaker:false }

✅ event type 非 "trade" → 拋出 ZodError
  input:  { e:"kline", ... }
  expect: throws ZodError（e: Invalid literal value）

✅ 缺少必要欄位 tradeId (t) → 拋出 ZodError
  input:  { e:"trade", E:..., s:..., p:..., q:..., b:..., a:..., m:... }（無 t）
  expect: throws ZodError（t: Required）

✅ price 為 number 而非 string → 拋出 ZodError
  input:  { ..., p: 104523.45 }（number）
  expect: throws ZodError（p: Expected string）

✅ eventTime 為 string 而非 number → 拋出 ZodError
  input:  { ..., E: "1748131200000" }
  expect: throws ZodError（E: Expected number）

✅ isBuyerMaker (m) 為 string "false" → 拋出 ZodError
  input:  { ..., m: "false" }
  expect: throws ZodError（m: Expected boolean）
```

---

#### `klineAggregator.spec.ts`

測試對象：`apps/market-data-service/src/services/klineAggregator.ts`

```
基準時間：openTime = 1748131200000（整分鐘）

✅ 第一筆 tick → open/high/low/close 全等於 price
  input:  { price:"104000.00", quantity:"0.5", eventTime: openTime + 1000 }
  expect: { open:"104000.00", high:"104000.00", low:"104000.00", close:"104000.00", volume:"0.5", tradeCount:1 }

✅ 第二筆同分鐘，price 更高 → high 更新，low/open 不變
  base:   close="104000.00", high="104000.00", low="104000.00"
  input:  { price:"104500.00", quantity:"0.3", eventTime: openTime + 2000 }
  expect: { open:"104000.00", high:"104500.00", low:"104000.00", close:"104500.00", volume:"0.8" }

✅ 第三筆同分鐘，price 更低 → low 更新，high/open 不變
  base:   close="104500.00", high="104500.00", low="104000.00"
  input:  { price:"103800.00", quantity:"0.2", eventTime: openTime + 3000 }
  expect: { open:"104000.00", high:"104500.00", low:"103800.00", close:"103800.00", volume:"1.0" }

✅ 跨分鐘 tick → openTime 為新的 floor(eventTime/60000)*60000
  input:  { eventTime: openTime + 60000 }（下一分鐘）
  expect: 新 K線的 openTime = openTime + 60000
          舊 K線不受影響

✅ volume 累加精度正確（使用 string decimal 加法，非 float）
  input:  三筆 quantity: "0.00000001", "0.00000002", "0.00000003"
  expect: volume = "0.00000006"（不是 6e-8 或 5.999...e-8）

✅ tradeCount 每筆 +1
  input:  3 筆 tick
  expect: tradeCount = 3

✅ closeTime = openTime + 59999
  input:  任意 tick
  expect: kline.closeTime === kline.openTime + 59999
```

---

#### `reconnectBackoff.spec.ts`

測試對象：`apps/market-data-service/src/connectors/binanceWebSocket.ts`（`calcBackoffDelay` function）

```
✅ attempt=0 → delay=0ms（立即重試）
  expect: calcBackoffDelay(0) === 0

✅ attempt=1 → delay=1000ms
  expect: calcBackoffDelay(1) === 1000

✅ attempt=2 → delay=2000ms
  expect: calcBackoffDelay(2) === 2000

✅ attempt=3 → delay=4000ms
  expect: calcBackoffDelay(3) === 4000

✅ attempt=4 → delay=8000ms
  expect: calcBackoffDelay(4) === 8000

✅ attempt=5 → delay=16000ms
  expect: calcBackoffDelay(5) === 16000

✅ attempt=6 → delay=30000ms（上限截斷）
  expect: calcBackoffDelay(6) === 30000

✅ attempt=100 → delay=30000ms（上限不超過）
  expect: calcBackoffDelay(100) === 30000

✅ 負數 attempt → delay=0ms（防呆）
  expect: calcBackoffDelay(-1) === 0
```

---

#### `marketFormatter.spec.ts`

測試對象：`apps/market-data-service/src/services/tickProcessor.ts`（Binance raw → MarketTick 轉換）

```
✅ 正確對應欄位名稱（Binance 欄位 → 內部欄位）
  input:  BinanceTrade { E, s, t, p, q, b, a, m }
  expect: MarketTick { eventTime, symbol, tradeId, price, quantity, buyerOrderId, sellerOrderId, isBuyerMaker }

✅ symbol 轉為大寫
  input:  s: "btcusdt"
  expect: symbol: "BTCUSDT"

✅ price / quantity 維持 string 型別（不轉 number）
  input:  p: "104523.45"
  expect: typeof result.price === "string"
```

---

#### `apiHandlers.spec.ts`

測試對象：`apps/api-gateway/src/handlers/market.ts`（使用 Fastify inject 測試）

```
GET /api/health

✅ Redis + MongoDB 均連線 → 200 { status:"ok" }
✅ Redis 斷線 → 503 { status:"degraded", services.redis:"disconnected" }

GET /api/market/latest

✅ 有資料 → 200，回傳 symbol/price/quantity/eventTime
✅ 無資料（DB 空）→ 404 { error.code:"NO_DATA" }

GET /api/market/klines

✅ 預設參數 → 200，回傳最多 100 筆，按 openTime 升序
✅ limit=200 → 回傳最多 200 筆
✅ limit=0 → 400 { error.code:"VALIDATION_ERROR", details[].field:"limit" }
✅ limit=501 → 400 { error.code:"VALIDATION_ERROR", details[].field:"limit" }
✅ limit="abc"（非數字） → 400 VALIDATION_ERROR
✅ symbol="ETHUSDT"（不支援）→ 400 VALIDATION_ERROR
```

---

#### `priceChange.spec.ts`

測試對象：`apps/frontend/src/utils/priceChange.ts`（前端價格變化計算）

```
✅ 新價格 > 舊價格 → direction:"up", diff 為正值，percent 為正值
  input:  prev="100.00", curr="101.00"
  expect: { direction:"up", diff:"+1.00", percent:"+1.00%" }

✅ 新價格 < 舊價格 → direction:"down", diff 為負值
  input:  prev="101.00", curr="100.00"
  expect: { direction:"down", diff:"-1.00", percent:"-0.99%" }

✅ 新價格 = 舊價格 → direction:"flat"
  input:  prev="100.00", curr="100.00"
  expect: { direction:"flat", diff:"0.00", percent:"0.00%" }

✅ prev 為 null（第一筆）→ direction:"flat"
  input:  prev=null, curr="100.00"
  expect: { direction:"flat" }

✅ 格式化顯示：千分位逗號，2 位小數
  input:  curr="104523.45"
  expect: displayPrice = "$104,523.45"
```

---

### 12.2 Integration Tests

**執行環境：** 需要 MongoDB + Redis 啟動（可使用 `docker compose up mongo redis -d`）

| 情境 | 驗證項目 |
|---|---|
| Tick 寫入 MongoDB | 資料可查詢到、`tradeId` unique index 生效 |
| Duplicate tick | 第二筆相同 `tradeId` 寫入不報錯、DB 筆數不增加 |
| K線 upsert | 同一根 K 線 10 次 tick，最終 `tradeCount=10`，`high`/`low` 正確 |
| Redis Pub/Sub | 發布後訂閱者在 100ms 內收到完整 JSON 訊息 |
| WebSocket 推播 | tick 進入 Redis 後，WS client 在 200ms 內收到 `market:update` |
| TTL Index | `createdAt` 早於 7 天的文件可被 TTL 機制刪除 |

---

### 12.3 Acceptance Test（Phase 1 完成標準）

- [ ] `docker compose up` 後，所有服務健康啟動（`/api/health` 回 200）
- [ ] 前端頁面載入，2 秒內出現 K 線圖
- [ ] 斷開市場資料服務 30 秒後重啟，前端自動恢復接收資料
- [ ] 連續運行 1 小時，`market_ticks` 無重複 tradeId
- [ ] MongoDB K線 1 分鐘一根，無遺漏（在有成交的分鐘內）

---

## 13. Docker Compose 規格

```yaml
# docker-compose.yml
services:
  frontend:
    build: ./apps/frontend
    ports: ["5173:5173"]
    depends_on: [api-gateway]
    networks: [market-os-network]

  api-gateway:
    build: ./apps/api-gateway
    ports: ["3000:3000"]
    environment:
      PORT: 3000
      REDIS_URL: redis://redis:6379
      MONGO_URL: mongodb://mongo:27017/market-os
      LOG_LEVEL: info
    depends_on: [redis, mongo]
    networks: [market-os-network]

  market-data-service:
    build: ./apps/market-data-service
    environment:
      BINANCE_WS_URL: wss://stream.binance.com:9443/ws/btcusdt@trade
      REDIS_URL: redis://redis:6379
      MONGO_URL: mongodb://mongo:27017/market-os
      LOG_LEVEL: info
    depends_on: [redis, mongo]
    networks: [market-os-network]

  mongo:
    image: mongo:7
    ports: ["27017:27017"]
    volumes: [mongo-data:/data/db]
    networks: [market-os-network]

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]
    networks: [market-os-network]

networks:
  market-os-network:
    driver: bridge

volumes:
  mongo-data:
```

### 13.1 Health Check 規格

每個服務需定義 `healthcheck`：

```yaml
# api-gateway
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 10s
  timeout: 5s
  retries: 3
  start_period: 15s
```

---

## 14. 環境變數規格

### 14.1 api-gateway

| 變數 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `PORT` | number | 否 | `3000` | 監聽埠 |
| `REDIS_URL` | string | 是 | — | Redis 連線字串 |
| `MONGO_URL` | string | 是 | — | MongoDB 連線字串 |
| `LOG_LEVEL` | string | 否 | `info` | `debug/info/warn/error` |
| `CORS_ORIGIN` | string | 否 | `*` | CORS 允許來源 |
| `WS_MAX_CONNECTIONS` | number | 否 | `50` | WS 最大並發連線數 |

### 14.2 market-data-service

| 變數 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `BINANCE_WS_URL` | string | 是 | — | Binance WS stream URL |
| `REDIS_URL` | string | 是 | — | Redis 連線字串 |
| `MONGO_URL` | string | 是 | — | MongoDB 連線字串 |
| `LOG_LEVEL` | string | 否 | `info` | log level |
| `RECONNECT_MAX_DELAY_MS` | number | 否 | `30000` | 最大重連延遲（ms） |
| `STALE_DATA_THRESHOLD_MS` | number | 否 | `5000` | 亂序資料丟棄閾值（ms） |

---

## 15. 開發規範

### 15.1 TypeScript 規範

```json
// tsconfig.json（所有服務適用）
{
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

- 禁止使用 `any`，使用 `unknown` 替代
- 禁止 magic string，使用 `const enum` 或 `as const`
- 所有 async 函式需明確 return type

### 15.2 Zod Validation 規範

- 所有外部輸入（HTTP request、WebSocket message、Binance payload、環境變數）**必須通過 Zod schema 驗證**
- 驗證失敗統一拋出 `ValidationError`，由統一 error handler 處理

### 15.3 禁止使用的 Magic String

```typescript
// 禁止
redis.publish("market:btcusdt", ...);

// 正確
const REDIS_CHANNELS = {
  BTCUSDT: "market:btcusdt",
} as const;
redis.publish(REDIS_CHANNELS.BTCUSDT, ...);
```

### 15.4 Functional Style 規範

- 優先使用純函式，避免 side effects 散落各處
- 資料轉換邏輯（formatter、parser）與 I/O 邏輯（DB、Redis、WS）分離
- 檔案結構：`handler.ts`（I/O）+ `service.ts`（業務邏輯）+ `formatter.ts`（資料轉換）

### 15.5 Commit 規範

```
feat:     新功能
fix:      Bug 修復
refactor: 重構（不影響功能）
chore:    建置/工具/依賴變更
docs:     文件更新
test:     測試新增或修改
```

---

## 16. 開發順序與驗收條件

### Step 1：建立 Monorepo

**完成標準：**
- [ ] `pnpm-workspace.yaml` 設定完成
- [ ] `packages/shared-types` 可被所有 apps 引用
- [ ] TypeScript project references 設定正確
- [ ] `pnpm install` 無錯誤

### Step 2：建立 Market Data Service

**完成標準：**
- [ ] 成功連線 Binance WebSocket
- [ ] 收到 trade event，log 顯示 `tradeId` 與 `price`
- [ ] Tick 正確寫入 MongoDB（驗證：`db.market_ticks.countDocuments()` 持續增加）
- [ ] K 線正確 upsert（驗證：每分鐘一根，close 為最新 price）
- [ ] Redis Pub/Sub 正確發布（驗證：redis-cli `SUBSCRIBE market:btcusdt` 收到訊息）
- [ ] 強制斷線後，自動重連（驗證：kill -9 後重啟正常）

### Step 3：建立 API Gateway

**完成標準：**
- [ ] `GET /api/health` 回 200 且 services 狀態正確
- [ ] `GET /api/market/latest` 回傳最新 tick
- [ ] `GET /api/market/klines` 回傳 K 線陣列
- [ ] WebSocket `/ws/market` 連線後持續收到 `market:update` 事件
- [ ] Redis 斷線重連後，WS 推播恢復

### Step 4：建立 Frontend

**完成標準：**
- [ ] PriceCard 顯示即時價格，顏色正確（漲/跌）
- [ ] K 線圖載入歷史 100 根，即時更新最後一根
- [ ] 成交量圖正確顯示
- [ ] WebSocket 斷線時顯示「重連中」狀態
- [ ] Lighthouse Performance score > 70

### Step 5：Docker Compose 整合

**完成標準：**
- [ ] `docker compose up` 所有服務健康啟動
- [ ] 前端可透過 `http://localhost:5173` 訪問
- [ ] 所有功能正常（等同 Step 2-4 驗收條件）
- [ ] `docker compose down && docker compose up` 資料不遺失（volume 正確掛載）

### Step 6：E2E 穩定性驗證

**完成標準：**
- [ ] 連續運行 **1 小時**，無 unhandled exception
- [ ] `market_ticks` 無重複 tradeId
- [ ] K 線每分鐘一根（有成交的分鐘）
- [ ] Memory usage 穩定（無明顯 memory leak）

---

## 17. Monorepo 結構

```
market-os/
├── apps/
│   ├── frontend/                    # Vue 3 + TypeScript + Vite
│   │   ├── src/
│   │   │   ├── api/                 # REST API 呼叫
│   │   │   ├── components/
│   │   │   │   ├── PriceCard.vue
│   │   │   │   ├── KlineChart.vue
│   │   │   │   └── VolumeChart.vue
│   │   │   ├── composables/
│   │   │   │   └── useWebSocket.ts
│   │   │   ├── services/
│   │   │   │   └── marketWebSocket.ts
│   │   │   ├── stores/
│   │   │   │   └── market.ts        # Pinia store
│   │   │   ├── types/               # 前端專用型別
│   │   │   ├── views/
│   │   │   │   └── DashboardView.vue
│   │   │   └── main.ts
│   │   ├── Dockerfile
│   │   └── vite.config.ts
│   │
│   ├── api-gateway/                 # Fastify + TypeScript
│   │   ├── src/
│   │   │   ├── handlers/
│   │   │   │   ├── health.ts
│   │   │   │   ├── market.ts        # REST handlers
│   │   │   │   └── websocket.ts     # WS handler
│   │   │   ├── services/
│   │   │   │   └── redisSubscriber.ts
│   │   │   ├── plugins/
│   │   │   │   ├── mongodb.ts
│   │   │   │   └── redis.ts
│   │   │   ├── schemas/             # Zod schemas
│   │   │   └── main.ts
│   │   └── Dockerfile
│   │
│   └── market-data-service/         # Node.js + TypeScript
│       ├── src/
│       │   ├── connectors/
│       │   │   └── binanceWebSocket.ts
│       │   ├── services/
│       │   │   ├── tickProcessor.ts  # 資料格式化
│       │   │   └── klineAggregator.ts
│       │   ├── repositories/
│       │   │   ├── tickRepository.ts
│       │   │   └── klineRepository.ts
│       │   ├── publishers/
│       │   │   └── redisPublisher.ts
│       │   ├── schemas/              # Zod schemas
│       │   └── main.ts
│       └── Dockerfile
│
├── packages/
│   ├── shared-types/                # 共用 TypeScript 型別
│   │   └── src/
│   │       ├── market.ts            # MarketTick, Kline, WebSocketMessage
│   │       └── index.ts
│   │
│   └── config/                      # 共用設定（常數、env parser）
│       └── src/
│           ├── constants.ts         # REDIS_CHANNELS, SYMBOLS 等
│           └── env.ts               # Zod env validation
│
├── infra/
│   └── docker/
│       └── nginx/                   # Phase 2 用
│
├── docker-compose.yml
├── pnpm-workspace.yaml
├── package.json                     # root package.json
└── README.md
```

---

## 18. 套件版本與相依性

### 18.1 全域工具版本

| 工具 | 版本 | 備註 |
|---|---|---|
| Node.js | `20.x` LTS | 所有服務統一 |
| pnpm | `9.x` | Workspace 管理 |
| TypeScript | `5.5.x` | 統一版本避免相容性問題 |

`.nvmrc`（root）：

```
20
```

`package.json`（root）：

```json
{
  "name": "market-os",
  "private": true,
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=9.0.0"
  },
  "packageManager": "pnpm@9.12.0",
  "scripts": {
    "dev": "pnpm -r --parallel dev",
    "build": "pnpm -r build",
    "test": "pnpm -r test",
    "lint": "pnpm -r lint"
  }
}
```

`pnpm-workspace.yaml`：

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

---

### 18.2 共用 devDependencies（所有 TS 服務）

```json
{
  "devDependencies": {
    "typescript": "5.5.4",
    "tsx": "4.19.0",
    "vitest": "2.1.1",
    "@types/node": "20.16.5",
    "eslint": "9.10.0",
    "@typescript-eslint/parser": "8.6.0",
    "@typescript-eslint/eslint-plugin": "8.6.0",
    "prettier": "3.3.3"
  }
}
```

---

### 18.3 `apps/market-data-service` 相依性

```json
{
  "dependencies": {
    "ws": "8.18.0",
    "mongodb": "6.9.0",
    "ioredis": "5.4.1",
    "zod": "3.23.8",
    "pino": "9.4.0",
    "decimal.js": "10.4.3"
  },
  "devDependencies": {
    "@types/ws": "8.5.12"
  },
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js",
    "test": "vitest run"
  }
}
```

---

### 18.4 `apps/api-gateway` 相依性

```json
{
  "dependencies": {
    "fastify": "5.0.0",
    "@fastify/cors": "10.0.1",
    "@fastify/rate-limit": "10.1.1",
    "@fastify/websocket": "11.0.1",
    "mongodb": "6.9.0",
    "ioredis": "5.4.1",
    "zod": "3.23.8",
    "pino": "9.4.0",
    "pino-pretty": "11.2.2"
  },
  "scripts": {
    "dev": "tsx watch src/main.ts",
    "build": "tsc",
    "start": "node dist/main.js",
    "test": "vitest run"
  }
}
```

---

### 18.5 `apps/frontend` 相依性

```json
{
  "dependencies": {
    "vue": "3.5.8",
    "vue-router": "4.4.5",
    "pinia": "2.2.2",
    "echarts": "5.5.1",
    "decimal.js": "10.4.3"
  },
  "devDependencies": {
    "vite": "5.4.7",
    "@vitejs/plugin-vue": "5.1.4",
    "vue-tsc": "2.1.6",
    "tailwindcss": "3.4.12",
    "postcss": "8.4.47",
    "autoprefixer": "10.4.20",
    "@vitest/browser": "2.1.1"
  },
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  }
}
```

---

### 18.6 `packages/shared-types` 相依性

```json
{
  "name": "@market-os/shared-types",
  "version": "0.1.0",
  "main": "./src/index.ts",
  "types": "./src/index.ts",
  "dependencies": {
    "zod": "3.23.8"
  }
}
```

> **重要：** `shared-types` 直接 export TypeScript source（不 build），各 app 透過 workspace protocol 引用：  
> `"@market-os/shared-types": "workspace:*"`

---

### 18.7 共用 tsconfig.base.json（root）

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noImplicitAny": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

各 app 的 `tsconfig.json` 繼承：

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

---

## 19. 實作 Pattern 指引

### 19.1 Decimal128 與 String 處理規則

**核心原則：**

```
傳輸層    → string（JSON 序列化安全）
聚合運算  → decimal.js Decimal 物件（高精度算術）
儲存層    → MongoDB Decimal128（精確儲存）
顯示層    → number（前端 toLocaleString）
```

#### 19.1.1 寫入 MongoDB（string → Decimal128）

```typescript
import { Decimal128 } from 'mongodb';

const tickDoc = {
  symbol: tick.symbol,
  tradeId: tick.tradeId,
  price: Decimal128.fromString(tick.price),       // "104523.45" → Decimal128
  quantity: Decimal128.fromString(tick.quantity),
  eventTime: tick.eventTime,
  createdAt: new Date(),
};
```

#### 19.1.2 K 線聚合運算（decimal.js）

```typescript
import Decimal from 'decimal.js';

// volume 累加：永遠用 string 進 → Decimal 算 → string 出
function addVolume(currentVolume: string, addQty: string): string {
  return new Decimal(currentVolume).plus(addQty).toFixed(8);
}

// high / low 比較：用 Decimal 比較，不可用 parseFloat
function isHigher(newPrice: string, currentHigh: string): boolean {
  return new Decimal(newPrice).greaterThan(currentHigh);
}
```

#### 19.1.3 MongoDB `$max/$min/$inc` 的特殊處理

⚠️ **MongoDB 的 `$max/$min` 對 Decimal128 比較是正確的**，但 `$inc` 對 Decimal128 可能精度損失。

**建議方案：**

```typescript
// 不要用 $inc 累加 Decimal128 volume
// 改為：每次 upsert 前讀取當前 K 線，用 decimal.js 計算後 $set

async function updateKline(tick: MarketTick): Promise<void> {
  const openTime = Math.floor(tick.eventTime / 60000) * 60000;

  const existing = await klines.findOne({ symbol: tick.symbol, interval: '1m', openTime });

  if (!existing) {
    await klines.insertOne({
      symbol: tick.symbol,
      interval: '1m',
      openTime,
      closeTime: openTime + 59999,
      open: Decimal128.fromString(tick.price),
      high: Decimal128.fromString(tick.price),
      low: Decimal128.fromString(tick.price),
      close: Decimal128.fromString(tick.price),
      volume: Decimal128.fromString(tick.quantity),
      tradeCount: 1,
      updatedAt: new Date(),
    });
    return;
  }

  const newVolume = new Decimal(existing.volume.toString())
    .plus(tick.quantity)
    .toFixed(8);

  const newHigh = new Decimal(tick.price).gt(existing.high.toString())
    ? tick.price : existing.high.toString();

  const newLow = new Decimal(tick.price).lt(existing.low.toString())
    ? tick.price : existing.low.toString();

  await klines.updateOne(
    { _id: existing._id },
    {
      $set: {
        close: Decimal128.fromString(tick.price),
        high: Decimal128.fromString(newHigh),
        low: Decimal128.fromString(newLow),
        volume: Decimal128.fromString(newVolume),
        updatedAt: new Date(),
      },
      $inc: { tradeCount: 1 },  // tradeCount 是 integer，可安全 $inc
    }
  );
}
```

> 並發風險：高頻 tick 下，findOne + updateOne 非原子操作。Phase 1 接受此風險（單一 service 寫入，無並發）。Phase 2 改用 in-memory 聚合 + 定時 flush。

#### 19.1.4 讀取後序列化為 JSON

```typescript
function klineToDTO(doc: KlineDoc): Kline {
  return {
    openTime: doc.openTime,
    closeTime: doc.closeTime,
    open: doc.open.toString(),    // Decimal128 → string
    high: doc.high.toString(),
    low: doc.low.toString(),
    close: doc.close.toString(),
    volume: doc.volume.toString(),
    tradeCount: doc.tradeCount,
  };
}
```

---

### 19.2 Redis Subscriber → WebSocket Broadcast Pattern

**架構：Fan-out**

```
單一 Redis subscriber instance
   ↓ in-memory event emitter
多個 WS client connections
```

**實作骨架：**

```typescript
// apps/api-gateway/src/services/marketBroadcast.ts
import { EventEmitter } from 'node:events';
import Redis from 'ioredis';

const REDIS_CHANNELS = { BTCUSDT: 'market:btcusdt' } as const;

export class MarketBroadcast extends EventEmitter {
  private subscriber: Redis;

  constructor(redisUrl: string) {
    super();
    this.setMaxListeners(100);  // 與 WS_MAX_CONNECTIONS 對齊
    this.subscriber = new Redis(redisUrl);
  }

  async start(): Promise<void> {
    await this.subscriber.subscribe(REDIS_CHANNELS.BTCUSDT);
    this.subscriber.on('message', (_channel, payload) => {
      try {
        const msg = JSON.parse(payload);
        this.emit('market:update', msg);
      } catch (err) {
        // log error, 不中斷
      }
    });
  }

  async stop(): Promise<void> {
    await this.subscriber.quit();
    this.removeAllListeners();
  }
}
```

**WS handler 訂閱：**

```typescript
// apps/api-gateway/src/handlers/websocket.ts
fastify.get('/ws/market', { websocket: true }, (socket, _req) => {
  const onUpdate = (msg: unknown) => {
    if (socket.readyState === socket.OPEN) {
      socket.send(JSON.stringify(msg));
    }
  };

  broadcast.on('market:update', onUpdate);

  socket.on('close', () => {
    broadcast.off('market:update', onUpdate);
  });
});
```

**為什麼用 fan-out 而非每 client 一個 subscriber？**

| 比較項 | Fan-out | Per-client subscriber |
|---|---|---|
| Redis 連線數 | 1 | N（每 client 1 個） |
| 記憶體 | 低 | 高 |
| 50 個 client 負載 | 1 個 Redis sub | 50 個 Redis sub |

---

### 19.3 Frontend 連線設定

#### 19.3.1 環境變數（`apps/frontend/.env.example`）

```
VITE_API_BASE_URL=http://localhost:3000/api
VITE_WS_URL=ws://localhost:3000/ws/market
```

```
# .env.production
VITE_API_BASE_URL=/api
VITE_WS_URL=/ws/market
```

#### 19.3.2 Vite Proxy 設定（開發模式）

```typescript
// apps/frontend/vite.config.ts
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/ws': {
        target: 'ws://localhost:3000',
        ws: true,
        changeOrigin: true,
      },
    },
  },
});
```

#### 19.3.3 WebSocket Service 樣板

```typescript
// apps/frontend/src/services/marketWebSocket.ts
import type { WebSocketMessage } from '@market-os/shared-types';

export class MarketWebSocket {
  private ws: WebSocket | null = null;
  private reconnectAttempt = 0;
  private pingTimer: number | null = null;

  constructor(
    private url: string,
    private onMessage: (msg: WebSocketMessage) => void,
    private onStatusChange: (s: 'connected' | 'reconnecting' | 'disconnected') => void,
  ) {}

  connect(): void {
    this.ws = new WebSocket(this.url);
    this.ws.onopen = () => {
      this.reconnectAttempt = 0;
      this.onStatusChange('connected');
      this.startPing();
    };
    this.ws.onmessage = (e) => this.onMessage(JSON.parse(e.data));
    this.ws.onclose = () => {
      this.stopPing();
      this.onStatusChange('reconnecting');
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    const delay = Math.min(Math.pow(2, this.reconnectAttempt) * 1000, 30000);
    this.reconnectAttempt += 1;
    setTimeout(() => this.connect(), delay);
  }

  private startPing(): void {
    this.pingTimer = window.setInterval(() => {
      this.ws?.send(JSON.stringify({ type: 'ping' }));
    }, 30000);
  }

  private stopPing(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
  }
}
```

---

### 19.4 K 線重啟恢復邏輯

**問題：** Market Data Service 在 14:23:45 重啟，14:23 這根 K 線只有前 45 秒的資料。

**Phase 1 解法：從 MongoDB 讀回當前未完成 K 線繼續累加**

```typescript
// apps/market-data-service/src/services/klineAggregator.ts

class KlineAggregator {
  private currentKline: Kline | null = null;

  async initialize(symbol: string): Promise<void> {
    // 啟動時從 MongoDB 讀取「當前分鐘」的 K 線（若有）
    const now = Date.now();
    const currentOpenTime = Math.floor(now / 60000) * 60000;

    const existing = await klines.findOne({
      symbol,
      interval: '1m',
      openTime: currentOpenTime,
    });

    if (existing) {
      this.currentKline = klineFromDoc(existing);
      logger.info({ openTime: currentOpenTime }, 'Resumed in-progress kline');
    }
  }

  async processTick(tick: MarketTick): Promise<void> {
    const openTime = Math.floor(tick.eventTime / 60000) * 60000;

    if (!this.currentKline || this.currentKline.openTime !== openTime) {
      // 新 K 線
      this.currentKline = this.createNewKline(tick, openTime);
    } else {
      // 累加到現有 K 線
      this.updateKline(this.currentKline, tick);
    }

    await this.persistKline(this.currentKline);
  }
}
```

**啟動 log：**

```
info: Service starting, symbol=BTCUSDT
info: Resumed in-progress kline, openTime=1748131380000, currentVolume=2.34
info: Connected to Binance WS
```

---

### 19.5 Dockerfile 模板

#### 19.5.1 Node 服務（market-data-service / api-gateway）

```dockerfile
# apps/market-data-service/Dockerfile

# === Stage 1: Build ===
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@9.12.0

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY tsconfig.base.json ./
COPY packages/shared-types ./packages/shared-types
COPY apps/market-data-service ./apps/market-data-service

RUN pnpm install --frozen-lockfile
RUN pnpm --filter market-data-service build

# === Stage 2: Runtime ===
FROM node:20-alpine AS runtime
WORKDIR /app

RUN npm install -g pnpm@9.12.0

COPY --from=builder /app/pnpm-workspace.yaml /app/package.json /app/pnpm-lock.yaml ./
COPY --from=builder /app/packages/shared-types ./packages/shared-types
COPY --from=builder /app/apps/market-data-service/package.json ./apps/market-data-service/
COPY --from=builder /app/apps/market-data-service/dist ./apps/market-data-service/dist

RUN pnpm install --frozen-lockfile --prod

WORKDIR /app/apps/market-data-service

ENV NODE_ENV=production
USER node

CMD ["node", "dist/main.js"]
```

#### 19.5.2 Frontend（Vue 3 + Nginx）

```dockerfile
# apps/frontend/Dockerfile

# === Stage 1: Build ===
FROM node:20-alpine AS builder
WORKDIR /app

RUN npm install -g pnpm@9.12.0

COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared-types ./packages/shared-types
COPY apps/frontend ./apps/frontend

RUN pnpm install --frozen-lockfile
RUN pnpm --filter frontend build

# === Stage 2: Nginx ===
FROM nginx:alpine
COPY --from=builder /app/apps/frontend/dist /usr/share/nginx/html
COPY apps/frontend/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
```

#### 19.5.3 Frontend `nginx.conf`

```nginx
server {
  listen 80;
  root /usr/share/nginx/html;
  index index.html;

  location / {
    try_files $uri $uri/ /index.html;
  }

  location /api/ {
    proxy_pass http://api-gateway:3000/api/;
    proxy_set_header Host $host;
  }

  location /ws/ {
    proxy_pass http://api-gateway:3000/ws/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
  }
}
```

#### 19.5.4 `.dockerignore`（root）

```
node_modules
**/node_modules
**/dist
**/.env
**/.env.local
.git
.github
*.md
```

---

### 19.6 開發模式 vs 生產模式

| 項目 | Development | Production |
|---|---|---|
| TS 執行 | `tsx watch src/main.ts` | `node dist/main.js` |
| Frontend | `vite dev` (port 5173) | Nginx 靜態檔案 |
| Log 格式 | `pino-pretty`（彩色） | JSON line |
| Source map | 開啟 | 關閉 |
| Docker 映像 | 不建議跑 dev 模式 | multi-stage build |

---

---

## 20. Phase 2 規格

Phase 2 在 Phase 1 MVP 基礎上擴充，不破壞既有 API 合約。

### 20.1 多 K 線週期（P2-1）

**新增週期：** `5m`、`15m`、`1h`（原有 `1m` 不變）

#### 20.1.1 後端變更

**`packages/config` 新增常數：**

```typescript
export const KLINE_INTERVALS = {
  ONE_MINUTE:      '1m',
  FIVE_MINUTES:    '5m',
  FIFTEEN_MINUTES: '15m',
  ONE_HOUR:        '1h',
} as const;

export type KlineInterval = (typeof KLINE_INTERVALS)[keyof typeof KLINE_INTERVALS];

export const KLINE_INTERVAL_MS: Record<string, number> = {
  '1m':  60_000,
  '5m':  300_000,
  '15m': 900_000,
  '1h':  3_600_000,
};
```

**`klineAggregator` 函式簽名更新：**

```typescript
// calcOpenTime 新增 intervalMs 參數
export function calcOpenTime(eventTime: number, intervalMs: number): number

// createKline / aggregateTick 新增 interval / intervalMs 參數
export function createKline(tick: MarketTick, interval: string, intervalMs: number): KlineState
export function aggregateTick(current, tick, interval, intervalMs): KlineState

// KlineAggregator 建構子新增 interval / intervalMs 參數
new KlineAggregator(interval: string, intervalMs: number, klineRepo, logger)
```

**`market-data-service/main.ts`：** 啟動 4 個 aggregator，每筆 tick 並行寫入所有週期：

```typescript
const aggregators = Object.entries(KLINE_INTERVAL_MS).map(
  ([interval, ms]) => new KlineAggregator(interval, ms, klineRepo, logger),
);
await Promise.all(aggregators.map((a) => a.initialize(SYMBOLS.BTCUSDT)));
```

**`api-gateway` queryParams 更新：**

```typescript
interval: z.enum(['1m', '5m', '15m', '1h']).default('1m')
```

#### 20.1.2 前端變更

- `stores/market.ts`：新增 `selectedInterval`、`setInterval()`，`updateLatestKline` 依週期計算 openTime / closeTime
- `DashboardView.vue`：圖表上方加入週期按鈕
- `KlineChart.vue`：`interval` prop，1h 週期顯示日期+時間

#### 20.1.3 MongoDB K 線結構（無變更）

`klines` collection 已有 `interval` 欄位，多週期自然支援。複合唯一索引 `(symbol, interval, openTime)` 確保各週期獨立存儲。

---

### 20.2 FinMind 台股日 K 整合（P2-2 / P2-3）

**資料來源：** [FinMind](https://finmindtrade.com) 公開 API（免費方案）

**使用的 dataset：**

| Dataset | 用途 |
|---|---|
| `TaiwanStockPrice` | 台股日 OHLCV 資料 |
| `TaiwanStockInfo` | 股票代號 → 公司名稱、產業別 |

#### 20.2.1 新增 API Endpoint

**`GET /api/tw-stock/klines`**

| 參數 | 型別 | 必填 | 預設 | 說明 |
|---|---|---|---|---|
| `symbol` | string | 是 | — | 台股代號，如 `2330` |
| `days` | number | 否 | `120` | 往前幾個交易日，最大 500 |

**Response 200：**

```json
{
  "symbol": "2330",
  "companyName": "台積電",
  "industry": "電子工業",
  "data": [
    {
      "date": "2025-05-02",
      "stockId": "2330",
      "open": 938,
      "high": 950,
      "low": 932,
      "close": 950,
      "spread": 42,
      "volume": 48129292,
      "turnover": 99509
    }
  ]
}
```

**Response 400：** `VALIDATION_ERROR`（參數錯誤）

**Response 502：** `UPSTREAM_ERROR`（FinMind API 不可用）

#### 20.2.2 TwStockKline 型別（shared-types）

```typescript
export interface TwStockKline {
  date: string;       // YYYY-MM-DD
  stockId: string;
  open: number;
  high: number;
  low: number;
  close: number;
  spread: number;     // 漲跌金額
  volume: number;     // 成交股數
  turnover: number;   // 成交筆數
}
```

#### 20.2.3 後端實作細節

**代理架構（不直接暴露 Token 至前端）：**

```
瀏覽器 → GET /api/tw-stock/klines?symbol=2330
              ↓
         api-gateway（帶 FINMIND_TOKEN 呼叫 FinMind）
              ↓
         FinMind API → 回傳 TaiwanStockPrice
```

**公司名稱快取（in-memory，24h TTL）：**

```typescript
// 啟動後第一次請求時載入全部 TaiwanStockInfo
// 後續直接從 Map<stockId, { name, industry }> 查詢
// 每 24h 重新載入
```

#### 20.2.4 環境變數新增

**api-gateway：**

| 變數 | 型別 | 必填 | 說明 |
|---|---|---|---|
| `FINMIND_TOKEN` | string | 是 | FinMind JWT Token，從 finmindtrade.com 取得 |

**docker-compose.yml：**

```yaml
api-gateway:
  environment:
    FINMIND_TOKEN: ${FINMIND_TOKEN:-}   # 從根目錄 .env 讀取
```

#### 20.2.5 前端新增路由與頁面

| 路徑 | Component | 說明 |
|---|---|---|
| `/` | `DashboardView` | BTC 即時儀表板（不變） |
| `/tw-stock` | `TwStockView` | 台股日 K 查詢 |

**App.vue 頂部導覽列：** 提供「BTC 即時」和「台股日K」切換。

**TwStockView 功能：**
- 股票代號輸入框（支援 Enter 送出）
- 60 / 120 / 240 日切換按鈕
- 標頭顯示：公司名稱、代號、產業別標籤
- 最新收盤價、漲跌金額、漲跌幅百分比
- ECharts 日 K 線 + 成交量圖（風格與 BTC 一致）

---

### 20.3 Phase 2 測試總覽

| 服務 | 測試數 | 說明 |
|---|---|---|
| market-data-service | 27 | 新增 5m 週期邊界測試 |
| api-gateway | 11 | 不變 |
| frontend | 5 | 不變 |
| **合計** | **43** | 全通過 |

---

### 20.4 Phase 2 路由結構總覽

```
GET  /api/health                          （不變）
GET  /api/market/latest                   （不變）
GET  /api/market/klines?interval=1m|5m|15m|1h  （interval 擴展）
GET  /api/tw-stock/klines?symbol=&days=   （新增）
WS   /ws/market                           （不變）
```

---

*文件版本：v1.2 | 最後更新：2026-05-27*
