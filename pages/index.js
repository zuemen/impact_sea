import { useState, useEffect } from 'react';
import Head from 'next/head';

// 測試用預設管理者 ID
const ADMIN_TEST_UID = 'U735e28c5b4fd267ab0e92c9890d4f232';

// 毒舌金句庫 (供 Demo 模式前端模擬打卡展示用)
const TOXIC_QUOTES = [
  '打卡成功！你今天拯救了 10g 塑膠。不過你知道你大腦裡可能已經累積了無數微塑膠嗎？沒關係，反正大腦病變、記憶退化只是早晚的事，繼續加油喔！🐢',
  '感謝你的減塑打卡。不過，海龜被塑膠吸管卡住氣管，跟你血管被微塑膠填滿堵塞，其實也差不了多少。祝你健康！💀',
  '打卡完成，累計減塑 +10g。你知道塑化劑會透過食物鏈再流回你的餐桌嗎？你今天少丟的塑膠，可能明天就在你自帶餐盒的便當裡了。🐢',
  '恭喜！海龜今天稍微能喘口氣。但你每天喝的瓶裝水裡，含有上百萬顆奈米級微塑膠。它們現在可能正在穿過你的血腦屏障、進入神經元裡散步呢。🧠',
  '打卡成功。但別高興太早，微塑膠已經在人類的心臟、血液跟大腦中被發現。你現在才自備環保杯，是在跟體內的微塑膠妥協嗎？🐢',
  '打卡紀錄完成。海龜雖然不用被網袋纏住，但你體內的微塑膠已經在干擾你的內分泌了。別擔心，反正大家都一樣，對吧？💀',
  '減塑打卡成功。順帶一提，微塑膠早已被發現存在於人類的胎盤與睾丸中。也就是說，即便你現在少拿一個塑膠袋，你的下一代在出生前就已經在被塑料『塑形』了呢。👶',
  '成功減塑 10g！很棒的儀式感。但你呼吸的空氣、吃的海鮮裡全是微塑膠。它們正在你體內引起慢性發炎，逐漸破壞免疫系統。你的微小努力，真能趕上你被塑料化的速度嗎？🦠',
  '打卡成功。海龜感謝你，但你的肝臟與腎臟可能要抗議了。微塑膠在這些排毒器官累積，正悄悄干擾你的新陳代謝。希望你用環保杯時，能忘記自己身體正在石化這件事。🧪',
  '減塑紀錄已更新。雖然今天少用了一個塑膠杯，但你的關節液、甚至骨髓裡，可能都有奈米塑膠在默默堆積。這大概是人類進化成『鋼鐵人』的必經之路吧，祝你好運。🦾',
];

