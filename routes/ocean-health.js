/**
 * 海洋健康狀態 API 路由
 * 提供海洋指標查詢、警告系統、多地區對比及報告提交功能
 */

const express = require('express');
const router = express.Router();
const { Pool } = require('pg');

// 建立 PostgreSQL 連接池
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// ─────────────────────────────────────────────
// 工具函數
// ─────────────────────────────────────────────

/** 驗證 region_id 是否為合法正整數 */
function validateRegionId(id) {
  const n = parseInt(id, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** 嚴重程度白名單 */
const VALID_SEVERITIES = ['low', 'medium', 'high', 'critical'];

/** 污染風險等級對應顏色（給前端用） */
const RISK_COLORS = {
  low: '#22c55e',
  medium: '#f59e0b',
  high: '#ef4444',
  critical: '#7f1d1d',
};

// ─────────────────────────────────────────────
// GET /api/ocean-health/:region_id
// 查詢指定地區的最新海洋健康指標與活躍警告
// ─────────────────────────────────────────────
router.get('/:region_id', async (req, res) => {
  const regionId = validateRegionId(req.params.region_id);
  if (!regionId) {
    return res.status(400).json({ error: '無效的 region_id，請提供正整數' });
  }

  try {
    // 取最新一筆指標記錄
    const metricsResult = await pool.query(
      `SELECT
         m.id, m.temperature, m.ph_value, m.salinity, m.turbidity,
         m.species_diversity_score, m.coral_health_score,
         m.pollution_risk_level, m.measured_at, m.data_source,
         r.name AS region_name, r.country
       FROM ocean_health_metrics m
       JOIN regions r ON r.id = m.region_id
       WHERE m.region_id = $1
       ORDER BY m.measured_at DESC
       LIMIT 1`,
      [regionId]
    );

    if (metricsResult.rows.length === 0) {
      return res.status(404).json({ error: '找不到該地區的海洋指標資料' });
    }

    const metrics = metricsResult.rows[0];

    // 取該地區未解決的警告
    const alertsResult = await pool.query(
      `SELECT id, alert_type, severity, message, created_at
       FROM alerts
       WHERE region_id = $1 AND is_resolved = false
       ORDER BY
         CASE severity
           WHEN 'critical' THEN 1
           WHEN 'high'     THEN 2
           WHEN 'medium'   THEN 3
           WHEN 'low'      THEN 4
         END,
         created_at DESC`,
      [regionId]
    );

    return res.json({
      region_id: regionId,
      region_name: metrics.region_name,
      country: metrics.country,
      measured_at: metrics.measured_at,
      data_source: metrics.data_source,
      temperature: metrics.temperature,
      ph_value: metrics.ph_value,
      salinity: metrics.salinity,
      turbidity: metrics.turbidity,
      species_diversity_score: metrics.species_diversity_score,
      coral_health_score: metrics.coral_health_score,
      pollution_risk_level: metrics.pollution_risk_level,
      risk_color: RISK_COLORS[metrics.pollution_risk_level] || '#6b7280',
      alerts: alertsResult.rows,
    });
  } catch (err) {
    console.error('ocean-health/:region_id 錯誤:', err);
    return res.status(500).json({ error: '伺服器內部錯誤，請稍後再試' });
  }
});

// ─────────────────────────────────────────────
// GET /api/alerts
// 查詢警告列表，支援 region_id 和 severity 篩選
// ─────────────────────────────────────────────
router.get('/alerts', async (req, res) => {
  const { region_id, severity } = req.query;

  const conditions = ['is_resolved = false'];
  const params = [];

  if (region_id) {
    const rid = validateRegionId(region_id);
    if (!rid) return res.status(400).json({ error: '無效的 region_id' });
    params.push(rid);
    conditions.push(`region_id = $${params.length}`);
  }

  if (severity) {
    if (!VALID_SEVERITIES.includes(severity)) {
      return res.status(400).json({
        error: `severity 必須是以下之一: ${VALID_SEVERITIES.join(', ')}`,
      });
    }
    params.push(severity);
    conditions.push(`severity = $${params.length}`);
  }

  try {
    const result = await pool.query(
      `SELECT
         a.id, a.region_id, r.name AS region_name,
         a.alert_type, a.severity, a.message, a.created_at
       FROM alerts a
       JOIN regions r ON r.id = a.region_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY
         CASE a.severity
           WHEN 'critical' THEN 1
           WHEN 'high'     THEN 2
           WHEN 'medium'   THEN 3
           WHEN 'low'      THEN 4
         END,
         a.created_at DESC`,
      params
    );

    return res.json({ total: result.rows.length, alerts: result.rows });
  } catch (err) {
    console.error('GET /alerts 錯誤:', err);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

// ─────────────────────────────────────────────
// GET /api/ocean-health/compare
// 多地區同一指標對比
// 例：/api/ocean-health/compare?regions=1,2,3&metric=temperature
// ─────────────────────────────────────────────
router.get('/compare', async (req, res) => {
  const { regions, metric } = req.query;

  const VALID_METRICS = [
    'temperature', 'ph_value', 'salinity', 'turbidity',
    'species_diversity_score', 'coral_health_score',
  ];

  if (!regions) {
    return res.status(400).json({ error: '請提供 regions 參數（逗號分隔的地區 ID）' });
  }
  if (!metric || !VALID_METRICS.includes(metric)) {
    return res.status(400).json({
      error: `metric 必須是以下之一: ${VALID_METRICS.join(', ')}`,
    });
  }

  const regionIds = regions
    .split(',')
    .map((id) => parseInt(id.trim(), 10))
    .filter((id) => Number.isInteger(id) && id > 0);

  if (regionIds.length === 0 || regionIds.length > 10) {
    return res.status(400).json({ error: '請提供 1–10 個有效的地區 ID' });
  }

  try {
    // 每個地區取最新一筆，用 DISTINCT ON
    const result = await pool.query(
      `SELECT DISTINCT ON (m.region_id)
         m.region_id, r.name AS region_name, r.country,
         m.${metric} AS value, m.measured_at
       FROM ocean_health_metrics m
       JOIN regions r ON r.id = m.region_id
       WHERE m.region_id = ANY($1::int[])
       ORDER BY m.region_id, m.measured_at DESC`,
      [regionIds]
    );

    return res.json({
      metric,
      comparison: result.rows.map((row) => ({
        region_id: row.region_id,
        region_name: row.region_name,
        country: row.country,
        value: row.value,
        measured_at: row.measured_at,
      })),
    });
  } catch (err) {
    console.error('GET /compare 錯誤:', err);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

// ─────────────────────────────────────────────
// POST /api/ocean-health/reports
// 提交海洋健康報告（含照片與手記）
// ─────────────────────────────────────────────
router.post('/reports', async (req, res) => {
  const { region_id, metrics, photos, notes } = req.body;

  // 基本驗證
  const regionId = validateRegionId(region_id);
  if (!regionId) {
    return res.status(400).json({ error: '缺少或無效的 region_id' });
  }
  if (!metrics || typeof metrics !== 'object') {
    return res.status(400).json({ error: '缺少 metrics 物件' });
  }

  const {
    temperature, ph_value, salinity, turbidity,
    species_diversity_score, coral_health_score, pollution_risk_level,
  } = metrics;

  // 數值範圍驗證
  if (temperature !== undefined && (temperature < -5 || temperature > 50)) {
    return res.status(400).json({ error: 'temperature 超出合理範圍（-5 ~ 50°C）' });
  }
  if (ph_value !== undefined && (ph_value < 0 || ph_value > 14)) {
    return res.status(400).json({ error: 'ph_value 必須介於 0 ~ 14' });
  }
  if (
    pollution_risk_level &&
    !['low', 'medium', 'high', 'critical'].includes(pollution_risk_level)
  ) {
    return res.status(400).json({ error: '無效的 pollution_risk_level' });
  }

  try {
    const insertResult = await pool.query(
      `INSERT INTO ocean_health_metrics
         (region_id, temperature, ph_value, salinity, turbidity,
          species_diversity_score, coral_health_score, pollution_risk_level,
          measured_at, data_source, notes, photos)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW(), 'community_report', $9, $10)
       RETURNING id, created_at`,
      [
        regionId,
        temperature ?? null,
        ph_value ?? null,
        salinity ?? null,
        turbidity ?? null,
        species_diversity_score ?? null,
        coral_health_score ?? null,
        pollution_risk_level ?? null,
        notes ?? null,
        JSON.stringify(photos ?? []),
      ]
    );

    const { id, created_at } = insertResult.rows[0];

    // 如果污染等級為高或危急，自動建立警告
    if (['high', 'critical'].includes(pollution_risk_level)) {
      await pool.query(
        `INSERT INTO alerts (metric_id, region_id, alert_type, severity, message)
         VALUES ($1, $2, 'pollution', $3, $4)`,
        [
          id,
          regionId,
          pollution_risk_level,
          `社群回報：${pollution_risk_level === 'critical' ? '危急' : '高度'} 污染風險`,
        ]
      );
    }

    return res.status(201).json({
      id,
      status: 'accepted',
      created_at,
      message: '報告已成功提交，感謝您的貢獻！',
    });
  } catch (err) {
    console.error('POST /reports 錯誤:', err);
    return res.status(500).json({ error: '伺服器內部錯誤' });
  }
});

module.exports = router;
