/**
 * 社區挑戰 API 路由
 * 提供挑戰列表、詳情、加入及貢獻提交功能
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// 從 JWT 或 session 取得當前使用者 ID（示意實作）
function getUserId(req) {
  return req.user?.id ?? req.headers['x-user-id'] ?? null;
}

// ─────────────────────────────────────────────
// GET /api/challenges
// 查詢挑戰列表，支援 status / region_id 篩選
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  const { status, region_id } = req.query;
  const userId = getUserId(req);

  const VALID_STATUSES = ['active', 'upcoming', 'completed', 'all'];
  if (status && !VALID_STATUSES.includes(status)) {
    return res.status(400).json({
      error: `status 必須是以下之一: ${VALID_STATUSES.join(', ')}`,
    });
  }

  const conditions = [];
  const params = [];

  if (status && status !== 'all') {
    params.push(status);
    conditions.push(`c.status = $${params.length}`);
  }

  if (region_id) {
    const rid = parseInt(region_id, 10);
    if (!Number.isInteger(rid) || rid <= 0) {
      return res.status(400).json({ error: '無效的 region_id' });
    }
    params.push(rid);
    conditions.push(`c.region_id = $${params.length}`);
  }

  const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    // 若有登入使用者，一併查詢是否已加入
    const joinedSubquery = userId
      ? `(SELECT 1 FROM challenge_participants cp
         WHERE cp.challenge_id = c.id AND cp.user_id = $${params.length + 1}) AS has_user_joined`
      : 'false AS has_user_joined';

    const queryParams = userId ? [...params, userId] : params;

    const result = await pool.query(
      `SELECT
         c.id, c.title, c.challenge_type AS type,
         c.target_count, c.current_count, c.unit,
         ROUND(c.current_count::numeric / NULLIF(c.target_count, 0) * 100, 1)
           AS progress_percentage,
         c.start_date, c.end_date, c.reward_points, c.status,
         r.name AS region_name,
         (SELECT COUNT(*) FROM challenge_participants cp WHERE cp.challenge_id = c.id)
           AS participant_count,
         ${joinedSubquery}
       FROM challenges c
       LEFT JOIN regions r ON r.id = c.region_id
       ${whereClause}
       ORDER BY c.end_date ASC`,
      queryParams
    );

    return res.json({
      total: result.rows.length,
      challenges: result.rows.map((row) => ({
        ...row,
        has_user_joined: Boolean(row.has_user_joined),
        progress_percentage: parseFloat(row.progress_percentage ?? 0),
      })),
    });
  } catch (err) {
    console.error('GET /challenges 錯誤:', err);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

// ─────────────────────────────────────────────
// GET /api/challenges/:challenge_id
// 查詢單一挑戰詳情，含最近活動記錄
// ─────────────────────────────────────────────
router.get('/:challenge_id', async (req, res) => {
  const challengeId = parseInt(req.params.challenge_id, 10);
  if (!Number.isInteger(challengeId) || challengeId <= 0) {
    return res.status(400).json({ error: '無效的 challenge_id' });
  }

  try {
    const challengeResult = await pool.query(
      `SELECT
         c.*,
         r.name AS region_name,
         (SELECT COUNT(*) FROM challenge_participants cp WHERE cp.challenge_id = c.id)
           AS participant_count
       FROM challenges c
       LEFT JOIN regions r ON r.id = c.region_id
       WHERE c.id = $1`,
      [challengeId]
    );

    if (challengeResult.rows.length === 0) {
      return res.status(404).json({ error: '找不到此挑戰' });
    }

    const challenge = challengeResult.rows[0];

    // 最近 10 筆貢獻活動（隱匿完整姓名）
    const activitiesResult = await pool.query(
      `SELECT
         cp.user_id,
         SUBSTRING(u.display_name, 1, 1) || '***' AS masked_name,
         cp.contribution_count, cp.joined_at
       FROM challenge_participants cp
       LEFT JOIN users u ON u.id = cp.user_id
       WHERE cp.challenge_id = $1
       ORDER BY cp.joined_at DESC
       LIMIT 10`,
      [challengeId]
    );

    return res.json({
      ...challenge,
      participants: parseInt(challenge.participant_count, 10),
      recent_activities: activitiesResult.rows,
    });
  } catch (err) {
    console.error('GET /challenges/:id 錯誤:', err);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

// ─────────────────────────────────────────────
// POST /api/challenges/:challenge_id/join
// 加入挑戰（同一使用者不可重複加入）
// ─────────────────────────────────────────────
router.post('/:challenge_id/join', async (req, res) => {
  const challengeId = parseInt(req.params.challenge_id, 10);
  const userId = getUserId(req);

  if (!Number.isInteger(challengeId) || challengeId <= 0) {
    return res.status(400).json({ error: '無效的 challenge_id' });
  }
  if (!userId) {
    return res.status(401).json({ error: '請先登入' });
  }

  try {
    // 確認挑戰存在且狀態為 active
    const challengeCheck = await pool.query(
      'SELECT id, status FROM challenges WHERE id = $1',
      [challengeId]
    );
    if (challengeCheck.rows.length === 0) {
      return res.status(404).json({ error: '找不到此挑戰' });
    }
    if (challengeCheck.rows[0].status !== 'active') {
      return res.status(400).json({ error: '此挑戰目前不開放加入' });
    }

    // ON CONFLICT DO NOTHING 防止重複加入
    const result = await pool.query(
      `INSERT INTO challenge_participants (challenge_id, user_id, contribution_count, joined_at)
       VALUES ($1, $2, 0, NOW())
       ON CONFLICT (challenge_id, user_id) DO NOTHING
       RETURNING id, challenge_id, user_id, joined_at`,
      [challengeId, userId]
    );

    if (result.rows.length === 0) {
      return res.status(409).json({ error: '您已加入此挑戰' });
    }

    return res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('POST /challenges/:id/join 錯誤:', err);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

// ─────────────────────────────────────────────
// POST /api/challenges/:challenge_id/submit
// 提交挑戰貢獻（照片、描述），計算積分並回傳排名
// ─────────────────────────────────────────────
router.post('/:challenge_id/submit', async (req, res) => {
  const challengeId = parseInt(req.params.challenge_id, 10);
  const userId = getUserId(req);
  const { contribution_type, photos, description } = req.body;

  if (!Number.isInteger(challengeId) || challengeId <= 0) {
    return res.status(400).json({ error: '無效的 challenge_id' });
  }
  if (!userId) {
    return res.status(401).json({ error: '請先登入' });
  }
  if (!contribution_type || typeof contribution_type !== 'string') {
    return res.status(400).json({ error: '缺少 contribution_type' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 確認使用者已加入此挑戰
    const participant = await client.query(
      `SELECT id, contribution_count
       FROM challenge_participants
       WHERE challenge_id = $1 AND user_id = $2
       FOR UPDATE`,
      [challengeId, userId]
    );

    if (participant.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: '請先加入此挑戰才能提交' });
    }

    const currentCount = participant.rows[0].contribution_count;
    const newCount = currentCount + 1;

    // 更新個人貢獻次數
    await client.query(
      `UPDATE challenge_participants
       SET contribution_count = $1, completed_at = CASE WHEN $1 >= (
         SELECT target_count FROM challenges WHERE id = $2
       ) THEN NOW() ELSE completed_at END
       WHERE challenge_id = $2 AND user_id = $3`,
      [newCount, challengeId, userId]
    );

    // 更新挑戰整體計數
    const challengeResult = await client.query(
      `UPDATE challenges
       SET current_count = current_count + 1
       WHERE id = $1
       RETURNING reward_points, current_count, target_count, status`,
      [challengeId]
    );

    const challenge = challengeResult.rows[0];
    const pointsEarned = challenge.reward_points ?? 10;

    // 更新排行榜（UPSERT）
    await client.query(
      `INSERT INTO leaderboard
         (leaderboard_type, period, entity_id, entity_name, total_points,
          challenges_completed, actions_count, rank, created_at)
       VALUES ('individual', TO_CHAR(NOW(), 'YYYY-MM'),
               $1, (SELECT display_name FROM users WHERE id = $1),
               $2, 0, 1, 0, NOW())
       ON CONFLICT (leaderboard_type, period, entity_id)
       DO UPDATE SET
         total_points   = leaderboard.total_points + $2,
         actions_count  = leaderboard.actions_count + 1`,
      [userId, pointsEarned]
    );

    // 取得目前個人排名
    const rankResult = await client.query(
      `SELECT rank
       FROM (
         SELECT entity_id,
                RANK() OVER (ORDER BY total_points DESC) AS rank
         FROM leaderboard
         WHERE leaderboard_type = 'individual'
           AND period = TO_CHAR(NOW(), 'YYYY-MM')
       ) ranked
       WHERE entity_id = $1`,
      [userId]
    );

    await client.query('COMMIT');

    return res.json({
      points_earned: pointsEarned,
      contribution_count: newCount,
      rank: rankResult.rows[0]?.rank ?? null,
      challenge_progress: {
        current_count: challenge.current_count,
        target_count: challenge.target_count,
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('POST /challenges/:id/submit 錯誤:', err);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  } finally {
    client.release();
  }
});

module.exports = router;
