# 外部 API 契約

對接 Binance 與 FinMind 的格式定義。外部 API 變動時，這份文件先改、再改 code。

---

## 1. Binance Trade Stream

### Endpoint

```
wss://stream.binance.com:9443/ws/btcusdt@trade
```

公開串流，無需 API Key，免費。

### Payload（原始）

```json
{
  "e": "trade",
  "E": 1710000000000,
  "s": "BTCUSDT",
  "t": 123456789,
  "p": "104523.45",
  "q": "0.00123456",
  "T": 1710000000000,
  "m": false
}
```

`b`（buyer order ID）和 `a`（seller order ID）**已被 Binance 移除**，schema 中標記為 `.optional()`。詳見 [decisions.md](../design/decisions.md#1-binance-trade-stream-移除-b--a-欄位)。

### 欄位對應（→ MarketTick）

| Binance | 內部欄位 | 備註 |
|---|---|---|
| `E` | `eventTime` | Unix ms |
| `s` | `symbol` | 轉為大寫 |
| `t` | `tradeId` | 去重 key |
| `p` | `price` | 維持 string |
| `q` | `quantity` | 維持 string |
| `b` (optional) | `buyerOrderId` | 可能不存在 |
| `a` (optional) | `sellerOrderId` | 可能不存在 |
| `m` | `isBuyerMaker` | boolean |

### Zod Schema 位置

`apps/market-data-service/src/schemas/binanceTrade.ts`

驗證失敗 → 記 error log 並丟棄，**不拋例外**。

### 重連機制

| Attempt | Delay |
|---|---|
| 0 | 立即 |
| 1 | 1s |
| 2 | 2s |
| 3 | 4s |
| 4 | 8s |
| 5 | 16s |
| 6+ | 30s（上限） |

連線成功後重置 attempt = 0。

### Heartbeat

- Binance 每 3 分鐘發送 ping
- 客戶端必須 10 秒內回 pong
- 60 秒無訊息 → 主動觸發重連

---

## 2. FinMind API

### Base URL

```
https://api.finmindtrade.com/api/v4/data
```

### 認證

JWT Token（環境變數 `FINMIND_TOKEN`），免費註冊 [finmindtrade.com](https://finmindtrade.com) 取得。

### 使用的 Dataset

#### 2.1 `TaiwanStockPrice`

每日 OHLCV 資料。

**Query：**
```
?dataset=TaiwanStockPrice&data_id=<symbol>&start_date=<YYYY-MM-DD>&token=<jwt>
```

**Response：**
```json
{
  "msg": "success",
  "status": 200,
  "data": [
    {
      "date": "2025-05-02",
      "stock_id": "2330",
      "Trading_Volume": 48129292,
      "Trading_money": 45206565214,
      "open": 938.0,
      "max": 950.0,
      "min": 932.0,
      "close": 950.0,
      "spread": 42.0,
      "Trading_turnover": 99509
    }
  ]
}
```

**欄位對應（→ TwStockKline）：**

| FinMind | 內部欄位 |
|---|---|
| `date` | `date` |
| `stock_id` | `stockId` |
| `open` | `open` |
| `max` | `high` |
| `min` | `low` |
| `close` | `close` |
| `spread` | `spread` |
| `Trading_Volume` | `volume` |
| `Trading_turnover` | `turnover` |

#### 2.2 `TaiwanStockInfo`

股票清單與基本資料（公司名稱、產業別）。

**Query：**
```
?dataset=TaiwanStockInfo&token=<jwt>
```

**Response：**
```json
{
  "msg": "success",
  "status": 200,
  "data": [
    {
      "industry_category": "電子工業",
      "stock_id": "2330",
      "stock_name": "台積電",
      "type": "twse",
      "date": "2020-06-03"
    }
  ]
}
```

**快取策略：** in-memory Map，TTL 24h。首次呼叫 `/api/tw-stock/klines` 時觸發載入；FinMind 失敗時保留 stale 快取。

### 錯誤處理

| 情況 | 處理 |
|---|---|
| HTTP 非 2xx | 回傳 `502 UPSTREAM_ERROR` |
| FinMind `status !== 200` | 回傳 `502 UPSTREAM_ERROR`，message 使用 FinMind 的 `msg` |
| fetch 例外（網路不通） | 回傳 `502 UPSTREAM_ERROR` |

### 免費方案限制

- 每小時請求次數有限（FinMind 官方未公開精確值）
- 不提供盤中即時資料（最快 T+1）
- 部分 dataset 需付費升級

**設計建議：** 對 FinMind 的請求應加入快取層（目前僅 `TaiwanStockInfo` 有 24h 快取，`TaiwanStockPrice` 每次都查）。Phase 3 可考慮把日 K 資料寫入 MongoDB。
