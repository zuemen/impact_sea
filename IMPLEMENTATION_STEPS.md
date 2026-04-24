# Impact Sea 新模塊實作指南

## 一、資料庫初始化

### 1. 安裝 PostgreSQL（本地開發）

```bash
# macOS
brew install postgresql@15 && brew services start postgresql@15

# Ubuntu/Debian
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

### 2. 建立資料庫與使用者

```bash
psql -U postgres
```

```sql
CREATE DATABASE impact_sea;
CREATE USER impact_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE impact_sea TO impact_user;
\q
```

### 3. 執行 Schema 遷移

```bash
psql -U impact_user -d impact_sea -f db/migrations/ocean_health_schema.sql
```

成功後應看到：
```
NOTICE:  Impact Sea schema 初始化完成！
NOTICE:  已建立資料表：regions, ocean_health_metrics, alerts, users, challenges, challenge_participants, leaderboard
```

---

## 二、安裝 npm 套件

```bash
# 後端相依
npm install express pg dotenv cors

# 前端相依（若使用 React + Recharts）
npm install react react-dom recharts

# 開發工具
npm install --save-dev nodemon
```

### 更新 package.json scripts

```json
{
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  }
}
```

---

## 三、環境變數設定

建立 `.env` 檔案（**勿提交到 Git**）：

```env
DATABASE_URL=postgresql://impact_user:your_password@localhost:5432/impact_sea
NODE_ENV=development
PORT=3000
```

---

## 四、整合到 server.js

在現有 `server.js` 中加入以下代碼（建議在 Vercel 部署版本上分支開發）：

```javascript
// 在文件頂部加入
require('dotenv').config();
const express = require('express');
const app = express();

// 中間件
app.use(express.json());
app.use(require('cors')());

// 掛載新路由
const oceanHealthRouter = require('./routes/ocean-health');
const challengesRouter  = require('./routes/challenges');
const leaderboardRouter = require('./routes/leaderboard');

app.use('/api/ocean-health', oceanHealthRouter);
app.use('/api/challenges',   challengesRouter);
app.use('/api/leaderboard',  leaderboardRouter);

// 保留原有靜態文件服務
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
```

> **注意**：現有 server.js 使用原生 `http` 模組，建議新建 `server-v2.js` 用 Express 啟動，
> 或逐步將原有路由遷移過去，避免破壞現有功能。

---

## 五、React 前端整合

### 安裝前端建構工具（Vite 範例）

```bash
npm create vite@latest frontend -- --template react
cd frontend && npm install recharts
```

### 在 App.jsx 中引入組件

```jsx
import OceanHealthDashboard from '../components/OceanHealth/OceanHealthDashboard';
import ChallengesList       from '../components/Challenges/ChallengesList';
import LeaderboardView      from '../components/Leaderboard/LeaderboardView';

function App() {
  return (
    <div>
      <OceanHealthDashboard regionId={1} />
      <ChallengesList regionId={1} />
      <LeaderboardView />
    </div>
  );
}
```

### Vite 開發代理設定（vite.config.js）

```javascript
export default {
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
};
```

---

## 六、測試 API（curl 命令）

### 海洋健康指標

```bash
# 查詢地區 1 的最新指標
curl http://localhost:3000/api/ocean-health/1

# 查詢警告（高嚴重度）
curl "http://localhost:3000/api/ocean-health/alerts?severity=high"

# 多地區水溫對比
curl "http://localhost:3000/api/ocean-health/compare?regions=1,2,3&metric=temperature"

# 提交海洋健康報告
curl -X POST http://localhost:3000/api/ocean-health/reports \
  -H "Content-Type: application/json" \
  -d '{
    "region_id": 1,
    "metrics": {
      "temperature": 27.5,
      "ph_value": 8.1,
      "salinity": 34.2,
      "turbidity": 2.3,
      "species_diversity_score": 75,
      "coral_health_score": 68,
      "pollution_risk_level": "low"
    },
    "notes": "今日天氣晴朗，能見度佳",
    "photos": ["https://example.com/photo1.jpg"]
  }'
