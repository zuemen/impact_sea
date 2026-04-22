// --- Firestore Database Wrapper + Demo Mode Support ---

const IS_DEMO = firebaseConfig.apiKey === "YOUR_API_KEY";

const DB = {
  // 儲存一次守護行動
  async saveAction(userId, data) {
    const res = await fetch('/api/actions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, deviceId: userId, ...data })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || '儲存失敗');
    }
    return await res.json();
  },

  // 取得使用者進度
  async getUserProgress(userId) {
    // 這裡暫時維持從 actions 獲取基本計算
    const res = await fetch('/api/metrics');
    const metrics = await res.json();
    
    // 為了簡單化，從 metrics 取得全體數據，個別使用者進度在 MVP 中可先模擬或從 API 擴展
    return { stampCount: Math.min(metrics.actionCount, 5), streakDays: metrics.actionCount > 0 ? 1 : 0 };
  },

  // 送出投稿
  async submitPhoto(userId, data) {
    const res = await fetch('/api/submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
