// --- Firestore Database Wrapper + Demo Mode Support ---

const IS_DEMO = firebaseConfig.apiKey === "YOUR_API_KEY";

const DB = {
  // 模擬延遲 (讓 Demo 更有感覺)
  async _delay(ms = 800) {
    return new Promise(r => setTimeout(r, ms));
  },

  // 儲存一次守護行動
  async saveAction(userId, data) {
    if (IS_DEMO) {
      await this._delay();
      const demoActions = JSON.parse(localStorage.getItem('demo_actions') || '[]');
      const today = new Date().toLocaleDateString('sv-SE');
      if (demoActions.some(a => a.dateKey === today)) throw new Error('你今天已經完成過守護任務了。');
      
      const reductionGram = Number((0.3 + Math.random() * 0.5).toFixed(2));
      const action = { userId, dateKey: today, ...data, reductionGram, createdAt: new Date().toISOString() };
      demoActions.push(action);
      localStorage.setItem('demo_actions', JSON.stringify(demoActions));
      return action;
    }

    const today = new Date().toLocaleDateString('sv-SE');
    const actionRef = db.collection('actions').doc(`${userId}_${today}`);
    const doc = await actionRef.get();
    if (doc.exists) throw new Error('你今天已經完成過守護任務了，明天再來吧！');

    const reductionGram = Number((0.3 + Math.random() * 0.5).toFixed(2));
    const actionData = {
      userId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      dateKey: today,
      ...data,
      reductionGram
    };

    await actionRef.set(actionData);
    const userRef = db.collection('users').doc(userId);
    await userRef.update({
      totalActions: firebase.firestore.FieldValue.increment(1),
      lastActionDate: today
    });
    return actionData;
  },

  // 取得使用者進度
  async getUserProgress(userId) {
    let actions = [];
    if (IS_DEMO) {
      actions = JSON.parse(localStorage.getItem('demo_actions') || '[]');
    } else {
      const snap = await db.collection('actions').where('userId', '==', userId).orderBy('dateKey', 'desc').limit(10).get();
      actions = snap.docs.map(d => d.data());
    }
    
    const uniqueDays = [...new Set(actions.map(a => a.dateKey))];
    let streak = 0;
    const today = new Date();
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const key = d.toLocaleDateString('sv-SE');
      if (uniqueDays.includes(key)) streak++;
      else if (i > 0) break;
    }

    return { stampCount: Math.min(uniqueDays.length, 5), streakDays: streak };
  },

  // 送出投稿
  async submitPhoto(userId, data) {
    if (IS_DEMO) {
      await this._delay();
      const subs = JSON.parse(localStorage.getItem('demo_subs') || '[]');
      subs.push({ userId, ...data, status: 'approved', createdAt: new Date().toISOString() });
      localStorage.setItem('demo_subs', JSON.stringify(subs));
      return { id: 'demo_' + Date.now() };
    }
    return await db.collection('submissions').add({
      userId,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
      status: 'approved',
      ...data
    });
  },

  // 取得隨機獎勵照片
  async getRandomReward(coastId) {
    const fallback = {
      photoUrl: 'https://images.unsplash.com/photo-1505118380757-91f5f45d8de4?w=800',
      story: '大海在靜靜地呼吸，感謝你的每一份心意。',
      nickname: '海洋之友',
      locationName: '台灣海岸'
    };

    try {
      if (IS_DEMO) {
        const subs = JSON.parse(localStorage.getItem('demo_subs') || '[]');
        const pool = coastId ? subs.filter(s => s.coastId === coastId) : subs;
        return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : fallback;
      }

      let query = db.collection('submissions').where('status', '==', 'approved');
      if (coastId) query = query.where('coastId', '==', coastId);
      const snap = await query.limit(20).get();
      
      if (snap.empty) {
        // 如果特定海域沒照片，找全台灣的
        const allSnap = await db.collection('submissions').where('status', '==', 'approved').limit(1).get();
        return allSnap.empty ? fallback : allSnap.docs[0].data();
      }
      return snap.docs[Math.floor(Math.random() * snap.docs.length)].data();
    } catch (err) {
      console.warn("Reward fetch failed, using fallback:", err);
      return fallback;
    }
  },

  // 取得本月全體影響力數據 (KPI)
  async getMonthlyMetrics() {
    let actions = [];
    if (IS_DEMO) {
      actions = JSON.parse(localStorage.getItem('demo_actions') || '[]');
    } else {
      const snap = await db.collection('actions').get();
      actions = snap.docs.map(d => d.data());
    }
    
    const totalReduction = actions.reduce((sum, a) => sum + (a.reductionGram || 0), 0);
    const uniqueUsers = new Set(actions.map(a => a.userId)).size;
    const byCoast = {};
    actions.forEach(a => { byCoast[a.coastId] = (byCoast[a.coastId] || 0) + 1; });

    return {
      actionCount: actions.length || 0,
      participantCount: uniqueUsers || 0,
      reductionGram: Number(totalReduction.toFixed(2)),
      byCoast
    };
  }
};