```

### 社區挑戰

```bash
# 查詢進行中的挑戰
curl "http://localhost:3000/api/challenges?status=active"

# 查詢單一挑戰詳情
curl http://localhost:3000/api/challenges/1

# 加入挑戰（需帶使用者標頭）
curl -X POST http://localhost:3000/api/challenges/1/join \
  -H "x-user-id: 42"

# 提交挑戰貢獻
curl -X POST http://localhost:3000/api/challenges/1/submit \
  -H "Content-Type: application/json" \
  -H "x-user-id: 42" \
  -d '{
    "contribution_type": "beach_cleanup",
    "description": "清理了 5kg 垃圾",
    "photos": []
  }'
```

### 排行榜

```bash
# 城市排行榜（本月前 20）
curl "http://localhost:3000/api/leaderboard?type=city&period=month&limit=20"

# 個人排行榜（本週）
curl "http://localhost:3000/api/leaderboard?type=individual&period=week"

# 個人排名（需登入）
curl http://localhost:3000/api/leaderboard/personal \
  -H "x-user-id: 42"
```

---

## 七、故障排除

### 資料庫連線失敗

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**解決**：確認 PostgreSQL 服務正在運行
```bash
# macOS
brew services list | grep postgresql

# Linux
sudo systemctl status postgresql
```

### 缺少資料表

```
relation "ocean_health_metrics" does not exist
```

**解決**：重新執行 schema 遷移
```bash
psql -U impact_user -d impact_sea -f db/migrations/ocean_health_schema.sql
```

### CORS 錯誤（前端呼叫 API）

確認 server.js 已加入 CORS 中間件，或在 Vite 設定代理（見第五節）。

### `pg` 模組找不到

```bash
npm install pg
```

### Vercel 部署注意事項

- Vercel Serverless 不支援長連線 PostgreSQL，需使用 `pg` 的連線池或改用 [Neon](https://neon.tech)（支援 serverless）
- 在 Vercel 控制台加入環境變數 `DATABASE_URL`
- 現有 `vercel.json` 可能需要調整，加入 API 路由規則：

```json
{
  "routes": [
    { "src": "/api/(.*)", "dest": "/server.js" },
    { "src": "/(.*)",     "dest": "/public/$1"  }
  ]
}
```

---

## 八、新增測試資料

```sql
-- 插入測試使用者
INSERT INTO users (display_name, email, city) VALUES
  ('海洋守護者', 'user1@example.com', '台北'),
  ('珊瑚小衛兵', 'user2@example.com', '高雄'),
  ('藍色行動家', 'user3@example.com', '台南');

-- 插入測試挑戰
INSERT INTO challenges (title, challenge_type, target_count, unit, start_date, end_date, region_id, reward_points, status)
VALUES
  ('墾丁淨灘大作戰', 'cleanup', 500, '公斤', CURRENT_DATE, CURRENT_DATE + 30, 1, 50, 'active'),
  ('海洋生態記錄挑戰', 'photo', 200, '張照片', CURRENT_DATE, CURRENT_DATE + 60, 2, 30, 'active'),
  ('減塑生活 30 天', 'reduction', 1000, '次行動', CURRENT_DATE, CURRENT_DATE + 30, NULL, 20, 'active');

-- 插入測試海洋指標
INSERT INTO ocean_health_metrics
  (region_id, temperature, ph_value, salinity, turbidity,
   species_diversity_score, coral_health_score, pollution_risk_level, data_source)
VALUES
  (1, 27.3, 8.12, 34.1, 1.8, 82, 71, 'low',    'api'),
  (2, 26.8, 8.08, 33.9, 2.1, 91, 85, 'low',    'api'),
  (3, 28.1, 7.95, 34.5, 4.7, 65, 52, 'medium', 'api');
```
