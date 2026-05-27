# Market OS 文件索引

文件分兩類：**契約（spec）** 必須與 code 同步、**設計（design）** 允許事後記錄。

| 類別 | 文件 | 範圍 |
|---|---|---|
| 契約 | [spec/api.md](spec/api.md) | REST endpoints、WebSocket 協定、Redis channels |
| 契約 | [spec/data.md](spec/data.md) | MongoDB schema、shared types、資料精度、環境變數 |
| 契約 | [spec/external.md](spec/external.md) | Binance trade stream、FinMind API |
| 設計 | [design/architecture.md](design/architecture.md) | 系統架構、服務邊界、NFR、Monorepo、實作 pattern |
| 設計 | [design/decisions.md](design/decisions.md) | 設計決策、已知偏差與解法 |
| 紀錄 | [progress.md](progress.md) | 開發進度、Phase 完成標記 |

工作流程見根目錄 [CONTRIBUTING.md](../CONTRIBUTING.md)。

---

## 何時改哪個文件

| 變動類型 | 必須更新 |
|---|---|
| 新增/修改 REST endpoint、WS 訊息、Redis channel | `spec/api.md` |
| 改 MongoDB schema、shared types、env 變數 | `spec/data.md` |
| 外部 API 對接欄位改變（如 Binance 移除欄位） | `spec/external.md` |
| 新增 ADR 級的設計決策、踩雷紀錄 | `design/decisions.md`（事後可補） |
| 架構圖、Pattern、NFR 更新 | `design/architecture.md`（事後可補） |
| Phase / Wave 完成、測試數變動 | `progress.md` |

**規則：** 改契約 = 同一 PR 內必須改文件；改設計 = 完成後 7 天內補上。
