# API 契約

定義所有對外與服務間的介面。**任何變動必須在同一 PR 內更新此文件。**

---

## 1. REST API

Base URL：開發環境 `http://localhost:3000/api`，生產環境 `/api`（由 Nginx 反代）。

統一錯誤格式：

```typescript
{
  error: {
    code: string;       // 大寫底線，如 "VALIDATION_ERROR"
    message: string;
    details?: Array<{ field: string; message: string }>;
  }
}
```

### Error Code 清單

| Code | HTTP | 說明 |
|---|---|---|
| `VALIDATION_ERROR` | 400 | 請求參數驗證失敗 |
| `NOT_FOUND` | 404 | 資源不存在 |
| `NO_DATA` | 404 | 查詢無結果 |
| `RATE_LIMITED` | 429 | 超過速率限制 |
| `INTERNAL_ERROR` | 500 | 未預期錯誤 |
| `UPSTREAM_ERROR` | 502 | 上游 API（FinMind）不可用 |
| `SOURCE_DISCONNECTED` | 503 | 上游資料源（Binance）斷線 |
| `SERVICE_UNAVAILABLE` | 503 | 服務暫時不可用 |

---

### `GET /api/health`

**Response 200：**
```json
{
  "status": "ok",
  "timestamp": 1748131200000,
  "services": { "mongo": "connected", "redis": "connected" }
}
```

**Response 503（任一服務異常）：** `status: "degraded"`，個別 service 標記 `disconnected`。

---

### `GET /api/market/latest`

回傳最新一筆 BTCUSDT tick。

**Response 200：**
```json
{
  "symbol": "BTCUSDT",
  "price": "104523.45",
  "quantity": "0.00123456",
  "eventTime": 1748131200000
}
```

**404：** `code: "NO_DATA"`

---

### `GET /api/market/klines`

| 參數 | 型別 | 必填 | 預設 | 範圍 |
|---|---|---|---|---|
| `symbol` | string | 否 | `BTCUSDT` | 僅 `BTCUSDT` |
| `interval` | string | 否 | `1m` | `1m` / `5m` / `15m` / `1h` |
| `limit` | number | 否 | `100` | 1–500 |

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

`data` 按 `openTime` 升序。

---

### `GET /api/tw-stock/klines`

代理 FinMind TaiwanStockPrice。

| 參數 | 型別 | 必填 | 預設 | 範圍 |
|---|---|---|---|---|
| `symbol` | string | 是 | — | 1–10 字元，台股代號 |
| `days` | number | 否 | `120` | 1–500 |

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

`companyName` / `industry` 從 `TaiwanStockInfo` dataset 取得，後端 in-memory 快取 24h。
查無公司資料時 `companyName` 退回為 `symbol`，`industry` 為空字串。

**502：** `code: "UPSTREAM_ERROR"`（FinMind 不可用或回傳非 200）

---

## 2. WebSocket

### `WS /ws/market`

**連線流程：** 連上後 server 持續推播 BTCUSDT tick。

**Server → Client 訊息：**

```typescript
type WebSocketMessage =
  | { type: 'market:update'; data: MarketTick }
  | { type: 'market:error'; data: { code: string; message: string } }
  | { type: 'pong'; timestamp: number };
```

`MarketTick` 型別見 [data.md](data.md#shared-types)。

**Client → Server：**
- `{ "type": "ping" }` — Client 每 30 秒發送，server 回 `pong`
- 若 server 60 秒未收到 ping，主動關閉連線（code: 4000）

**並發上限：** 預設 50（`WS_MAX_CONNECTIONS`），超過時 HTTP 503 拒絕升級。

---

## 3. Redis Pub/Sub

服務間即時訊息傳遞通道（market-data-service → api-gateway）。

| Channel | 用途 | Payload |
|---|---|---|
| `market:btcusdt` | BTCUSDT 即時 tick | `{ type: "market:update", data: MarketTick }` |

**訊息大小：** 單則 < 1KB。超過記 warn 並截斷非必要欄位。

**常數定義：** 見 `packages/config/src/index.ts` 的 `REDIS_CHANNELS`，禁止 magic string。

---

## 4. Rate Limiting

| Endpoint | 限制 |
|---|---|
| `GET /api/*` | 100 req / 分鐘 / IP |
| `GET /api/health` | 無限制 |
| WS 連線建立 | 10 次 / 分鐘 / IP |

---

## 5. CORS

| 環境 | 設定 |
|---|---|
| 開發 | `CORS_ORIGIN=*` |
| 生產 | 僅允許 frontend service origin |
