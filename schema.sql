-- Create users table for Sea Turtle Despises You (海龜鄙視你：厭世生態孿生養成計畫)
CREATE TABLE IF NOT EXISTS users (
  line_uid VARCHAR PRIMARY KEY,
  turtle_status INT NOT NULL DEFAULT 2, -- 2=健康, 1=生病混濁, 0=死亡
  continuous_inactive_days INT NOT NULL DEFAULT 0, -- 連續未打卡天數
  total_saved_grams INT NOT NULL DEFAULT 0, -- 累計減塑公克數
  last_scan_date TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP -- 上次打卡時間
);

-- 為了簡報 Demo 方便，以下為預先插入的測試用管理員帳號資料 (可選)
-- INSERT INTO users (line_uid, turtle_status, continuous_inactive_days, total_saved_grams, last_scan_date)
-- VALUES ('U735e28c5b4fd267ab0e92c9890d4f232', 2, 0, 50, NOW())
-- ON CONFLICT (line_uid) DO NOTHING;
