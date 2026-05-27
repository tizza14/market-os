# 資料契約

定義術語、shared types、MongoDB schema、資料精度、環境變數。**任何變動必須在同一 PR 內更新此文件。**

---

## 1. 術語

| 術語 | 定義 |
|---|---|
| Tick | 單筆成交資料，來自 Binance `@trade` stream |
| Kline | OHLCV 聚合資料，支援 `1m` / `5m` / `15m` / `1h` |
| OHLCV | Open / High / Low / Close / Volume |
| eventTime | Unix 毫秒（ms），UTC |
| tradeId | Binance 唯一成交 ID，用於去重 |
| Symbol | 交易對識別符（BTCUSDT 全大寫，台股為純數字代號如 2330） |

---

## 2. Shared Types

定義於 `packages/shared-types/src/index.ts`。**前後端共用，新增/修改型別必須同步此文件。**

```typescript
export interface MarketTick {
  symbol: string;          // "BTCUSDT"
  price: string;           // string 傳輸，避免浮點數損失
  quantity: string;
  isBuyerMaker: boolean;
  tradeId: number;
  eventTime: number;       // Unix ms, UTC
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

export interface TwStockKline {
  date: string;            // YYYY-MM-DD
  stockId: string;
  open: number;            // FinMind 原生 number
  high: number;
  low: number;
  close: number;
  spread: number;          // 漲跌
  volume: number;          // 成交股數
  turnover: number;        // 成交筆數
}

export type WebSocketMessage =
  | { type: 'market:update'; data: MarketTick }
  | { type: 'market:error'; data: { code: string; message: string } }
  | { type: 'pong'; timestamp: number };
```

---

## 3. 資料精度

### 3.1 BTC（Binance 資料）

| 層級 | 型別 | 範例 |
|---|---|---|
| 傳輸 | `string` | `"104523.45"` |
| 儲存 | `Decimal128`（MongoDB） | `Decimal128("104523.45")` |
| 聚合運算 | `decimal.js` `Decimal` | `new Decimal("104523.45")` |
| 顯示 | `number`（前端 toLocaleString） | `104523.45` |

**核心原則：** 跨服務絕不傳 `number`，避免 JavaScript 浮點數損失。

### 3.2 台股（FinMind 資料）

FinMind 原始回傳即為 `number`，直接保留 `number` 型別。台股價格小數位有限（< 4 位），浮點數精度足夠。

### 3.3 時間

| 場景 | 格式 | 時區 |
|---|---|---|
| `eventTime`, `openTime`, `closeTime` | Unix 毫秒（number） | UTC |
| `createdAt`, `updatedAt`（MongoDB） | ISO 8601 / Date | UTC |
| 台股 `date` | `YYYY-MM-DD`（string） | 台北 |

前端顯示時統一 toLocaleString，由 browser 處理時區。

---

## 4. MongoDB Schema

### Collection: `market_ticks`

```typescript
{
  _id: ObjectId;
  symbol: string;            // "BTCUSDT"
  tradeId: number;           // unique index
  price: Decimal128;
  quantity: Decimal128;
  buyerOrderId?: number;     // optional（Binance 可能未提供）
  sellerOrderId?: number;    // optional
  isBuyerMaker: boolean;
  eventTime: number;
  createdAt: Date;           // TTL index
}
```

**Indexes：**
- `{ tradeId: 1 }` unique（去重）
- `{ symbol: 1, eventTime: -1 }` 查詢
- `{ createdAt: 1 }` expireAfterSeconds: 604800（TTL 7 天）

### Collection: `klines`

```typescript
{
  _id: ObjectId;
  symbol: string;
  interval: string;          // "1m" | "5m" | "15m" | "1h"
  openTime: number;
  closeTime: number;         // openTime + intervalMs - 1
  open: Decimal128;
  high: Decimal128;
  low: Decimal128;
  close: Decimal128;
  volume: Decimal128;
  tradeCount: number;
  updatedAt: Date;
}
```

**Indexes：**
- `{ symbol: 1, interval: 1, openTime: 1 }` unique（upsert key）
- `{ symbol: 1, interval: 1, openTime: -1 }` 查詢

**保留策略：** 永久保留（無 TTL）。

---

## 5. 常數定義

定義於 `packages/config/src/index.ts`。**禁止 magic string，跨服務常數一律走 config 套件。**

```typescript
export const SYMBOLS = { BTCUSDT: 'BTCUSDT' } as const;

export const REDIS_CHANNELS = { BTCUSDT: 'market:btcusdt' } as const;

export const KLINE_INTERVALS = {
  ONE_MINUTE:      '1m',
  FIVE_MINUTES:    '5m',
  FIFTEEN_MINUTES: '15m',
  ONE_HOUR:        '1h',
} as const;

export const KLINE_INTERVAL_MS: Record<string, number> = {
  '1m':  60_000,
  '5m':  300_000,
  '15m': 900_000,
  '1h':  3_600_000,
};

export const WS_MESSAGE_TYPES = {
  MARKET_UPDATE: 'market:update',
  MARKET_ERROR:  'market:error',
  PING:          'ping',
  PONG:          'pong',
} as const;
```

---

## 6. 資料品質規則

### 6.1 Tick 去重

- `tradeId` 為唯一鍵
- MongoDB 寫入 duplicate key error → **靜默忽略**，記 debug log

### 6.2 K 線去重

- 複合唯一鍵 `(symbol, interval, openTime)`
- 用 `upsert` 操作，同根 K 線持續更新 close/high/low/volume

### 6.3 亂序資料

- Tick `eventTime` 早於最近一筆超過 `STALE_DATA_THRESHOLD_MS`（預設 5000ms）→ 記 warn 並丟棄
- K 線以 `openTime` 為準，不依賴接收順序

### 6.4 資料缺口

- 不填補 K 線缺口（無成交的時段不產生 K 線）
- 前端圖表自然呈現缺口

---

## 7. 環境變數

### market-data-service

| 變數 | 必填 | 預設 | 說明 |
|---|---|---|---|
| `BINANCE_WS_URL` | 否 | `wss://stream.binance.com:9443/ws/btcusdt@trade` | Binance WS 串流 URL |
| `REDIS_URL` | 是 | — | Redis 連線字串 |
| `MONGO_URL` | 是 | — | MongoDB 連線字串 |
| `LOG_LEVEL` | 否 | `info` | `debug` / `info` / `warn` / `error` |
| `STALE_DATA_THRESHOLD_MS` | 否 | `5000` | 亂序資料丟棄閾值 |

### api-gateway

| 變數 | 必填 | 預設 | 說明 |
|---|---|---|---|
| `PORT` | 否 | `3000` | 監聽埠 |
| `REDIS_URL` | 是 | — | Redis |
| `MONGO_URL` | 是 | — | MongoDB |
| `LOG_LEVEL` | 否 | `info` | log level |
| `CORS_ORIGIN` | 否 | `*` | CORS 允許來源 |
| `WS_MAX_CONNECTIONS` | 否 | `50` | WS 最大並發 |
| `FINMIND_TOKEN` | 否 | `''` | FinMind JWT，空字串時台股 API 仍可呼叫但會收到上游錯誤 |

### frontend

| 變數 | 必填 | 預設 | 說明 |
|---|---|---|---|
| `VITE_API_BASE_URL` | 否 | `/api` | REST base URL |
| `VITE_WS_URL` | 否 | `/ws/market` | WebSocket URL |

### docker compose 根目錄 `.env`

```
FINMIND_TOKEN=<jwt>
```

被 `docker-compose.yml` 透過 `${FINMIND_TOKEN:-}` 注入 api-gateway。
