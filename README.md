# impact_sea

《這片海，離我多遠？》2026 版本的可執行 MVP。  
本版從單檔 demo 升級為 `Node.js` 前後端分離，對齊提案重點：

- 城市到海洋路徑可視化
- 每日減廢行動集章與連續守護
- 海岸照片獎勵（公民投稿機制）
- 友善店家導流（區域與條件篩選）
- 月度影響力 KPI 看板

## 啟動方式

```bash
npm start
```

啟動後開啟 `http://localhost:8080`

## 專案結構

- `server.js`: Node.js API 與靜態頁面服務
- `public/`: 前端頁面 (`index.html`, `app.js`, `styles.css`)
- `data/`: 海域、店家、照片、行動與投稿資料
- `FEATURE_RECOMMENDATIONS.md`: 功能增強建議

## API 摘要

- `GET /api/coasts` 海域資料
- `GET /api/shops` 店家資料（支援篩選）
- `GET /api/photos/random` 隨機照片獎勵
- `POST /api/actions` 送出一次守護行動
- `POST /api/submissions` 送出照片投稿（待審）
- `GET /api/metrics` 月度影響力指標

## 預算與落地建議

可配合你既有提案，在 NT$10,000 內完成第一波試點：

1. 提示牌與店家立牌先上線，讓「城市到海」先被看見。
2. 先用本版 JSON 後端運作，穩定後再接 Google Sheets / Firebase。
3. 每月固定產出 KPI 圖卡，作為社群擴散與政府/校園簡報素材。
