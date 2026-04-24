/**
 * 排行榜 React 組件
 * 支援城市/個人切換、時間段選擇、排名表格及個人排名卡片
 */

import React, { useState, useEffect, useCallback } from 'react';

// ── 排名徽章顏色 ─────────────────────────────────────
function RankBadge({ rank }) {
  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  if (medals[rank]) {
    return <span style={{ fontSize: 22 }}>{medals[rank]}</span>;
  }
  return (
    <span style={{
      display: 'inline-block', width: 32, textAlign: 'center',
      fontSize: 14, fontWeight: 700, color: '#64748b',
    }}>
      {rank}
    </span>
  );
}

// ── 子組件：個人排名卡片 ────────────────────────────
function PersonalRankCard({ data }) {
  if (!data) return null;
  return (
    <div style={{
      background: 'linear-gradient(135deg, #0ea5e9 0%, #6366f1 100%)',
      borderRadius: 12,
      padding: '1.25rem 1.5rem',
      color: '#fff',
      marginBottom: '1.5rem',
      display: 'flex',
      flexWrap: 'wrap',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    }}>
      <div>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>您的本月排名</p>
        <p style={{ margin: '4px 0 0', fontSize: 28, fontWeight: 800 }}>
          #{data.rank}
          {data.city_rank && (
            <span style={{ fontSize: 16, fontWeight: 500, opacity: 0.85, marginLeft: 12 }}>
              （{data.city} 第 {data.city_rank} 名）
            </span>
          )}
        </p>
      </div>
      <div style={{ textAlign: 'right' }}>
        <p style={{ margin: 0, fontSize: 13, opacity: 0.8 }}>{data.user_name}</p>
        <p style={{ margin: '4px 0 0', fontSize: 22, fontWeight: 700 }}>
          {data.total_points.toLocaleString()} 積分
        </p>
      </div>
    </div>
  );
}

