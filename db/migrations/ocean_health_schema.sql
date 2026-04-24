-- ================================================================
-- Impact Sea 資料庫 Schema
-- 海洋生態監測 + 社區挑戰 + 排行榜
-- ================================================================

-- 確保使用 UTC 時區
SET timezone = 'UTC';

-- ── 擴展：使用 UUID（可選） ──────────────────────────────────────
-- CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ================================================================
-- 1. regions：地理區域
-- ================================================================
CREATE TABLE IF NOT EXISTS regions (
  id          SERIAL PRIMARY KEY,
  name        VARCHAR(100) NOT NULL,
  latitude    DECIMAL(9, 6) NOT NULL,
  longitude   DECIMAL(9, 6) NOT NULL,
  country     VARCHAR(100) NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 空間索引（若使用 PostGIS 可替換為 GIST）
CREATE INDEX IF NOT EXISTS idx_regions_country ON regions (country);
CREATE INDEX IF NOT EXISTS idx_regions_name    ON regions (name);

-- 預設測試資料
INSERT INTO regions (name, latitude, longitude, country) VALUES
  ('墾丁南灣',   21.9402, 120.7891, '台灣'),
  ('綠島',       22.6602, 121.4902, '台灣'),
  ('澎湖七美',   23.2127, 119.4381, '台灣'),
  ('小琉球',     22.3403, 120.3784, '台灣'),
  ('蘭嶼',       22.0427, 121.5498, '台灣')
ON CONFLICT DO NOTHING;

-- ================================================================
-- 2. ocean_health_metrics：海洋健康指標記錄
-- ================================================================
CREATE TABLE IF NOT EXISTS ocean_health_metrics (
  id                     SERIAL PRIMARY KEY,
  region_id              INT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,

  -- 物理指標
  temperature            DECIMAL(5, 2),   -- 攝氏度
  ph_value               DECIMAL(4, 2),   -- 0–14
  salinity               DECIMAL(6, 2),   -- PSU（實用鹽度單位）
  turbidity              DECIMAL(8, 3),   -- NTU（濁度）

  -- 生態評分（0–100）
  species_diversity_score INT CHECK (species_diversity_score BETWEEN 0 AND 100),
  coral_health_score      INT CHECK (coral_health_score      BETWEEN 0 AND 100),

  -- 污染風險
  pollution_risk_level   VARCHAR(10) CHECK (pollution_risk_level IN ('low','medium','high','critical')),

  -- 額外欄位
  notes                  TEXT,
  photos                 JSONB DEFAULT '[]'::jsonb,  -- 照片 URL 陣列
  data_source            VARCHAR(50) NOT NULL DEFAULT 'manual',  -- manual / community_report / api
  measured_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_metrics_region_id   ON ocean_health_metrics (region_id);
CREATE INDEX IF NOT EXISTS idx_metrics_measured_at ON ocean_health_metrics (measured_at DESC);
-- 複合索引：快速取某地區最新記錄
CREATE INDEX IF NOT EXISTS idx_metrics_region_time ON ocean_health_metrics (region_id, measured_at DESC);

-- 自動更新 updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_metrics_updated_at ON ocean_health_metrics;
CREATE TRIGGER trg_metrics_updated_at
  BEFORE UPDATE ON ocean_health_metrics
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ================================================================
-- 3. alerts：海洋警告
-- ================================================================
CREATE TABLE IF NOT EXISTS alerts (
  id          SERIAL PRIMARY KEY,
  metric_id   INT REFERENCES ocean_health_metrics(id) ON DELETE SET NULL,
  region_id   INT NOT NULL REFERENCES regions(id) ON DELETE CASCADE,
  alert_type  VARCHAR(50) NOT NULL,  -- temperature / pollution / ph / turbidity
  severity    VARCHAR(10) NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  message     TEXT NOT NULL,
  is_resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_alerts_region_id   ON alerts (region_id);
CREATE INDEX IF NOT EXISTS idx_alerts_is_resolved ON alerts (is_resolved) WHERE NOT is_resolved;
CREATE INDEX IF NOT EXISTS idx_alerts_severity    ON alerts (severity);

-- ================================================================
-- 4. users：使用者（最簡版，可整合既有認證系統）
-- ================================================================
CREATE TABLE IF NOT EXISTS users (
  id           SERIAL PRIMARY KEY,
  display_name VARCHAR(100) NOT NULL,
  email        VARCHAR(255) UNIQUE,
  city         VARCHAR(100),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ================================================================
-- 5. challenges：社區挑戰
-- ================================================================
CREATE TABLE IF NOT EXISTS challenges (
  id             SERIAL PRIMARY KEY,
  title          VARCHAR(200) NOT NULL,
  description    TEXT,
  challenge_type VARCHAR(50) NOT NULL,   -- cleanup / photo / education / reduction
  target_count   INT NOT NULL DEFAULT 100,
  current_count  INT NOT NULL DEFAULT 0 CHECK (current_count >= 0),
  unit           VARCHAR(30) NOT NULL DEFAULT '次',
  start_date     DATE NOT NULL,
  end_date       DATE NOT NULL,
  region_id      INT REFERENCES regions(id) ON DELETE SET NULL,
  reward_points  INT NOT NULL DEFAULT 10,
  status         VARCHAR(20) NOT NULL DEFAULT 'upcoming'
                   CHECK (status IN ('upcoming','active','completed','cancelled')),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by     INT REFERENCES users(id) ON DELETE SET NULL,

  CONSTRAINT chk_dates CHECK (end_date >= start_date),
  CONSTRAINT chk_target CHECK (target_count > 0)
);

CREATE INDEX IF NOT EXISTS idx_challenges_status    ON challenges (status);
CREATE INDEX IF NOT EXISTS idx_challenges_region_id ON challenges (region_id);
CREATE INDEX IF NOT EXISTS idx_challenges_end_date  ON challenges (end_date);

-- 自動依日期更新挑戰狀態（可由排程任務呼叫）
CREATE OR REPLACE FUNCTION sync_challenge_status()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE challenges
  SET status = 'active'
  WHERE status = 'upcoming' AND start_date <= CURRENT_DATE AND end_date >= CURRENT_DATE;

  UPDATE challenges
  SET status = 'completed'
  WHERE status = 'active' AND end_date < CURRENT_DATE;
END;
$$;

-- ================================================================
-- 6. challenge_participants：挑戰參與記錄
-- ================================================================
CREATE TABLE IF NOT EXISTS challenge_participants (
  id                 SERIAL PRIMARY KEY,
  challenge_id       INT NOT NULL REFERENCES challenges(id) ON DELETE CASCADE,
  user_id            INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  contribution_count INT NOT NULL DEFAULT 0 CHECK (contribution_count >= 0),
  joined_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ,

  UNIQUE (challenge_id, user_id)  -- 防止重複加入
);

CREATE INDEX IF NOT EXISTS idx_participants_challenge ON challenge_participants (challenge_id);
CREATE INDEX IF NOT EXISTS idx_participants_user      ON challenge_participants (user_id);

-- ================================================================
-- 7. leaderboard：排行榜快取表
-- ================================================================
CREATE TABLE IF NOT EXISTS leaderboard (
  id                    SERIAL PRIMARY KEY,
  leaderboard_type      VARCHAR(20) NOT NULL CHECK (leaderboard_type IN ('individual','city')),
  period                VARCHAR(10) NOT NULL,  -- 格式：YYYY-MM 或 YYYY-WW
  rank                  INT NOT NULL DEFAULT 0,
  entity_id             INT NOT NULL,          -- user_id 或 city_id
  entity_name           VARCHAR(200) NOT NULL,
  total_points          INT NOT NULL DEFAULT 0 CHECK (total_points >= 0),
  challenges_completed  INT NOT NULL DEFAULT 0,
  actions_count         INT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (leaderboard_type, period, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_leaderboard_type_period ON leaderboard (leaderboard_type, period);
CREATE INDEX IF NOT EXISTS idx_leaderboard_points      ON leaderboard (total_points DESC);

-- ================================================================
-- 完成提示
-- ================================================================
DO $$
BEGIN
  RAISE NOTICE 'Impact Sea schema 初始化完成！';
  RAISE NOTICE '已建立資料表：regions, ocean_health_metrics, alerts, users, challenges, challenge_participants, leaderboard';
END;
$$;
