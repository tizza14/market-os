# Market OS — 開發進度記錄

**最後更新：** 2026-05-27  
**當前狀態：** Wave 2 進行中（未完成）

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

### B. apps/api-gateway — 檔案已寫入，**尚未驗收** ⚠️

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
│   └── apiHandlers.spec.ts      ✅ 10 tests（含 Fastify inject）
└── main.ts                      ✅ 完整啟動邏輯、graceful shutdown
```

**⚠️ 尚未執行驗收（因 permissions 設定中斷）：**
- [ ] `pnpm --filter api-gateway typecheck`
- [ ] `pnpm --filter api-gateway test`
- [ ] 端到端手動驗證（需 MongoDB + Redis）

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

### 2. KlineAggregator 初始 volume 精度（Wave 2 發現）

**問題：** `createKline()` 初始 volume 直接用 `tick.quantity`，未 normalize 到 8 位小數。

**錯誤：** test 期望 `"0.50000000"` 但收到 `"0.5"`

**解法：** 改為 `new Decimal(tick.quantity).toFixed(8)`

---

## 下一步：Wave 2 完成剩餘步驟

### 立即要做（繼續目前 wave）

```bash
# Step 1: typecheck
pnpm --filter api-gateway typecheck

# Step 2: unit tests
pnpm --filter api-gateway test

# Step 3: 手動端到端驗證（需先啟動 mongo + redis）
docker run -d -p 27017:27017 --name mongo mongo:7
docker run -d -p 6379:6379 --name redis redis:7-alpine

# 啟動服務
pnpm --filter market-data-service dev
pnpm --filter api-gateway dev

# 驗收指令
curl http://localhost:3000/api/health
curl http://localhost:3000/api/market/latest
curl http://localhost:3000/api/market/klines?limit=10
# 以及 wscat -c ws://localhost:3000/ws/market
```

### Wave 2 驗收 checklist（docs/market-os-agent-waves.md 第 Step 2 節）

- [ ] `pnpm --filter api-gateway typecheck` 全綠
- [ ] `pnpm --filter api-gateway test` 全綠（10 tests）
- [ ] Binance WS 連線 log 出現
- [ ] MongoDB `market_ticks` 持續累加，無重複 tradeId
- [ ] MongoDB `klines` 每分鐘一根
- [ ] Redis subscriber 收到訊息
- [ ] 三個 REST endpoint 回應符合 schema
- [ ] WebSocket 持續推送
- [ ] Kill 後重啟，K 線從 MongoDB 恢復

### Wave 2 完成後

接著執行 Wave 3（frontend + Docker）。  
完整指令見 `docs/market-os-agent-waves.md`。

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