// ── 主組件 ───────────────────────────────────────────
export default function LeaderboardView() {
  const [type, setType]           = useState('city');
  const [period, setPeriod]       = useState('month');
  const [entries, setEntries]     = useState([]);
  const [personal, setPersonal]   = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);

  const TYPE_OPTIONS = [
    { value: 'city',       label: '🏙 城市排行榜' },
    { value: 'individual', label: '👤 個人排行榜' },
  ];

  const PERIOD_OPTIONS = [
    { value: 'week',  label: '本週' },
    { value: 'month', label: '本月' },
    { value: 'all',   label: '全時間' },
  ];

  // 載入排行榜
  const fetchLeaderboard = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = new URLSearchParams({ type, period, limit: 20 });
      const res = await fetch(`/api/leaderboard?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setEntries(json.entries ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [type, period]);

  // 載入個人排名
  const fetchPersonal = useCallback(async () => {
    try {
      const res = await fetch('/api/leaderboard/personal');
      if (!res.ok) return; // 未登入或無記錄，靜默忽略
      setPersonal(await res.json());
    } catch {
      // 忽略
    }
  }, []);

  useEffect(() => { fetchLeaderboard(); }, [fetchLeaderboard]);
  useEffect(() => { fetchPersonal(); }, [fetchPersonal]);

  // ── 表格欄位定義 ─────────────────────────────────
  const cityColumns = [
    { key: 'rank',                 label: '排名',   width: 60  },
    { key: 'city',                 label: '城市',   flex: 1    },
    { key: 'total_points',         label: '總積分', width: 100 },
    { key: 'challenges_completed', label: '完成挑戰', width: 90 },
    { key: 'actions_count',        label: '行動次數', width: 90 },
  ];
  const individualColumns = [
    { key: 'rank',                 label: '排名',   width: 60  },
    { key: 'user_name',            label: '使用者', flex: 1    },
    { key: 'total_points',         label: '總積分', width: 100 },
    { key: 'challenges_completed', label: '完成挑戰', width: 90 },
  ];
  const columns = type === 'city' ? cityColumns : individualColumns;

  const headerStyle = {
    display: 'flex', alignItems: 'center',
    padding: '10px 16px',
    background: '#f8fafc',
    borderBottom: '1px solid #e2e8f0',
    fontSize: 13, fontWeight: 600, color: '#475569',
  };

  const rowStyle = (isHighlight) => ({
    display: 'flex', alignItems: 'center',
    padding: '12px 16px',
    borderBottom: '1px solid #f1f5f9',
    background: isHighlight ? 'rgba(14,165,233,0.06)' : '#fff',
    transition: 'background 0.15s',
  });

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 800, margin: '0 auto', padding: '1rem' }}>
      <h2 style={{ margin: '0 0 1.25rem', color: '#0f172a' }}>🏆 社區排行榜</h2>

      {/* 個人排名卡片 */}
      <PersonalRankCard data={personal} />

      {/* 控制列 */}
      <div style={{
        display: 'flex', flexWrap: 'wrap',
        alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: '1rem',
      }}>
        {/* 類型切換 */}
        <div style={{ display: 'flex', background: '#f1f5f9', borderRadius: 8, padding: 3 }}>
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setType(opt.value)}
              style={{
                padding: '7px 16px', border: 'none', borderRadius: 6,
                fontSize: 14, fontWeight: 500, cursor: 'pointer',
                background: type === opt.value ? '#fff' : 'transparent',
                color: type === opt.value ? '#0f172a' : '#64748b',
                boxShadow: type === opt.value ? '0 1px 4px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 時間段選擇 */}
        <div style={{ display: 'flex', gap: 8 }}>
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setPeriod(opt.value)}
              style={{
                padding: '6px 14px', border: 'none', borderRadius: 999,
                fontSize: 13, cursor: 'pointer',
                background: period === opt.value ? '#0ea5e9' : '#f1f5f9',
                color: period === opt.value ? '#fff' : '#475569',
                fontWeight: period === opt.value ? 600 : 400,
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 排名表格 */}
      <div style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
      }}>
        {/* 表頭 */}
        <div style={headerStyle}>
          {columns.map((col) => (
            <div
              key={col.key}
              style={{ width: col.width, flex: col.flex, textAlign: col.width ? 'center' : 'left' }}
            >
              {col.label}
            </div>
          ))}
        </div>

        {/* 載入中 */}
        {loading && (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>載入中…</p>
        )}

        {/* 錯誤 */}
        {error && !loading && (
          <p style={{ textAlign: 'center', color: '#b91c1c', padding: '2rem' }}>
            載入失敗：{error}
          </p>
        )}

        {/* 空狀態 */}
        {!loading && !error && entries.length === 0 && (
          <p style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>
            目前尚無排名資料
          </p>
        )}

        {/* 資料列 */}
        {!loading && entries.map((entry, idx) => {
          const isPersonalRow =
            type === 'individual' &&
            personal &&
            entry.user_name === personal.user_name;

          return (
            <div key={idx} style={rowStyle(isPersonalRow)}>
              {columns.map((col) => (
                <div
                  key={col.key}
                  style={{
                    width: col.width,
                    flex: col.flex,
                    textAlign: col.width ? 'center' : 'left',
                    fontSize: 14,
                    color: '#1e293b',
                    fontWeight: isPersonalRow ? 600 : 400,
                  }}
                >
                  {col.key === 'rank' ? (
                    <RankBadge rank={entry.rank} />
                  ) : col.key === 'total_points' ? (
                    <span style={{ color: '#0ea5e9', fontWeight: 700 }}>
                      {entry.total_points?.toLocaleString()}
                    </span>
                  ) : (
                    entry[col.key] ?? '—'
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* 說明文字 */}
      <p style={{ textAlign: 'center', fontSize: 12, color: '#94a3b8', marginTop: '1rem' }}>
        排行榜每 15 分鐘更新一次 · 積分依參與挑戰及記錄行動累計
      </p>
    </div>
  );
}
