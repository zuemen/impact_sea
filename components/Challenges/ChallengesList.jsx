/**
 * 社區挑戰列表 React 組件
 * 顯示挑戰卡片、進度條、倒計時、篩選功能及加入對話框
 */

import React, { useState, useEffect, useCallback } from 'react';

// ── 工具：計算剩餘時間字串 ─────────────────────────────
function timeLeft(endDate) {
  const diff = new Date(endDate) - new Date();
  if (diff <= 0) return '已結束';
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days > 0) return `${days} 天後截止`;
  return `${hours} 小時後截止`;
}

// ── 挑戰類型標籤顏色 ─────────────────────────────────
const TYPE_COLORS = {
  cleanup:      { bg: '#dbeafe', text: '#1d4ed8', label: '淨灘' },
  photo:        { bg: '#fce7f3', text: '#be185d', label: '拍照記錄' },
  education:    { bg: '#d1fae5', text: '#065f46', label: '教育推廣' },
  reduction:    { bg: '#fef3c7', text: '#92400e', label: '減塑行動' },
};

// ── 子組件：進度條 ───────────────────────────────────
function ProgressBar({ percentage, color = '#3b82f6' }) {
  return (
    <div style={{ height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{
        height: '100%',
        width: `${Math.min(percentage, 100)}%`,
        background: color,
        borderRadius: 4,
        transition: 'width 0.5s ease',
      }} />
    </div>
  );
}

// ── 子組件：加入確認對話框 ──────────────────────────
function JoinDialog({ challenge, onConfirm, onClose }) {
  if (!challenge) return null;
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000,
      padding: '1rem',
    }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#fff', borderRadius: 16,
          padding: '2rem', maxWidth: 420, width: '100%',
          boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ margin: '0 0 0.5rem', color: '#0f172a' }}>{challenge.title}</h3>
        <p style={{ color: '#64748b', fontSize: 14, lineHeight: 1.6 }}>
          加入後將計入您的積分紀錄，挑戰截止日期為{' '}
          <strong>{new Date(challenge.end_date).toLocaleDateString('zh-TW')}</strong>，
          完成可獲得 <strong>{challenge.reward_points} 積分</strong>。
        </p>
        <div style={{ display: 'flex', gap: 12, marginTop: '1.5rem' }}>
          <button
            onClick={() => onConfirm(challenge.id)}
            style={{
              flex: 1, padding: '10px 0',
              background: '#0ea5e9', color: '#fff',
              border: 'none', borderRadius: 8,
              fontSize: 15, fontWeight: 600, cursor: 'pointer',
            }}
          >
            確認加入
          </button>
          <button
            onClick={onClose}
            style={{
              flex: 1, padding: '10px 0',
              background: '#f1f5f9', color: '#475569',
              border: 'none', borderRadius: 8,
              fontSize: 15, cursor: 'pointer',
            }}
          >
            取消
          </button>
        </div>
      </div>
    </div>
  );
}