export default function Home() {
  const [liffObject, setLiffObject] = useState(null);
  const [userId, setUserId] = useState('');
  const [profileName, setProfileName] = useState('');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [customUid, setCustomUid] = useState(ADMIN_TEST_UID);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [mounted, setMounted] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLiffReady, setIsLiffReady] = useState(false);

  // 頁面載入動畫
  useEffect(() => {
    setMounted(true);
  }, []);

  // 1. 初始化 LIFF SDK (僅在瀏覽器端執行)
  useEffect(() => {
    const initLiff = async () => {
      try {
        const liff = (await import('@line/liff')).default;
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '2010433464-wBKOZ1TT';
        await liff.init({ liffId });
        setLiffObject(liff);
        setIsLiffReady(true);

        if (liff.isLoggedIn()) {
          setIsLoggedIn(true);
          const profile = await liff.getProfile();
          setUserId(profile.userId);
          setProfileName(profile.displayName || 'LINE 守護者');
          fetchUserStatus(profile.userId);
        } else {
          setIsLoggedIn(false);
          // 如果是在 LINE App 內開啟，自動觸發授權登入，降底阻力
          if (liff.isInClient()) {
            liff.login();
          }
        }
      } catch (err) {
        console.error('LIFF initialization failed:', err);
        setTestMode(true);
        setIsLiffReady(true);
        setIsLoggedIn(true);
        setError('LIFF 初始化失敗，已自動開啟開發測試模式。');
        setUserId(ADMIN_TEST_UID);
        setProfileName('測試用孿生體');
        fetchUserStatus(ADMIN_TEST_UID);
      }
    };
    initLiff();
  }, []);

  // 登入觸發函式
  const handleLogin = () => {
    if (liffObject && !liffObject.isLoggedIn()) {
      liffObject.login();
    }
  };

  // 2. 呼叫 API 查詢使用者狀態
  const fetchUserStatus = async (uid) => {
    if (!uid) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/user-status?userId=${encodeURIComponent(uid)}`);
      const result = await res.json();
      if (result.success) {
        let data = result.data;
        if (result.demo) {
          setIsDemoMode(true);
          // 在 Demo 模式下，自本機端 localStorage 讀取累積天數與重量，達到累積效果
          const localLastScan = localStorage.getItem(`last_scan_date_${uid}`);
          const localSavedGrams = localStorage.getItem(`total_saved_grams_${uid}`);
          
          if (localLastScan) data.last_scan_date = localLastScan;
          if (localSavedGrams) data.total_saved_grams = parseInt(localSavedGrams, 10);
          
          // 計算未打卡天數
          const now = new Date();
          const lastScan = new Date(data.last_scan_date);
          const diffTime = Math.abs(now - lastScan);
          const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
          
          data.continuous_inactive_days = diffDays;
          if (diffDays >= 7) data.turtle_status = 0;
          else if (diffDays >= 3) data.turtle_status = 1;
          else data.turtle_status = 2;
        }
        setUserData(data);
      } else {
        setError('資料庫連線失敗：' + (result.error || '未知錯誤'));
      }
    } catch (err) {
      console.error('Fetch status error:', err);
      setError('伺服器連線失敗：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 3. Demo 模式模擬掃碼打卡
  const handleDemoScan = () => {
    if (!userData) return;
    const newGrams = (userData.total_saved_grams || 0) + 10;
    const nowIso = new Date().toISOString();
    
    // Demo 模式下儲存至本機
    localStorage.setItem(`last_scan_date_${userId}`, nowIso);
    localStorage.setItem(`total_saved_grams_${userId}`, newGrams.toString());

    setUserData({
      ...userData,
      turtle_status: 2,
      continuous_inactive_days: 0,
      total_saved_grams: newGrams,
      last_scan_date: nowIso,
    });

    const quote = TOXIC_QUOTES[Math.floor(Math.random() * TOXIC_QUOTES.length)];
    setToastMessage(quote);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 5000);
  };

  // 3.5 模擬未打卡天數 (開發測試用)
  const handleSimulateInactivity = (days) => {
    if (!userData) return;
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() - days);
    const targetIso = targetDate.toISOString();
    
    if (isDemoMode) {
      localStorage.setItem(`last_scan_date_${userId}`, targetIso);
    }
    
    const diffTime = Math.abs(new Date() - targetDate);
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    let newStatus = 2;
    if (diffDays >= 7) newStatus = 0;
    else if (diffDays >= 3) newStatus = 1;
    
    setUserData({
      ...userData,
      turtle_status: newStatus,
      continuous_inactive_days: diffDays,
      last_scan_date: targetIso,
    });
    
    setToastMessage(`🔧 已成功模擬未打卡 ${days} 天，海龜狀態已更新！`);
    setToastVisible(true);
    setTimeout(() => setToastVisible(false), 3000);
  };

  // 4. 測試主控台手動載入
  const handleTestLoad = (e) => {
    e.preventDefault();
    if (!customUid.trim()) return;
    setUserId(customUid.trim());
    setProfileName('測試用孿生體');
    fetchUserStatus(customUid.trim());
  };

  // 5. 狀態對應的視覺配置
  const getStatusConfig = (status) => {
    switch (status) {
      case 2:
        return {
          themeClass: 'theme-healthy',
          title: '健康活潑 ✦ 海洋水質清澈',
          shortStatus: '健康',
          emoji: '🐢',
          badgeText: 'HEALTHY',
          healthPercent: 100,
          healthColor: 'linear-gradient(90deg, #0ea5e9, #38bdf8)',
          desc: '海龜目前正在純淨蔚藍的海洋中快樂暢游。多虧你自備環保杯與減塑行動，牠的大腦與器官十分乾淨！請繼續維持你的好習慣。',
        };
      case 1:
        return {
          themeClass: 'theme-sick',
          title: '生病混濁 ✦ 微塑膠侵蝕中',
          shortStatus: '生病',
          emoji: '🤢',
          badgeText: 'SICK',
          healthPercent: 35,
          healthColor: 'linear-gradient(90deg, #64748b, #94a3b8)',
          desc: '警告！你已超過 3 天沒有減塑打卡，海水變得十分混濁。海龜胃部塞著塑膠微粒，大腦神經元正遭受有害塑化劑慢慢吞噬，請盡速掃碼拯救牠！',
        };
      case 0:
      default:
        return {
          themeClass: 'theme-dead',
          title: '不幸死亡 ✦ 殘破微塑膠骨架',
          shortStatus: '死亡',
          emoji: '💀',
          badgeText: 'DEAD',
          healthPercent: 0,
          healthColor: 'linear-gradient(90deg, #f43f5e, #e11d48)',
          desc: '悲劇！因為你整整一週以上對環保冷漠，你的孿生海龜已經死亡，剩下一副冰冷的塑料黑白骨架。牠的肚子塞滿塑膠垃圾...我們地獄見。',
        };
    }
  };

  // 6. 環保影響力換算
  const getImpactStats = (grams) => ({
    cups: Math.floor(grams / 15),      // 1 塑膠杯 ≈ 15g
    bags: Math.floor(grams / 6),       // 1 塑膠袋 ≈ 6g
    straws: Math.floor(grams / 0.5),   // 1 塑膠吸管 ≈ 0.5g
    co2: (grams * 6).toFixed(0),       // 每 1g 塑膠 ≈ 6g CO₂
  });

  // 7. 成就勳章系統
  const getAchievements = (grams) => [
    { icon: '🌱', name: '首次打卡', threshold: 10, unlocked: grams >= 10 },
    { icon: '🐚', name: '減塑新手', threshold: 50, unlocked: grams >= 50 },
    { icon: '🐠', name: '海洋守護者', threshold: 100, unlocked: grams >= 100 },
    { icon: '🐬', name: '減塑達人', threshold: 500, unlocked: grams >= 500 },
    { icon: '🐋', name: '海龜之友', threshold: 1000, unlocked: grams >= 1000 },
  ];

  // 取得當前狀態資料
  const statusVal = userData ? userData.turtle_status : 2;
  const totalGrams = userData ? userData.total_saved_grams : 0;
  const inactiveDays = userData ? userData.continuous_inactive_days : 0;
  const config = getStatusConfig(statusVal);
  const impact = getImpactStats(totalGrams);
  const achievements = getAchievements(totalGrams);

  return (
    <div className={`app ${config.themeClass} ${mounted ? 'mounted' : ''}`}>
      <Head>
        <title>海龜鄙視你 ✦ 厭世生態孿生養成計畫</title>
        <meta name="description" content="商業競賽 MVP 專案 — 用毒舌海龜推動全民減塑的厭世生態孿生養成計畫" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;900&family=Noto+Sans+TC:wght@300;400;500;700;900&display=swap" rel="stylesheet" />
      </Head>

      {/* ==================== 動態海洋背景粒子 ==================== */}
      <div className="ocean-bg" aria-hidden="true">
        {[...Array(12)].map((_, i) => (
          <div key={i} className={`bubble bubble-${i}`} />
        ))}
      </div>

      <main className="main-content">
        {!isLiffReady ? (
          <div className="loading-state">
            <div className="loading-spinner">🌊</div>
            <p className="loading-text">載入海洋孿生世界中...</p>
          </div>
        ) : (isLoggedIn || testMode) ? (
          <>
            {/* ==================== 頂部標頭 ==================== */}
            <header className="app-header">
              <div className="header-logo">🐢</div>
              <div className="header-text">
                <h2 className="header-title">海龜鄙視你</h2>
                <p className="header-subtitle">厭世生態孿生養成計畫</p>
              </div>
              {isDemoMode && <span className="demo-badge">DEMO</span>}
            </header>

            {/* ==================== KPI 統計看板 ==================== */}
            <section className="stats-row" id="stats-dashboard">
              <div className="stat-card">
                <div className="stat-icon-wrapper"><span className="stat-icon">🧴</span></div>
                <div className="stat-value">{totalGrams}</div>
                <div className="stat-label">累計減塑 (g)</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrapper"><span className="stat-icon">📅</span></div>
                <div className="stat-value">{inactiveDays}</div>
                <div className="stat-label">未打卡天數</div>
              </div>
              <div className="stat-card">
                <div className="stat-icon-wrapper"><span className="stat-icon">{config.emoji}</span></div>
                <div className="stat-value">{config.shortStatus}</div>
                <div className="stat-label">海龜狀態</div>
              </div>
            </section>

            {/* ==================== 孿生海龜狀態展示區 ==================== */}
            <section className="turtle-section" id="turtle-avatar">
              <div className="turtle-stage">
                <div className="pulse-ring ring-1" />
                <div className="pulse-ring ring-2" />
                <div className="pulse-ring ring-3" />
                <div className="turtle-avatar">
                  <span className="turtle-emoji">{config.emoji}</span>
                </div>
              </div>
              <div className="status-badge">{config.badgeText}</div>
              <h1 className="status-title">{config.title}</h1>

              {/* 生命值血條 */}
              <div className="health-bar-wrapper">
                <div className="health-bar">
                  <div
                    className="health-fill"
                    style={{ width: `${config.healthPercent}%`, background: config.healthColor }}
                  />
                </div>
                <div className="health-labels">
                  <span className="health-label-hp">HP</span>
                  <span className="health-label-pct">{config.healthPercent}%</span>
                </div>
              </div>
            </section>

            {/* ==================== 故事敘事卡片 ==================== */}
            <section className="narrative-card" id="narrative">
              <p className="narrative-text">{config.desc}</p>
              {userData && (
                <div className="user-meta">
                  <div className="meta-item">
                    <span className="meta-title">連續未打卡</span>
                    <span className="meta-val">{userData.continuous_inactive_days} 天</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-title">上次掃描時間</span>
                    <span className="meta-val">
                      {new Date(userData.last_scan_date).toLocaleDateString('zh-TW', {
                        year: 'numeric', month: 'long', day: 'numeric',
                      })}
                    </span>
                  </div>
                </div>
              )}
            </section>

            {/* ==================== 環保影響力換算 ==================== */}
            <section className="impact-section" id="impact">
              <h3 className="section-title">
                <span className="section-icon">🌊</span>
                你的環保影響力
              </h3>
              <div className="impact-grid">
                <div className="impact-card">
                  <span className="impact-emoji">🥤</span>
                  <span className="impact-number">{impact.cups}</span>
                  <span className="impact-label">免用塑膠杯</span>
                </div>
                <div className="impact-card">
                  <span className="impact-emoji">🛍️</span>
                  <span className="impact-number">{impact.bags}</span>
                  <span className="impact-label">免用塑膠袋</span>
                </div>
                <div className="impact-card">
                  <span className="impact-emoji">🥢</span>
                  <span className="impact-number">{impact.straws}</span>
                  <span className="impact-label">免用塑膠吸管</span>
                </div>
                <div className="impact-card">
                  <span className="impact-emoji">💨</span>
                  <span className="impact-number">{impact.co2}g</span>
                  <span className="impact-label">減少碳排放</span>
                </div>
              </div>
            </section>

            {/* ==================== 成就勳章系統 ==================== */}
            <section className="achievements-section" id="achievements">
              <h3 className="section-title">
                <span className="section-icon">🏆</span>
                成就勳章
              </h3>
              <div className="achievements-row">
                {achievements.map((a, i) => (
                  <div key={i} className={`achievement-item ${a.unlocked ? 'unlocked' : 'locked'}`}>
                    <span className="achievement-icon">{a.icon}</span>
                    <span className="achievement-name">{a.name}</span>
                    <span className="achievement-threshold">{a.threshold}g</span>
                  </div>
                ))}
              </div>
            </section>

            {/* ==================== 快速行動按鈕 ==================== */}
            <section className="actions-section" id="actions">
              {(isDemoMode || testMode) && (
                <button className="action-btn action-scan" id="btn-demo-scan" onClick={handleDemoScan}>
                  <span className="action-btn-icon">📷</span>
                  模擬減塑打卡 (+10g)
                </button>
              )}
              <button
                className="action-btn action-shop"
                id="btn-find-shop"
                onClick={() => {
                  setToastMessage('📍 請在 LINE 聊天室中輸入「#查詢附近店家」即可取得雙北特約店清單！');
                  setToastVisible(true);
                  setTimeout(() => setToastVisible(false), 4000);
                }}
              >
                <span className="action-btn-icon">📍</span>
                查詢特約無塑店家
              </button>
            </section>

            {/* ==================== Toast 通知 ==================== */}
            <div className={`toast ${toastVisible ? 'toast-visible' : ''}`} role="alert">
              <p className="toast-text">{toastMessage}</p>
            </div>

            {/* ==================== 頁尾連線狀態 ==================== */}
            <footer className="footer-info">
              {profileName ? (
                <p className="login-status">
                  已連結 LINE 帳號：<strong>{profileName}</strong>
                </p>
              ) : (
                <p className="login-status">載入中，請稍候...</p>
              )}
              {isDemoMode && (
                <p className="demo-notice">⚠️ 目前為 Demo 展示模式（Supabase 尚未設定）</p>
              )}
            </footer>

            {/* ==================== 開發者 Bypass 測試主控台 ==================== */}
            {testMode && (
              <div className="test-console" id="test-console">
                <h4>⚙️ 開發者 Bypass 測試主控台</h4>
                {error && <p className="error-msg">{error}</p>}
                <form onSubmit={handleTestLoad} className="test-form">
                  <input
                    type="text"
                    value={customUid}
                    onChange={(e) => setCustomUid(e.target.value)}
                    placeholder="輸入測試用 LINE UID"
                    className="test-input"
                    id="input-test-uid"
                  />
                  <button type="submit" className="test-btn" id="btn-test-load" disabled={loading}>
                    {loading ? '載入中...' : '載入狀態'}
                  </button>
                </form>
                <div className="test-tips">
                  提示：點擊「模擬減塑打卡」可即時展示掃碼打卡流程。
                  您也可以到 Supabase 手動修改 <code>turtle_status</code> (2, 1, 0)
                  與 <code>total_saved_grams</code>，重新載入以展示不同狀態。
                  <div style={{ display: 'flex', gap: '8px', marginTop: '12px', flexWrap: 'wrap' }}>
                    <button type="button" className="test-btn" onClick={() => handleSimulateInactivity(3)}>模擬 3 天未打卡 (生病)</button>
                    <button type="button" className="test-btn" onClick={() => handleSimulateInactivity(7)}>模擬 7 天未打卡 (死亡)</button>
                    <button type="button" className="test-btn" onClick={() => handleSimulateInactivity(0)}>重置未打卡 (健康)</button>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          /* ==================== 未登入大廳 ==================== */
          <div className="login-screen">
            <div className="login-logo">🐢</div>
            <h1 className="login-title">海龜鄙視你</h1>
            <p className="login-subtitle">厭世生態孿生養成計畫</p>
            <div className="login-card">
              <p className="login-desc">
                「你今天又製造了多少塑膠垃圾？海龜正在看著你。」
              </p>
              <p className="login-subdesc">
                這是一個連結你的日常減塑與海洋生態的養成計畫。自備環保杯/袋打卡，拯救你的孿生海龜；若冷漠以對，你將見證牠被塑料吞噬的過程。
              </p>
              <button className="login-btn-line" onClick={handleLogin}>
                <span className="btn-line-icon">💬</span>
                LINE 一鍵登入 ✦ 領養孿生海龜
              </button>
            </div>
            <div className="login-footer">
              新北 2026 Impact Star 青年影響力啟動賽 MVP 專案
            </div>
          </div>
        )}
      </main>

      {/* ==================== 完整 CSS 樣式系統 ==================== */}
      <style jsx global>{`
        /* ===== 全域基礎 ===== */
        * { box-sizing: border-box; margin: 0; padding: 0; }

        /* ===== 載入與登入大廳樣式 ===== */
        .loading-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 100px 0;
          gap: 16px;
        }
        .loading-spinner {
          font-size: 3rem;
          animation: turtle-float 2.5s ease-in-out infinite;
        }
        .loading-text {
          font-size: 0.88rem;
          color: #94a3b8;
          letter-spacing: 1px;
        }

        .login-screen {
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 20px 8px;
          animation: fadeIn 0.8s ease;
        }
        .login-logo {
          font-size: 4.5rem;
          margin-bottom: 8px;
          animation: turtle-float 4s ease-in-out infinite;
        }
        .login-title {
          font-family: 'Noto Sans TC', sans-serif;
          font-size: 1.8rem;
          font-weight: 900;
          color: #f8fafc;
          letter-spacing: 2px;
          text-shadow: 0 0 20px rgba(14,165,233,0.3);
        }
        .login-subtitle {
          font-size: 0.72rem;
          color: #475569;
          letter-spacing: 4px;
          text-transform: uppercase;
          margin-top: 4px;
          margin-bottom: 28px;
        }
        .login-card {
          background: rgba(15, 23, 42, 0.45);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 30px 22px;
          backdrop-filter: blur(20px);
          max-width: 380px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .login-desc {
          font-size: 0.95rem;
          font-weight: 700;
          color: #38bdf8;
          line-height: 1.5;
        }
        .login-subdesc {
          font-size: 0.76rem;
          color: #94a3b8;
          line-height: 1.6;
          text-align: justify;
        }
        .login-btn-line {
          width: 100%;
          padding: 14px 20px;
          background: #06c755;
          color: #ffffff;
          border: none;
          border-radius: 14px;
          font-family: 'Noto Sans TC', sans-serif;
          font-size: 0.88rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          box-shadow: 0 4px 20px rgba(6,199,85,0.25);
          transition: all 0.3s ease;
          margin-top: 8px;
        }
        .login-btn-line:hover {
          background: #05b04b;
          transform: translateY(-2px);
          box-shadow: 0 6px 24px rgba(6,199,85,0.4);
        }
        .login-btn-line:active {
          transform: translateY(0);
        }
        .btn-line-icon {
          font-size: 1.1rem;
        }
        .login-footer {
          margin-top: 40px;
          font-size: 0.62rem;
          color: #4b5563;
          letter-spacing: 1px;
        }
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
          font-family: 'Noto Sans TC', 'Montserrat', sans-serif;
          background: #050b14;
          color: #f8fafc;
          min-height: 100vh;
          overflow-x: hidden;
          -webkit-font-smoothing: antialiased;
        }

        /* ===== App 容器與主題 ===== */
        .app {
          min-height: 100vh;
          width: 100%;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 32px 16px 48px;
          transition: background 1.5s ease;
          opacity: 0;
          transform: translateY(10px);
        }
        .app.mounted {
          opacity: 1;
          transform: translateY(0);
          transition: opacity 0.8s ease, transform 0.8s ease, background 1.5s ease;
        }

        /* --- 健康主題 (2): 深海蔚藍 --- */
        .theme-healthy {
          background: radial-gradient(ellipse at 50% 20%, #0c2d4a 0%, #060e1a 70%, #020609 100%);
        }
        .theme-healthy .turtle-avatar {
          background: radial-gradient(circle, #0284c7, #0369a1);
          box-shadow: 0 0 50px rgba(14, 165, 233, 0.5), 0 0 100px rgba(14, 165, 233, 0.15);
          border: 2px solid rgba(14, 165, 233, 0.4);
        }
        .theme-healthy .status-badge { background: rgba(14,165,233,0.12); border-color: rgba(14,165,233,0.35); color: #38bdf8; }
        .theme-healthy .status-title { color: #38bdf8; text-shadow: 0 0 20px rgba(14,165,233,0.25); }
        .theme-healthy .pulse-ring { border-color: rgba(14,165,233,0.25); }
        .theme-healthy .stat-card { border-color: rgba(14,165,233,0.1); }

        /* --- 生病主題 (1): 灰暗渾濁 --- */
        .theme-sick {
          background: radial-gradient(ellipse at 50% 20%, #2d3748 0%, #171923 70%, #0a0c10 100%);
        }
        .theme-sick .turtle-avatar {
          background: radial-gradient(circle, #64748b, #475569);
          box-shadow: 0 0 50px rgba(148,163,184,0.3), 0 0 100px rgba(148,163,184,0.08);
          border: 2px solid rgba(148,163,184,0.3);
        }
        .theme-sick .status-badge { background: rgba(148,163,184,0.1); border-color: rgba(148,163,184,0.25); color: #cbd5e1; }
        .theme-sick .status-title { color: #cbd5e1; text-shadow: 0 0 15px rgba(148,163,184,0.2); }
        .theme-sick .pulse-ring { border-color: rgba(148,163,184,0.12); }
        .theme-sick .stat-card { border-color: rgba(148,163,184,0.08); }

        /* --- 死亡主題 (0): 幽冥黑紅 --- */
        .theme-dead {
          background: radial-gradient(ellipse at 50% 20%, #1c0d12 0%, #0a0507 70%, #000 100%);
        }
        .theme-dead .turtle-avatar {
          background: radial-gradient(circle, #1e1e1e, #09090b);
          box-shadow: 0 0 50px rgba(244,63,94,0.35), 0 0 100px rgba(244,63,94,0.1);
          border: 2px solid rgba(244,63,94,0.35);
        }
        .theme-dead .status-badge {
          background: rgba(244,63,94,0.1); border-color: rgba(244,63,94,0.35); color: #f43f5e;
          animation: blink 2s ease-in-out infinite;
        }
        .theme-dead .status-title { color: #f43f5e; text-shadow: 0 0 20px rgba(244,63,94,0.3); }
        .theme-dead .pulse-ring { border-color: rgba(244,63,94,0.15); }
        .theme-dead .stat-card { border-color: rgba(244,63,94,0.08); }
        .theme-dead .turtle-emoji { filter: grayscale(1); }

        /* ===== 海洋背景動畫 ===== */
        .ocean-bg {
          position: fixed;
          inset: 0;
          pointer-events: none;
          overflow: hidden;
          z-index: 0;
        }
        .bubble {
          position: absolute;
          bottom: -30px;
          border-radius: 50%;
          background: radial-gradient(circle at 30% 30%, rgba(255,255,255,0.08), rgba(255,255,255,0.02));
          animation: bubble-float linear infinite;
        }
        .bubble-0  { left: 5%;  width: 8px;  height: 8px;  animation-duration: 12s; animation-delay: 0s; }
        .bubble-1  { left: 15%; width: 14px; height: 14px; animation-duration: 9s;  animation-delay: 1s; }
        .bubble-2  { left: 25%; width: 6px;  height: 6px;  animation-duration: 14s; animation-delay: 3s; }
        .bubble-3  { left: 35%; width: 18px; height: 18px; animation-duration: 11s; animation-delay: 0.5s; }
        .bubble-4  { left: 48%; width: 10px; height: 10px; animation-duration: 13s; animation-delay: 2s; }
        .bubble-5  { left: 58%; width: 7px;  height: 7px;  animation-duration: 10s; animation-delay: 4s; }
        .bubble-6  { left: 68%; width: 16px; height: 16px; animation-duration: 12s; animation-delay: 1.5s; }
        .bubble-7  { left: 78%; width: 9px;  height: 9px;  animation-duration: 15s; animation-delay: 0s; }
        .bubble-8  { left: 85%; width: 12px; height: 12px; animation-duration: 10s; animation-delay: 3.5s; }
        .bubble-9  { left: 92%; width: 5px;  height: 5px;  animation-duration: 11s; animation-delay: 2.5s; }
        .bubble-10 { left: 42%; width: 20px; height: 20px; animation-duration: 16s; animation-delay: 5s; }
        .bubble-11 { left: 72%; width: 4px;  height: 4px;  animation-duration: 8s;  animation-delay: 1s; }

        /* ===== 主內容區 ===== */
        .main-content {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
        }

        /* ===== 頂部標頭 ===== */
        .app-header {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 12px;
          padding-bottom: 8px;
          border-bottom: 1px solid rgba(255,255,255,0.04);
        }
        .header-logo {
          font-size: 2rem;
          line-height: 1;
          animation: turtle-float 3s ease-in-out infinite;
        }
        .header-text { flex: 1; }
        .header-title {
          font-family: 'Montserrat', sans-serif;
          font-size: 1.1rem;
          font-weight: 900;
          letter-spacing: 1px;
          color: #f1f5f9;
        }
        .header-subtitle {
          font-size: 0.68rem;
          color: #475569;
          letter-spacing: 2px;
          margin-top: 2px;
        }
        .demo-badge {
          font-family: 'Montserrat', sans-serif;
          font-size: 0.55rem;
          font-weight: 900;
          letter-spacing: 2px;
          padding: 3px 8px;
          border-radius: 4px;
          background: rgba(251,191,36,0.15);
          border: 1px solid rgba(251,191,36,0.3);
          color: #fbbf24;
        }

        /* ===== KPI 統計看板 ===== */
        .stats-row {
          width: 100%;
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
        }
        .stat-card {
          background: rgba(15,23,42,0.45);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 14px;
          padding: 16px 10px 14px;
          text-align: center;
          backdrop-filter: blur(12px);
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 6px;
          transition: border-color 0.3s, transform 0.3s;
        }
        .stat-card:hover { transform: translateY(-2px); }
        .stat-icon-wrapper { font-size: 1.3rem; line-height: 1; }
        .stat-value {
          font-family: 'Montserrat', sans-serif;
          font-size: 1.6rem;
          font-weight: 900;
          color: #f8fafc;
          line-height: 1;
        }
        .stat-label {
          font-size: 0.62rem;
          color: #64748b;
          letter-spacing: 0.5px;
          font-weight: 500;
        }

        /* ===== 海龜展示區 ===== */
        .turtle-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 14px;
          padding: 12px 0;
        }
        .turtle-stage {
          position: relative;
          width: 180px;
          height: 180px;
          display: grid;
          place-items: center;
        }
        .turtle-avatar {
          width: 120px;
          height: 120px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          z-index: 10;
          transition: background 1s ease, box-shadow 1s ease;
        }
        .turtle-emoji {
          font-size: 4rem;
          user-select: none;
          animation: turtle-float 3s ease-in-out infinite;
          transition: filter 1s ease;
        }

        .pulse-ring {
          position: absolute;
          border-radius: 50%;
          border: 1px solid;
          opacity: 0;
          transition: border-color 1s ease;
        }
        .ring-1 { width: 100%; height: 100%; animation: ripple-pulse 4s linear infinite; }
        .ring-2 { width: 100%; height: 100%; animation: ripple-pulse 4s linear 1.3s infinite; }
        .ring-3 { width: 100%; height: 100%; animation: ripple-pulse 4s linear 2.6s infinite; }

        .status-badge {
          font-family: 'Montserrat', sans-serif;
          font-size: 0.6rem;
          font-weight: 900;
          letter-spacing: 2.5px;
          padding: 4px 14px;
          border-radius: 20px;
          border: 1px solid;
          transition: all 0.5s ease;
        }
        .status-title {
          font-size: 1.1rem;
          font-weight: 700;
          letter-spacing: 1px;
          text-align: center;
          transition: color 1s ease, text-shadow 1s ease;
        }

        /* 生命值血條 */
        .health-bar-wrapper { width: 100%; max-width: 280px; }
        .health-bar {
          width: 100%;
          height: 6px;
          background: rgba(255,255,255,0.06);
          border-radius: 3px;
          overflow: hidden;
        }
        .health-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 1.5s cubic-bezier(0.4, 0, 0.2, 1);
          box-shadow: 0 0 8px rgba(255,255,255,0.1);
        }
        .health-labels {
          display: flex;
          justify-content: space-between;
          margin-top: 5px;
        }
        .health-label-hp, .health-label-pct {
          font-family: 'Montserrat', sans-serif;
          font-size: 0.58rem;
          font-weight: 700;
          color: #475569;
          letter-spacing: 1px;
        }

        /* ===== 故事敘事卡片 ===== */
        .narrative-card {
          width: 100%;
          background: rgba(15,23,42,0.3);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 16px;
          padding: 22px;
          backdrop-filter: blur(12px);
        }
        .narrative-text {
          font-size: 0.85rem;
          line-height: 1.85;
          color: #94a3b8;
          text-align: justify;
          margin-bottom: 18px;
        }
        .user-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          border-top: 1px solid rgba(255,255,255,0.04);
          padding-top: 16px;
        }
        .meta-item { display: flex; flex-direction: column; gap: 3px; }
        .meta-title { font-size: 0.65rem; color: #475569; letter-spacing: 0.5px; }
        .meta-val { font-size: 0.82rem; font-weight: 700; color: #cbd5e1; }

        /* ===== 環保影響力 ===== */
        .impact-section, .achievements-section {
          width: 100%;
          background: rgba(15,23,42,0.25);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 16px;
          padding: 20px;
          backdrop-filter: blur(8px);
        }
        .section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 0.88rem;
          font-weight: 700;
          color: #e2e8f0;
          margin-bottom: 16px;
          letter-spacing: 0.5px;
        }
        .section-icon { font-size: 1.1rem; }
        .impact-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 10px;
        }
        .impact-card {
          background: rgba(15,23,42,0.4);
          border: 1px solid rgba(255,255,255,0.04);
          border-radius: 12px;
          padding: 14px 10px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          transition: transform 0.3s, border-color 0.3s;
        }
        .impact-card:hover { transform: translateY(-2px); border-color: rgba(255,255,255,0.1); }
        .impact-emoji { font-size: 1.5rem; }
        .impact-number {
          font-family: 'Montserrat', sans-serif;
          font-size: 1.4rem;
          font-weight: 900;
          color: #f8fafc;
          line-height: 1.1;
        }
        .impact-label { font-size: 0.62rem; color: #64748b; text-align: center; }

        /* ===== 成就勳章 ===== */
        .achievements-row {
          display: flex;
          gap: 8px;
          overflow-x: auto;
          padding-bottom: 4px;
          scrollbar-width: none;
        }
        .achievements-row::-webkit-scrollbar { display: none; }
        .achievement-item {
          flex-shrink: 0;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 12px 14px 10px;
          border-radius: 12px;
          background: rgba(15,23,42,0.4);
          border: 1px solid rgba(255,255,255,0.04);
          min-width: 72px;
          transition: all 0.3s;
        }
        .achievement-item.locked {
          opacity: 0.35;
          filter: grayscale(1);
        }
        .achievement-item.unlocked {
          border-color: rgba(251,191,36,0.25);
          background: rgba(251,191,36,0.05);
        }
        .achievement-item.unlocked:hover { transform: scale(1.05); }
        .achievement-icon { font-size: 1.4rem; }
        .achievement-name { font-size: 0.55rem; color: #94a3b8; font-weight: 600; white-space: nowrap; }
        .achievement-threshold {
          font-family: 'Montserrat', sans-serif;
          font-size: 0.48rem;
          color: #475569;
          font-weight: 700;
        }

        /* ===== 快速行動按鈕 ===== */
        .actions-section {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .action-btn {
          width: 100%;
          padding: 14px 20px;
          border-radius: 14px;
          border: none;
          font-family: 'Noto Sans TC', sans-serif;
          font-size: 0.88rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.3s ease;
          letter-spacing: 0.5px;
        }
        .action-btn-icon { font-size: 1.1rem; }
        .action-scan {
          background: linear-gradient(135deg, #0ea5e9, #06b6d4);
          color: #fff;
          box-shadow: 0 4px 20px rgba(14,165,233,0.3);
        }
        .action-scan:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 28px rgba(14,165,233,0.45);
        }
        .action-scan:active { transform: translateY(0); }
        .action-shop {
          background: rgba(15,23,42,0.5);
          color: #e2e8f0;
          border: 1px solid rgba(255,255,255,0.08);
          backdrop-filter: blur(8px);
        }
        .action-shop:hover {
          background: rgba(15,23,42,0.7);
          border-color: rgba(255,255,255,0.15);
          transform: translateY(-2px);
        }

        /* ===== Toast 通知 ===== */
        .toast {
          position: fixed;
          bottom: -200px;
          left: 50%;
          transform: translateX(-50%);
          width: calc(100% - 32px);
          max-width: 420px;
          background: rgba(15,23,42,0.95);
          border: 1px solid rgba(14,165,233,0.2);
          border-radius: 16px;
          padding: 16px 20px;
          backdrop-filter: blur(20px);
          box-shadow: 0 12px 40px rgba(0,0,0,0.5);
          z-index: 1000;
          transition: bottom 0.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .toast-visible { bottom: 24px; }
        .toast-text {
          font-size: 0.8rem;
          line-height: 1.7;
          color: #cbd5e1;
        }

        /* ===== 頁尾 ===== */
        .footer-info { text-align: center; padding: 8px 0; }
        .login-status { font-size: 0.72rem; color: #475569; }
        .login-status strong { color: #64748b; }
        .demo-notice {
          font-size: 0.62rem;
          color: #fbbf24;
          margin-top: 6px;
          opacity: 0.7;
        }

        /* ===== 測試控制台 ===== */
        .test-console {
          width: 100%;
          background: rgba(9,13,22,0.8);
          border: 1px dashed rgba(244,63,94,0.3);
          border-radius: 14px;
          padding: 18px;
          backdrop-filter: blur(8px);
        }
        .test-console h4 {
          font-size: 0.75rem;
          color: #cbd5e1;
          margin-bottom: 10px;
          letter-spacing: 0.5px;
        }
        .error-msg {
          font-size: 0.68rem;
          color: #fbbf24;
          margin-bottom: 10px;
          background: rgba(251,191,36,0.05);
          padding: 8px 10px;
          border-radius: 6px;
          border: 1px solid rgba(251,191,36,0.15);
          line-height: 1.5;
        }
        .test-form { display: flex; gap: 8px; margin-bottom: 10px; }
        .test-input {
          flex: 1;
          background: #111827;
          border: 1px solid #1f2937;
          border-radius: 8px;
          color: #e2e8f0;
          padding: 9px 12px;
          font-size: 0.75rem;
          font-family: 'Montserrat', monospace;
          transition: border-color 0.3s;
        }
        .test-input:focus { outline: none; border-color: #374151; }
        .test-btn {
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 8px;
          color: #f3f4f6;
          padding: 9px 16px;
          font-size: 0.75rem;
          cursor: pointer;
          font-weight: 600;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .test-btn:hover { background: #374151; }
        .test-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .test-tips {
          font-size: 0.62rem;
          color: #4b5563;
          line-height: 1.6;
        }
        .test-tips code {
          background: rgba(255,255,255,0.05);
          padding: 1px 4px;
          border-radius: 3px;
          font-size: 0.6rem;
          color: #94a3b8;
        }

        /* ===== Keyframe 動畫 ===== */
        @keyframes ripple-pulse {
          0% { transform: scale(0.65); opacity: 0.6; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        @keyframes turtle-float {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes bubble-float {
          0% { transform: translateY(0) scale(1); opacity: 0; }
          10% { opacity: 0.6; }
          90% { opacity: 0.3; }
          100% { transform: translateY(-100vh) scale(0.4); opacity: 0; }
        }

        /* ===== 響應式調整 ===== */
        @media (max-width: 380px) {
          .stat-value { font-size: 1.3rem; }
          .impact-grid { grid-template-columns: repeat(2, 1fr); gap: 8px; }
          .impact-number { font-size: 1.1rem; }
          .achievement-item { min-width: 64px; padding: 10px 10px 8px; }
        }
      `}</style>
    </div>
  );
}
