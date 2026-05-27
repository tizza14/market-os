# Contributing

Market OS 採 **Spec-Informed Development（規格輔助開發）**，介於純 SDD 與自由式開發之間。

---

## 核心原則

1. **跨服務契約必須有單一真相來源** — 改 API / Schema / Type → 同 PR 改文件
2. **設計筆記允許滯後** — 架構、Pattern、設計決策可以事後 7 天內補
3. **shared-types 與 config 套件本身就是可執行的 spec** — 型別、常數一律放在這裡，不允許 magic string

---

## 文件結構

```
docs/
├── README.md          ← 索引
├── spec/              ← 契約規格（PR 同步）
│   ├── api.md
│   ├── data.md
│   └── external.md
├── design/            ← 設計筆記（事後可補）
│   ├── architecture.md
│   └── decisions.md
└── progress.md        ← 開發進度

CONTRIBUTING.md        ← 本文件
```

---

## 開發流程

### 1. 新功能 / 修改

```
新功能想法
   ↓
是否動到契約？（API / Schema / Type / Env）
   ├── Yes → 先改 spec/ 對應檔案 → 實作 → 測試 → PR
   └── No  → 直接實作 → 測試 → PR（事後補 design/decisions.md 若有非顯而易見決策）
```

### 2. 何時要改哪個檔案

| 變動 | 必改檔案（PR 內） | 可後補 |
|---|---|---|
| 新增 / 修改 REST endpoint | `spec/api.md` | — |
| 改 WebSocket 訊息結構 | `spec/api.md` | — |
| 改 Redis channel 或 message | `spec/api.md` | — |
| 改 MongoDB schema | `spec/data.md` | — |
| 改 shared-types 介面 | `spec/data.md` | — |
| 新增 / 改環境變數 | `spec/data.md` | — |
| 外部 API 對接欄位變動 | `spec/external.md` | — |
| 新增 Architecture pattern | — | `design/architecture.md` |
| 設計決策 / 偏差紀錄 | — | `design/decisions.md` |
| 完成一個 wave / phase | `docs/progress.md` | — |

### 3. 寫 decisions.md 的判準

「未來的我看到 code 會問『為什麼這樣寫？』」的東西，記下來。包括但不限於：
- 與原 spec 不一致的決定
- 試過 A、放棄、改用 B 的過程
- 環境 / 工具的限制（例：alpine 沒有 wget）
- 取捨（accuracy vs performance、simplicity vs flexibility）

格式範本見 `docs/design/decisions.md` 開頭。

---

## Commit 規範

```
feat:     新功能
fix:      Bug 修復
refactor: 重構（不影響功能）
chore:    建置 / 工具 / 依賴
docs:     僅文件變更
test:     測試新增或修改
```

每個 commit 應該是「可獨立 review」的單位。**禁止** 一個 commit 同時改契約 + 改實作 + 改測試 + 改文件 — 拆 commit 或分 PR。

**契約 PR 規則：** 改 spec/ 的 PR 標題必須含 `spec:` 前綴標記（如 `feat(spec): 新增 /api/portfolio endpoint`）。Reviewer 看到此標記要特別檢查向下相容性。

---

## TypeScript 規範

`tsconfig.base.json` 已開啟：

```json
{
  "strict": true,
  "noImplicitAny": true,
  "noUncheckedIndexedAccess": true,
  "exactOptionalPropertyTypes": true
}
```

禁止：
- `any`（改用 `unknown` + 型別收斂）
- magic string（一律放 `packages/config`）
- 未明確標註的 `async` 函式 return type

---

## Zod Validation 規範

所有外部輸入必須通過 Zod schema 驗證：
- HTTP request query / body
- WebSocket 訊息
- Binance / FinMind payload
- 環境變數

Schema 集中放在 `apps/*/src/schemas/`。驗證失敗：
- 內部來源（env、Binance） → 記 error log 丟棄
- 外部來源（HTTP query） → 回 400 `VALIDATION_ERROR`

---

## 測試規範

- 工具：Vitest
- 檔案：`*.spec.ts`，與 source 同目錄
- 純函式（parser、aggregator、indicator）覆蓋率 > 80%
- API handler 用 Fastify `inject` + mock deps
- 改契約 → 對應測試必須一起改

跑測試：
```bash
npm test --workspaces        # 全部
npm test -w apps/<service>   # 單一服務
```

---

## PR Checklist

提 PR 前自我檢查：

- [ ] 改了契約？對應 `spec/*.md` 已更新
- [ ] 改了 shared types？`packages/shared-types` 已 build（`npm run build -w packages/shared-types`）
- [ ] 改了 config 常數？`packages/config` 已 build
- [ ] 測試全綠（`npm test --workspaces`）
- [ ] Typecheck 全綠（`npm run typecheck -w apps/*`）
- [ ] 動到 Docker 相關？已 `docker compose build` 驗證
- [ ] 有 non-obvious 決策？已記 `design/decisions.md`

---

## 不要做的事

- ❌ 不要為了「未來可能用到」加抽象層 / 介面
- ❌ 不要為「不會發生」的情境加錯誤處理
- ❌ 不要在 frontend 直接呼叫外部 API（一律走後端代理）
- ❌ 不要在跨服務傳輸用 `number`（價格 / 量一律 `string`）
- ❌ 不要在 commit 訊息寫「what」（diff 已經說了）— 寫「why」
- ❌ 不要刪 `docs/progress.md` 的歷史紀錄 — 只新增不刪除
