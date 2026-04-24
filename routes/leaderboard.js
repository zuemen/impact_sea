/**
 * 排行榜 API 路由
 * 支援城市排行榜、個人排行榜及個人排名查詢
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

function getUserId(req) {
  return req.user?.id ?? req.headers['x-user-id'] ?? null;
}

// 將 period 參數轉換為 SQL 篩選條件
function periodToFilter(period) {
  switch (period) {
    case 'week':
      return `period >= TO_CHAR(DATE_TRUNC('week', NOW()), 'YYYY-MM-DD')`;
    case 'month':
      return `period = TO_CHAR(NOW(), 'YYYY-MM')`;
    case 'all':
      return '1=1';
    default:
      return `period = TO_CHAR(NOW(), 'YYYY-MM')`;
  }
}

const VALID_TYPES = ['city', 'individual'];
const VALID_PERIODS = ['week', 'month', 'all'];

// ─────────────────────────────────────────────
// GET /api/leaderboard
// 查詢城市或個人排行榜
// 參數：type=city|individual, period=week|month|all, limit=1-100
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { type = 'city', period = 'month', limit = 20 } = req.query;

  if (!VALID_TYPES.includes(type)) {
    return res.status(400).json({
      error: `type 必須是以下之一: ${VALID_TYPES.join(', ')}`,
    });
  }
  if (!VALID_PERIODS.includes(period)) {
    return res.status(400).json({
      error: `period 必須是以下之一: ${VALID_PERIODS.join(', ')}`,
    });
  }

  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const periodFilter = periodToFilter(period);

  try {
    let query;
    let entries;

    if (type === 'city') {
      // 城市排行榜：以城市為單位匯總積分
      const result = await pool.query(
        `SELECT
           RANK() OVER (ORDER BY SUM(total_points) DESC) AS rank,
           entity_name AS city,
           SUM(total_points)::int          AS total_points,
           SUM(challenges_completed)::int  AS challenges_completed,
           SUM(actions_count)::int         AS actions_count
         FROM leaderboard
         WHERE leaderboard_type = 'individual'
           AND ${periodFilter}
           AND entity_id IN (
             SELECT id FROM users WHERE city IS NOT NULL
           )
         GROUP BY entity_name
         ORDER BY total_points DESC
         LIMIT $1`,
        [limitNum]
      );
      entries = result.rows.map((row) => ({
        rank: parseInt(row.rank, 10),
        city: row.city,
        total_points: row.total_points,
        challenges_completed: row.challenges_completed,
        actions_count: row.actions_count,
      }));
    } else {
      // 個人排行榜
      const result = await pool.query(
        `SELECT
           RANK() OVER (ORDER BY SUM(total_points) DESC) AS rank,
           entity_id AS user_id,
           entity_name AS user_name,
           SUM(total_points)::int         AS total_points,
           SUM(challenges_completed)::int AS challenges_completed
         FROM leaderboard
         WHERE leaderboard_type = 'individual'
           AND ${periodFilter}
         GROUP BY entity_id, entity_name
         ORDER BY total_points DESC
         LIMIT $1`,
        [limitNum]
      );
      entries = result.rows.map((row) => ({
        rank: parseInt(row.rank, 10),
        user_name: row.user_name,
        total_points: row.total_points,
        challenges_completed: row.challenges_completed,
      }));
    }

    return res.json({ type, period, entries });
  } catch (err) {
    console.error('GET /leaderboard 錯誤:', err);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

// ─────────────────────────────────────────────
// GET /api/leaderboard/personal
// 查詢當前登入使用者的個人排名及城市排名
// ─────────────────────────────────────────────
router.get('/personal', async (req, res) => {
  const userId = getUserId(req);
  if (!userId) {
    return res.status(401).json({ error: '請先登入' });
  }

  try {
    // 個人全球排名（本月）
    const personalResult = await pool.query(
      `SELECT
         ranked.rank,
         ranked.user_name,
         ranked.total_points,
         u.city
       FROM (
         SELECT
           entity_id AS user_id,
           entity_name AS user_name,
           SUM(total_points)::int AS total_points,
           RANK() OVER (ORDER BY SUM(total_points) DESC) AS rank
         FROM leaderboard
         WHERE leaderboard_type = 'individual'
           AND period = TO_CHAR(NOW(), 'YYYY-MM')
         GROUP BY entity_id, entity_name
       ) ranked
       JOIN users u ON u.id = ranked.user_id
       WHERE ranked.user_id = $1`,
      [userId]
    );

    if (personalResult.rows.length === 0) {
      return res.status(404).json({ error: '本月尚無排名記錄' });
    }

    const personal = personalResult.rows[0];

    // 城市內排名
    const cityRankResult = await pool.query(
      `SELECT city_ranked.rank AS city_rank
       FROM (
         SELECT
           u.city,
           l.entity_id,
           RANK() OVER (PARTITION BY u.city ORDER BY SUM(l.total_points) DESC) AS rank
         FROM leaderboard l
         JOIN users u ON u.id = l.entity_id
         WHERE l.leaderboard_type = 'individual'
           AND l.period = TO_CHAR(NOW(), 'YYYY-MM')
           AND u.city = $1
         GROUP BY u.city, l.entity_id
       ) city_ranked
       WHERE city_ranked.entity_id = $2`,
      [personal.city, userId]
    );

    return res.json({
      rank: parseInt(personal.rank, 10),
      user_name: personal.user_name,
      total_points: personal.total_points,
      city: personal.city,
      city_rank: cityRankResult.rows[0]?.city_rank
        ? parseInt(cityRankResult.rows[0].city_rank, 10)
        : null,
    });
  } catch (err) {
    console.error('GET /leaderboard/personal 錯誤:', err);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

module.exports = router;
