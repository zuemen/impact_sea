// --- Database / API Wrapper ---
// IS_DEMO 已在 auth.js 定義為全域變數，此處不重複宣告

const DB = {

  // 儲存一次守護行動，server 同步發放積點並回傳 pointsEarned / txHash
  async saveAction(userId, data) {
    const token = window.getSessionToken ? window.getSessionToken() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['x-session-token'] = token;
    const res = await fetch('/api/actions', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        deviceId: userId,
        coastId: data.coastId,
        verifiedItems: data.verifiedItems || [],
        locationPoint: data.locationPoint || "unknown"
      })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '儲存失敗');
    }
    return await res.json(); // { action, reward, progress, pointsEarned, newBalance, txHash }
  },

  // 取得使用者個人進度（印章數、連續天數）
  async getUserProgress(userId) {
    try {
      const res = await fetch(`/api/progress?deviceId=${encodeURIComponent(userId)}`);
      if (!res.ok) return { stampCount: 0, streakDays: 0, totalActions: 0 };
      return await res.json();
    } catch {
      return { stampCount: 0, streakDays: 0, totalActions: 0 };
    }
  },

  // 送出投稿
  async submitPhoto(userId, data) {
    const token = window.getSessionToken ? window.getSessionToken() : null;
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['x-session-token'] = token;
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId, ...data })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '投稿失敗');
    }
    return await res.json();
  },

  // 取得隨機獎勵照片
  async getRandomReward(coastId) {
    const res = await fetch(`/api/photos/random${coastId ? '?coastId=' + coastId : ''}`);
    const data = await res.json();
    return data.item;
  },

  // 取得本月全體影響力數據 (KPI)
  async getMonthlyMetrics() {
    const res = await fetch('/api/metrics');
    return await res.json();
  }
};