// ── 子組件：挑戰卡片 ─────────────────────────────────
function ChallengeCard({ challenge, onJoin }) {
  const typeCfg = TYPE_COLORS[challenge.type] ?? { bg: '#f8fafc', text: '#475569', label: challenge.type };
  const isEnded = new Date(challenge.end_date) < new Date();

  return (
    <div style={{
      background: '#fff',
      borderRadius: 12,
      padding: '1.25rem',
      boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
    }}>
      {/* 標題列 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <h3 style={{ margin: 0, fontSize: 16, color: '#0f172a', lineHeight: 1.4 }}>
          {challenge.title}
        </h3>
        <span style={{
          flexShrink: 0,
          padding: '2px 10px', borderRadius: 999,
          fontSize: 12, fontWeight: 600,
          background: typeCfg.bg, color: typeCfg.text,
        }}>
          {typeCfg.label}
        </span>
      </div>

      {/* 進度 */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#64748b', marginBottom: 6 }}>
          <span>進度</span>
          <span>
            {challenge.current_count} / {challenge.target_count} {challenge.unit}
            （{challenge.progress_percentage}%）
          </span>
        </div>
        <ProgressBar percentage={challenge.progress_percentage} />
      </div>

      {/* 元數據 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, fontSize: 13, color: '#94a3b8' }}>
        <span>👥 {challenge.participant_count ?? 0} 人參與</span>
        <span>🏆 {challenge.reward_points} 積分</span>
        {challenge.region_name && <span>📍 {challenge.region_name}</span>}
        <span style={{ color: isEnded ? '#ef4444' : '#f59e0b' }}>
          ⏰ {timeLeft(challenge.end_date)}
        </span>
      </div>

      {/* 加入按鈕 */}
      {challenge.has_user_joined ? (
        <div style={{
          textAlign: 'center', padding: '8px',
          background: '#f0fdf4', borderRadius: 8,
          color: '#16a34a', fontWeight: 600, fontSize: 14,
        }}>
          ✓ 已加入
        </div>
      ) : (
        <button
          disabled={isEnded}
          onClick={() => onJoin(challenge)}
          style={{
            width: '100%', padding: '10px 0',
            background: isEnded ? '#e2e8f0' : '#0ea5e9',
            color: isEnded ? '#94a3b8' : '#fff',
            border: 'none', borderRadius: 8,
            fontSize: 14, fontWeight: 600,
            cursor: isEnded ? 'not-allowed' : 'pointer',
            transition: 'background 0.2s',
          }}
        >
          {isEnded ? '已截止' : '加入挑戰'}
        </button>
      )}
    </div>
  );
}

// ── 主組件 ───────────────────────────────────────────
export default function ChallengesList({ regionId }) {
  const [challenges, setChallenges] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [statusFilter, setStatus]   = useState('active');
  const [joiningChallenge, setJoining] = useState(null); // 待確認加入的挑戰
  const [toast, setToast]           = useState(null);

  const STATUS_OPTIONS = [
    { value: 'active',    label: '進行中' },
    { value: 'upcoming',  label: '即將開始' },
    { value: 'completed', label: '已結束' },
    { value: 'all',       label: '全部' },
  ];

  // 載入挑戰列表
  const fetchChallenges = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({ status: statusFilter });
      if (regionId) params.set('region_id', regionId);
      const res = await fetch(`/api/challenges?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setChallenges(json.challenges ?? []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, regionId]);

  useEffect(() => { fetchChallenges(); }, [fetchChallenges]);

  // 執行加入挑戰
  const handleJoin = async (challengeId) => {
    setJoining(null);
    try {
      const res = await fetch(`/api/challenges/${challengeId}/join`, { method: 'POST' });
      if (res.status === 409) {
        showToast('您已加入此挑戰', 'info');
        return;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      // 本地更新狀態，避免重新請求
      setChallenges((prev) =>
        prev.map((c) =>
          c.id === challengeId ? { ...c, has_user_joined: true } : c
        )
      );
      showToast('成功加入挑戰！開始為海洋貢獻吧 🌊', 'success');
    } catch (e) {
      showToast(`加入失敗：${e.message}`, 'error');
    }
  };

  function showToast(message, type = 'info') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }

  const TOAST_COLORS = {
    success: { bg: '#f0fdf4', border: '#86efac', text: '#166534' },
    error:   { bg: '#fef2f2', border: '#fca5a5', text: '#991b1b' },
    info:    { bg: '#eff6ff', border: '#93c5fd', text: '#1e40af' },
  };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 960, margin: '0 auto', padding: '1rem' }}>
      {/* 標題 & 篩選 */}
      <div style={{
        display: 'flex', flexWrap: 'wrap',
        alignItems: 'center', justifyContent: 'space-between',
        gap: 12, marginBottom: '1.25rem',
      }}>
        <h2 style={{ margin: 0, color: '#0f172a' }}>🏅 社區挑戰</h2>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setStatus(opt.value)}
              style={{
                padding: '6px 14px',
                borderRadius: 999,
                border: 'none',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
                background: statusFilter === opt.value ? '#0ea5e9' : '#f1f5f9',
                color: statusFilter === opt.value ? '#fff' : '#475569',
                transition: 'all 0.15s',
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* 載入 / 錯誤 / 空狀態 */}
      {loading && (
        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>載入挑戰中…</p>
      )}
      {error && !loading && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '1rem', color: '#b91c1c' }}>
          載入失敗：{error}
          <button onClick={fetchChallenges} style={{ marginLeft: 12, padding: '4px 12px', cursor: 'pointer' }}>重試</button>
        </div>
      )}
      {!loading && !error && challenges.length === 0 && (
        <p style={{ textAlign: 'center', color: '#94a3b8', padding: '3rem 0' }}>目前沒有符合條件的挑戰</p>
      )}

      {/* 挑戰網格 */}
      {!loading && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '1rem',
        }}>
          {challenges.map((c) => (
            <ChallengeCard key={c.id} challenge={c} onJoin={setJoining} />
          ))}
        </div>
      )}

      {/* 加入確認對話框 */}
      <JoinDialog
        challenge={joiningChallenge}
        onConfirm={handleJoin}
        onClose={() => setJoining(null)}
      />

      {/* Toast 通知 */}
      {toast && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          padding: '12px 20px',
          borderRadius: 10,
          border: `1px solid ${TOAST_COLORS[toast.type].border}`,
          background: TOAST_COLORS[toast.type].bg,
          color: TOAST_COLORS[toast.type].text,
          fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.12)',
          zIndex: 2000,
          maxWidth: 320,
          animation: 'fadeIn 0.2s ease',
        }}>
          {toast.message}
        </div>
      )}
    </div>
  );
}
