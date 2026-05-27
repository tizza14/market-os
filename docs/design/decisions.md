# 設計決策與已知偏差

記錄實作過程中與原始 spec 不一致的決定、踩雷紀錄、為什麼選 X 不選 Y。
**事後記錄即可，不需在改 code 的當下同步。** 但完成後 7 天內須補上。

每筆紀錄格式：

```
## N. 標題

**情境：** 遇到什麼問題或需求
**決策：** 選了什麼方案
**原因：** 為什麼這樣選
**影響：** 改了哪些檔案 / 對後續開發的限制
```

---

## 1. Binance trade stream 移除 b / a 欄位

**情境：** 原始 spec 將 `b`（buyer order ID）與 `a`（seller order ID）標為 required，端對端測試時收到 ZodError。

**決策：** 兩欄位改為 `.optional()`，`ExtendedTick` 介面用 conditional spread 避免 `exactOptionalPropertyTypes` 違規。

**原因：** Binance 隱私政策調整，公開 trade stream 不再回傳這兩個欄位。

**影響：**
- `apps/market-data-service/src/schemas/binanceTrade.ts`
- `apps/market-data-service/src/services/tickProcessor.ts`
- `packages/shared-types` `MarketTick` 已不含這兩欄
- MongoDB `market_ticks` doc 中此兩欄變為 optional

---

## 2. pnpm → npm workspaces

**情境：** 原 spec 使用 pnpm + `workspace:*` protocol，但開發環境無 pnpm，且使用者偏好 npm。

**決策：** 全面遷移到 npm workspaces，`workspace:*` 改為 `*`。

**原因：**
- 使用者明確要求用 npm
- npm 10+ workspaces 功能足夠
- 減少全域依賴

**影響：**
- root `package.json` 加入 `"workspaces": ["apps/*", "packages/*"]`
- 各 sub-package 的 `dependencies` 中 `workspace:*` → `*`
- 刪除 `pnpm-workspace.yaml`
- dev script 從 `tsx watch` 改為 `node --env-file=.env --import tsx/esm --watch`

---

## 3. packages 改為先 build 再 export

**情境：** 原 spec 讓 `packages/shared-types` 與 `packages/config` 直接 export `.ts` 原始檔（`"main": "./src/index.ts"`）。

**決策：** 改為加上 `tsconfig.json` + build script，`exports` 指向編譯後的 `dist/*.js`。

**原因：**
- Docker 生產環境 `node dist/main.js` 無法 require `.ts` 檔
- tsx watch 模式對 re-export `.ts` 有 ESM 解析問題（Node 22）

**影響：**
- `packages/config/package.json`、`packages/shared-types/package.json` 加入 build script
- 新增 `packages/*/tsconfig.json`
- Dockerfile 加入 `RUN npm run build -w packages/*`
- 修改 packages 後須手動 `npm run build -w packages/...` 才能讓其他 app 看到變更

---

## 4. Docker healthcheck 改用 node 而非 wget

**情境：** `node:20-alpine` 映像無 `wget` 與 `curl`，原 spec 範例的 healthcheck 失效。

**決策：** 改用 `node -e "require('http').get(url, r => process.exit(r.statusCode === 200 ? 0 : 1))"`

**原因：** 不想為了 healthcheck 安裝額外套件，node 本身就有 http。

**影響：** `docker-compose.yml` api-gateway healthcheck 區段。

---

## 5. Docker build context 用 root

**情境：** 原始 docker-compose 用 `build: ./apps/<service>`，但 Dockerfile 需要 `COPY packages/`，會超出 context 失敗。

**決策：** 改為 `build: { context: ., dockerfile: apps/<service>/Dockerfile }`。

**原因：** Monorepo 共用 packages 必須包含在 build context 內。

**影響：** `docker-compose.yml` 三個 service 的 build 設定、Dockerfile COPY 路徑全用相對 root。

---

## 6. MongoDB K 線 read-modify-write 取代 $inc

**情境：** 原 spec 提及用 `$inc` 累加 volume，但 Decimal128 對 `$inc` 有精度損失風險。

**決策：** K 線更新採 findOne → decimal.js 計算 → `$set` 寫回。`tradeCount` 是 integer 才用 `$inc`。

**原因：** Decimal 精度是 BTC 量化資料的硬性需求。

**影響：** `apps/market-data-service/src/repositories/klineRepository.ts`。

**已知風險：** 並發寫入下 read-modify-write 非原子操作。Phase 1 接受此風險（單一 service 寫入）。未來若需水平擴展，須改為 in-memory 聚合 + 定時 flush。

---

## 7. FinMind 公司資訊用 in-memory 24h 快取

**情境：** `/api/tw-stock/klines` 需要回傳公司名稱，但每次都查 FinMind 太浪費。

**決策：** api-gateway 啟動後第一次請求時，一次性拉 `TaiwanStockInfo`（全部上市/上櫃股票），存於 `Map<stockId, { name, industry }>`，TTL 24h。

**原因：**
- 公司名稱 / 產業別變動極少
- 不需引入 Redis cache 也能解決
- FinMind 失敗時保留 stale 快取，不影響服務

**影響：**
- `apps/api-gateway/src/handlers/twStock.ts`：cache 為 module-level 變數（單一 instance 內）
- 多 instance 部署時各自有快取，第一次請求會多打一次 FinMind（可接受）

---

## 8. 採用「Spec-Informed Development」而非純 SDD

**情境：** Phase 1 用瀑布式 SDD（一次寫完整 spec 再實作）。實作中發現多個 spec 沒預期的問題（見 1-7）。Phase 2 反而是先實作再補 spec。

**決策：** 文件拆成 `spec/`（契約，PR 同步）與 `design/`（設計筆記，事後 7 天內補）。

**原因：**
- 純 SDD 在單人探索性專案成本太高
- 契約變動必須同步（API、Schema、Type）
- 設計演進允許滯後記錄（pattern、ADR）
- 保留 SDD 的核心精神：跨服務契約有單一真相來源

**影響：**
- 刪除 `docs/market-os-spec.md`（內容拆到 spec/ 與 design/）
- 新增 `CONTRIBUTING.md` 說明工作流程
- 此檔案的存在即為新流程的一部分
