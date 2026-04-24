/**
 * 海洋健康儀表板 React 組件
 * 顯示溫度、水質、生態評分、風險等級及趨勢圖表
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts';

// ── 子組件：指標卡片 ──────────────────────────────────
function MetricCard({ title, value, unit, trend, color, children }) {
  const trendIcon = trend > 0 ? '↑' : trend < 0 ? '↓' : '→';
  const trendColor = trend > 0 ? '#ef4444' : trend < 0 ? '#22c55e' : '#6b7280';

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '1.25rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      borderLeft: `4px solid ${color}`,
    }}>
      <p style={{ margin: 0, fontSize: 13, color: '#6b7280', fontWeight: 500 }}>{title}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, margin: '0.4rem 0' }}>
        <span style={{ fontSize: 28, fontWeight: 700, color: '#1e293b' }}>
          {value ?? '—'}
        </span>
        {unit && <span style={{ fontSize: 14, color: '#94a3b8' }}>{unit}</span>}
        {trend !== undefined && (
          <span style={{ fontSize: 16, color: trendColor, marginLeft: 4 }}>{trendIcon}</span>
        )}
      </div>
      {children}
    </div>
  );
}

// ── 子組件：風險等級徽章 ──────────────────────────────
const RISK_CONFIG = {
  low:      { label: '低風險',  bg: '#dcfce7', text: '#166534' },
  medium:   { label: '中風險',  bg: '#fef9c3', text: '#854d0e' },
  high:     { label: '高風險',  bg: '#fee2e2', text: '#991b1b' },
  critical: { label: '危急',    bg: '#450a0a', text: '#fca5a5' },
};

function RiskBadge({ level }) {
  const cfg = RISK_CONFIG[level] ?? { label: '未知', bg: '#f1f5f9', text: '#475569' };
  return (
    <span style={{
      display: 'inline-block',
      padding: '2px 12px',
      borderRadius: 999,
      fontSize: 13,
      fontWeight: 600,
      background: cfg.bg,
      color: cfg.text,
    }}>
      {cfg.label}
    </span>
  );
}

// ── 子組件：警告橫幅 ─────────────────────────────────
function AlertBanner({ alerts }) {
  if (!alerts || alerts.length === 0) return null;
  return (
    <div style={{
      background: '#fef2f2',
      border: '1px solid #fca5a5',
      borderRadius: 8,
      padding: '0.75rem 1rem',
      marginBottom: '1rem',
    }}>
      <p style={{ margin: 0, fontWeight: 600, color: '#b91c1c', marginBottom: 4 }}>
        ⚠ 目前警告 ({alerts.length})
      </p>
      {alerts.map((a) => (
        <p key={a.id} style={{ margin: '2px 0', fontSize: 14, color: '#7f1d1d' }}>
          [{a.severity.toUpperCase()}] {a.message}
        </p>
      ))}
    </div>
  );
}

// ── 主組件 ───────────────────────────────────────────
export default function OceanHealthDashboard({ regionId }) {
  const [data, setData]       = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [metric, setMetric]   = useState('temperature');

  const METRICS_OPTIONS = [
    { value: 'temperature', label: '水溫 (°C)' },
    { value: 'ph_value',    label: 'pH 值' },
    { value: 'salinity',    label: '鹽度 (PSU)' },
    { value: 'turbidity',   label: '濁度 (NTU)' },
  ];

  // 載入最新指標
  const fetchHealth = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(`/api/ocean-health/${regionId}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setData(await res.json());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [regionId]);

  // 載入歷史趨勢（近 30 筆）
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/ocean-health/${regionId}/history?metric=${metric}&limit=30`
      );
      if (!res.ok) return;
      const json = await res.json();
      setHistory(json.history ?? []);
    } catch {
      // 歷史資料載入失敗不影響主顯示
    }
  }, [regionId, metric]);

  useEffect(() => { fetchHealth(); }, [fetchHealth]);
  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  // ── 響應式網格樣式 ──────────────────────────────────
  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '1rem',
    marginBottom: '1.5rem',
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>
        載入海洋資料中…
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        background: '#fef2f2', border: '1px solid #fca5a5',
        borderRadius: 8, padding: '1rem', color: '#b91c1c',
      }}>
        載入失敗：{error}
        <button
          onClick={fetchHealth}
          style={{ marginLeft: 12, padding: '4px 12px', cursor: 'pointer' }}
        >
          重試
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 960, margin: '0 auto', padding: '1rem' }}>
      {/* 標題列 */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0f172a' }}>
            🌊 {data.region_name} 海洋健康
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#94a3b8' }}>
            最後更新：{new Date(data.measured_at).toLocaleString('zh-TW')}
            　來源：{data.data_source}
          </p>
        </div>
        <RiskBadge level={data.pollution_risk_level} />
      </div>

      {/* 警告橫幅 */}
      <AlertBanner alerts={data.alerts} />

      {/* 溫度卡片 */}
      <div style={gridStyle}>
        <MetricCard
          title="水溫"
          value={data.temperature?.toFixed(1)}
          unit="°C"
          color="#3b82f6"
          trend={data.temperature > 28 ? 1 : data.temperature < 20 ? -1 : 0}
        />

        {/* 水質群組 */}
        <MetricCard title="pH 值" value={data.ph_value?.toFixed(2)} color="#8b5cf6">
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>
            正常範圍：7.8 – 8.5
          </div>
        </MetricCard>

        <MetricCard
          title="鹽度"
          value={data.salinity?.toFixed(1)}
          unit="PSU"
          color="#06b6d4"
        />

        <MetricCard
          title="濁度"
          value={data.turbidity?.toFixed(1)}
          unit="NTU"
          color="#f59e0b"
        />
      </div>

      {/* 生態評分 */}
      <div style={{ ...gridStyle, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        <MetricCard title="物種多樣性評分" value={data.species_diversity_score} unit="/ 100" color="#22c55e">
          <div style={{
            marginTop: 8, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${data.species_diversity_score ?? 0}%`,
              background: '#22c55e', borderRadius: 4,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </MetricCard>

        <MetricCard title="珊瑚健康評分" value={data.coral_health_score} unit="/ 100" color="#f97316">
          <div style={{
            marginTop: 8, height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden',
          }}>
            <div style={{
              height: '100%', width: `${data.coral_health_score ?? 0}%`,
              background: '#f97316', borderRadius: 4,
              transition: 'width 0.6s ease',
            }} />
          </div>
        </MetricCard>
      </div>

      {/* 趨勢圖表 */}
      <div style={{
        background: '#fff', borderRadius: 12,
        padding: '1.25rem', boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0, fontSize: 15, color: '#1e293b' }}>歷史趨勢</h3>
          <select
            value={metric}
            onChange={(e) => setMetric(e.target.value)}
            style={{
              padding: '4px 8px', borderRadius: 6,
              border: '1px solid #e2e8f0', fontSize: 13,
            }}
          >
            {METRICS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {history.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={history}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="measured_at"
                tickFormatter={(v) => new Date(v).toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' })}
                tick={{ fontSize: 11 }}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                labelFormatter={(v) => new Date(v).toLocaleString('zh-TW')}
                formatter={(v) => [v, METRICS_OPTIONS.find((o) => o.value === metric)?.label]}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="value"
                name={METRICS_OPTIONS.find((o) => o.value === metric)?.label}
                stroke="#3b82f6"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: 14 }}>暫無歷史資料</p>
        )}
      </div>
    </div>
  );
}
