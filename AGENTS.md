# Agent Briefing — Market OS

給 AI agent 的 30 秒簡報。完整規範見 [CONTRIBUTING.md](CONTRIBUTING.md) 與 [docs/README.md](docs/README.md)。

---

## 專案速覽

- **What**：即時市場資料研究平台（BTC 即時 K 線 + 台股日 K 查詢）
- **Stack**：Node.js 20 + TypeScript strict + Vue 3 + Fastify + MongoDB 7 + Redis 7
- **架構**：npm workspaces monorepo，3 個 apps + 2 個 packages
- **服務邊界**：見 [docs/design/architecture.md](docs/design/architecture.md)

---

## 絕對不要做（Hard rules）

| 規則 | 為什麼 |
|---|---|
| ❌ 不要用 `any` | 改 `unknown` + 型別收斂，`strict` mode 開著 |
| ❌ 不要寫 magic string | 跨服務常數一律放 `packages/config` |
| ❌ 不要在跨服務傳輸用 `number` 表達 BTC 價格/量 | 浮點精度損失，一律 `string`（FinMind 台股例外，原生 number） |
| ❌ 不要用 `parseFloat` 算 BTC 價格 | 用 `decimal.js`（已是相依套件） |
| ❌ 不要在 frontend 直接呼叫外部 API | 一律後端代理，Token 不暴露 browser |
| ❌ 不要用 `$inc` 累加 Decimal128 欄位 | 精度損失，採 read-modify-write |
| ❌ 不要用 pnpm | 專案已遷移到 npm workspaces，`workspace:*` 用 `*` |
| ❌ 不要直接 export `.ts`（packages） | packages 需 build 後再讓 apps 引用 |
| ❌ 不要在 commit 訊息寫 what | 寫 why（diff 已說了 what） |

---

## 常用指令

```bash
# 安裝
npm install

# 測試（全部 / 單一）
npm test --workspaces
npm test -w apps/market-data-service

# Typecheck
npm run typecheck -w apps/api-gateway

# 改動 packages 後必須 build，apps 才會看到變化
npm run build -w packages/shared-types
npm run build -w packages/config

# Docker（全部 / 重建單一服務）
docker compose up -d
docker compose build api-gateway && docker compose up -d api-gateway
```

---

## 關鍵檔案位置

| 想做什麼 | 看哪裡 |
|---|---|
| 改/加共用型別 | `packages/shared-types/src/index.ts` |
| 改/加共用常數 | `packages/config/src/index.ts` |
| 加 REST endpoint | `apps/api-gateway/src/handlers/`，registerXxxRoutes 於 `app.ts` |
| 改 K 線聚合邏輯 | `apps/market-data-service/src/services/klineAggregator.ts` |
| 改 Binance 解析 | `apps/market-data-service/src/schemas/binanceTrade.ts` |
| 改前端 store | `apps/frontend/src/stores/{market,twStock}.ts` |
| 加新頁面 | 元件 → `views/`，路由 → `apps/frontend/src/main.ts`，導覽 → `App.vue` |

---

## 變更時必須一起改的東西

| 改了什麼 | 同 PR 必改 |
|---|---|
| REST endpoint / WS 訊息 / Redis channel | `docs/spec/api.md` |
| MongoDB schema / shared types / env 變數 | `docs/spec/data.md` |
| 外部 API 對接欄位 | `docs/spec/external.md` |
| 完成 Phase / Wave / 重要里程碑 | `docs/progress.md` |

設計決策 / 踩雷紀錄 → `docs/design/decisions.md`（事後 7 天內補即可）

---

## 已知陷阱（從踩過的雷學到的）

| 陷阱 | 解法 |
|---|---|
| Binance trade stream 沒有 `b` / `a` 欄位 | Schema 標 optional；用 conditional spread 處理 |
| `exactOptionalPropertyTypes` 開著 | optional 欄位用 `...(x !== undefined ? { x } : {})` |
| 改 `packages/*` 後 app 看不到變更 | 必須 `npm run build -w packages/<name>` |
| `node:alpine` 沒有 `wget` / `curl` | healthcheck 用 `node -e "require('http').get(...)"` |
| Docker monorepo build | `build: { context: ., dockerfile: apps/<x>/Dockerfile }`，不是 `build: ./apps/<x>` |
| Decimal128 `$inc` 精度損失 | 改 read-modify-write，用 decimal.js 算完再 `$set` |
| FinMind 公司資訊 | 啟動後 in-memory 快取 24h，不每次都打 FinMind |

完整紀錄見 [docs/design/decisions.md](docs/design/decisions.md)

---

## 完成工作前的自我檢查（PR Checklist）

```
[ ] 改了契約？對應 docs/spec/*.md 已更新
[ ] 改了 packages/*？已 npm run build -w packages/<name>
[ ] npm test --workspaces 全綠
[ ] npm run typecheck -w apps/* 全綠
[ ] 動到 Docker 相關？已 docker compose build 驗證
[ ] 有 non-obvious 決策？已記 docs/design/decisions.md
[ ] commit 訊息寫 why（不是 what）
```

---

## 風格與互動

- 簡潔回應，不要過度解釋
- 引用程式碼用 `file_path:line_number` 格式方便跳轉
- 改 code 前先確認測試會跑、改完後跑測試驗證
- 不確定的決策先問人，不要自作主張
- 不要為了「未來可能用到」加抽象層或介面
- 不要為「不會發生」的情境加錯誤處理

---

## 想看更多

| 文件 | 用途 |
|---|---|
| [CONTRIBUTING.md](CONTRIBUTING.md) | 完整工作流程、commit / TS / Zod / 測試規範 |
| [docs/README.md](docs/README.md) | 文件索引、「何時改哪個檔案」對照表 |
| [docs/spec/](docs/spec/) | API / 資料 / 外部 API 契約 |
| [docs/design/](docs/design/) | 系統架構、設計決策、實作 pattern |
| [docs/progress.md](docs/progress.md) | 各 Phase 進度與測試總覽 |
