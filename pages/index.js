import { useState, useEffect } from 'react';
import Head from 'next/head';

// 測試用預設管理者 ID
const ADMIN_TEST_UID = 'U735e28c5b4fd267ab0e92c9890d4f232';

export default function Home() {
  const [liffObject, setLiffObject] = useState(null);
  const [userId, setUserId] = useState('');
  const [profileName, setProfileName] = useState('');
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [testMode, setTestMode] = useState(false);
  const [customUid, setCustomUid] = useState(ADMIN_TEST_UID);

  // 1. 初始化 LIFF SDK (僅在瀏覽器端執行)
  useEffect(() => {
    const initLiff = async () => {
      try {
        const liff = (await import('@line/liff')).default;
        // 使用提供或設定好的 LIFF ID，若無則提供預設
        const liffId = process.env.NEXT_PUBLIC_LIFF_ID || '2010431955-placeholder';
        
        await liff.init({ liffId });
        setLiffObject(liff);

        if (liff.isLoggedIn()) {
          const profile = await liff.getProfile();
          setUserId(profile.userId);
          setProfileName(profile.displayName || 'LINE 守護者');
          fetchUserStatus(profile.userId);
        } else {
          // 在 LINE 瀏覽器中會自動登入，若是外部瀏覽器則引導登入
          liff.login();
        }
      } catch (err) {
        console.error('LIFF initialization failed:', err);
        // 如果是本機開發或未設定 LIFF_ID，自動開啟測試 Bypass 模式以便進行商業簡報展示
        setTestMode(true);
        setError('LIFF 初始化失敗（本機測試或未部署 LINE 環境）。已自動開啟「開發測試模式」。');
        // 預設加載管理員測試 ID
        fetchUserStatus(ADMIN_TEST_UID);
      }
    };

    initLiff();
  }, []);

  // 2. 呼叫 API 查詢 Supabase 使用者狀態
  const fetchUserStatus = async (uid) => {
    if (!uid) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/user-status?userId=${encodeURIComponent(uid)}`);
      const result = await res.json();
      if (result.success) {
        setUserData(result.data);
      } else {
        setError('取得資料庫資料失敗：' + result.error);
      }
    } catch (err) {
      console.error('Fetch status error:', err);
      setError('連線伺服器失敗：' + err.message);
    } finally {
      setLoading(false);
    }
  };

  // 處理手動測試 ID 輸入
  const handleTestLoad = (e) => {
    e.preventDefault();
    if (!customUid.trim()) return;
    setUserId(customUid.trim());
    setProfileName('測試用孿生體');
    fetchUserStatus(customUid.trim());
  };

  // 判定狀態對應的 CSS 樣式與視覺包裝
  const getStatusConfig = (status) => {
    switch (status) {
      case 2: // 健康
        return {
          themeClass: 'theme-healthy',
          title: '健康活潑 ✦ 海洋水質清澈',
          emoji: '🐢',
          badgeText: 'HEALTHY',
          color: '#38bdf8',
          desc: '海龜目前正在純淨蔚藍的海洋中快樂暢游。多虧你自備環保杯與減塑行動，牠的大腦與器官十分乾淨！請繼續維持你的好習慣。',
        };
      case 1: // 生病混濁
        return {
          themeClass: 'theme-sick',
          title: '生病混濁 ✦ 微塑膠侵蝕中',
          emoji: '🤢',
          badgeText: 'SICK',
          color: '#e2e8f0',
          desc: '警告！你已超過 3 天沒有減塑打卡，海水變得十分混濁。海龜胃部塞著塑膠微粒，大腦神經元正遭受有害塑化劑慢慢吞噬，請盡速掃碼拯救牠！',
        };
      case 0: // 死亡
      default:
        return {
          themeClass: 'theme-dead',
          title: '不幸死亡 ✦ 殘破微塑膠骨架',
          emoji: '💀',
          badgeText: 'DEAD',
          color: '#f43f5e',
          desc: '悲劇！因為你整整一週以上對環保冷漠，你的孿生海龜已經死亡，剩下一副冰冷的塑料黑白骨架。牠的肚子塞滿塑膠垃圾...我們地獄見。',
        };
    }
  };

  // 取得當前海龜狀態配置
  const statusVal = userData ? userData.turtle_status : 2;
  const config = getStatusConfig(statusVal);

  return (
    <div className={`container ${config.themeClass}`}>
      <Head>
        <title>海龜鄙視你 ✦ 厭世生態孿生養成計畫</title>
        <meta name="description" content="商業競賽 MVP 專案 - 厭世生態孿生養成計畫" />
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
        <link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;700;900&family=Noto+Sans+TC:wght@300;500;700;900&display=swap" rel="stylesheet" />
      </Head>

      <main className="main-content">
        {/* 上方累積減塑看板 */}
        <header className="kpi-card">
          <div className="kpi-label">TOTAL PLASTIC SAVED</div>
          <div className="kpi-value">
            {userData ? userData.total_saved_grams : 0} <span className="kpi-unit">g</span>
          </div>
          <p className="kpi-subtext">感謝你對地球與海洋海龜的微薄貢獻</p>
        </header>

        {/* 孿生海龜狀態展示區 */}
        <section className="avatar-section">
          <div className="pulse-container">
            <div className="pulse-ring ring-1"></div>
            <div className="pulse-ring ring-2"></div>
            <div className="avatar-circle">
              <span className="turtle-emoji">{config.emoji}</span>
            </div>
          </div>
          <div className="status-badge">{config.badgeText}</div>
          <h1 className="status-title">{config.title}</h1>
        </section>

        {/* 說明故事卡片 */}
        <section className="narrative-card">
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
                  {new Date(userData.last_scan_date).toLocaleDateString('zh-TW')}
                </span>
              </div>
            </div>
          )}
        </section>

        {/* 使用者狀態與登入顯示 */}
        <footer className="footer-info">
          {profileName ? (
            <p className="login-status">
              已連結 LINE 帳號：<strong>{profileName}</strong>
            </p>
          ) : (
            <p className="login-status">載入中，請稍候...</p>
          )}
        </footer>

        {/* 測試 bypass 主控台 - 供現場 Pitch 與 Demo 測試 */}
        {testMode && (
          <div className="test-console">
            <h4>⚙️ 開發者 Bypass 測試主控台</h4>
            {error && <p className="error-msg">{error}</p>}
            <form onSubmit={handleTestLoad} className="test-form">
              <input
                type="text"
                value={customUid}
                onChange={(e) => setCustomUid(e.target.value)}
                placeholder="輸入測試用 LINE UID"
                className="test-input"
              />
              <button type="submit" className="test-btn" disabled={loading}>
                {loading ? '載入中...' : '載入狀態'}
              </button>
            </form>
            <div className="test-tips">
              提示：您可以到 Supabase 手動修改該 Uid 的 <code>turtle_status</code> (2, 1, 0)
              與 <code>total_saved_grams</code>，然後再次點擊載入，以展示不同的海龜生死孿生畫面。
            </div>
          </div>
        )}
      </main>

      {/* 精緻的 Vanilla CSS 樣式系統 */}
      <style jsx global>{`
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: 'Noto Sans TC', 'Montserrat', sans-serif;
          background: #050b14;
          color: #f8fafc;
          min-height: 100vh;
          overflow-x: hidden;
        }

        .container {
          min-height: 100vh;
          width: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 40px 20px;
          transition: background 1.5s ease;
        }

        /* 2=健康：深海蔚藍風 */
        .theme-healthy {
          background: radial-gradient(circle at center, #0f2b48 0%, #050e18 100%);
        }
        .theme-healthy .avatar-circle {
          background: radial-gradient(circle, #0284c7 0%, #0369a1 100%);
          box-shadow: 0 0 40px rgba(14, 165, 233, 0.5);
          border: 2px solid rgba(14, 165, 233, 0.4);
        }
        .theme-healthy .status-badge {
          background: rgba(14, 165, 233, 0.15);
          border: 1px solid rgba(14, 165, 233, 0.4);
          color: #38bdf8;
        }
        .theme-healthy .status-title {
          color: #38bdf8;
          text-shadow: 0 0 10px rgba(14, 165, 233, 0.3);
        }
        .theme-healthy .ring-1, .theme-healthy .ring-2 {
          border-color: rgba(14, 165, 233, 0.2);
        }

        /* 1=生病：灰暗渾濁風 */
        .theme-sick {
          background: radial-gradient(circle at center, #2d3748 0%, #171923 100%);
        }
        .theme-sick .avatar-circle {
          background: radial-gradient(circle, #64748b 0%, #475569 100%);
          box-shadow: 0 0 40px rgba(148, 163, 184, 0.3);
          border: 2px solid rgba(148, 163, 184, 0.3);
        }
        .theme-sick .status-badge {
          background: rgba(148, 163, 184, 0.1);
          border: 1px solid rgba(148, 163, 184, 0.3);
          color: #cbd5e1;
        }
        .theme-sick .status-title {
          color: #cbd5e1;
          text-shadow: 0 0 10px rgba(148, 163, 184, 0.2);
        }
        .theme-sick .ring-1, .theme-sick .ring-2 {
          border-color: rgba(148, 163, 184, 0.1);
        }

        /* 0=死亡：幽冥黑白風 */
        .theme-dead {
          background: radial-gradient(circle at center, #1c0d12 0%, #000000 100%);
        }
        .theme-dead .avatar-circle {
          background: radial-gradient(circle, #1e1e1e 0%, #09090b 100%);
          box-shadow: 0 0 45px rgba(244, 63, 94, 0.3);
          border: 2px solid rgba(244, 63, 94, 0.3);
        }
        .theme-dead .status-badge {
          background: rgba(244, 63, 94, 0.1);
          border: 1px solid rgba(244, 63, 94, 0.4);
          color: #f43f5e;
          animation: blink 2s infinite ease-in-out;
        }
        .theme-dead .status-title {
          color: #f43f5e;
          text-shadow: 0 0 12px rgba(244, 63, 94, 0.4);
        }
        .theme-dead .ring-1, .theme-dead .ring-2 {
          border-color: rgba(244, 63, 94, 0.15);
        }

        .main-content {
          width: 100%;
          max-width: 480px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 32px;
        }

        /* KPI 看板 */
        .kpi-card {
          width: 100%;
          background: rgba(15, 23, 42, 0.4);
          border: 1px solid rgba(242, 235, 217, 0.08);
          border-radius: 16px;
          padding: 24px;
          text-align: center;
          backdrop-filter: blur(10px);
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
        }

        .kpi-label {
          font-family: 'Montserrat', sans-serif;
          font-size: 0.72rem;
          letter-spacing: 3px;
          color: #64748b;
          font-weight: 700;
          margin-bottom: 8px;
        }

        .kpi-value {
          font-family: 'Montserrat', sans-serif;
          font-size: 3rem;
          font-weight: 900;
          color: #f8fafc;
          line-height: 1;
        }

        .kpi-unit {
          font-size: 1.2rem;
          color: #64748b;
          font-weight: 400;
          margin-left: 4px;
        }

        .kpi-subtext {
          font-size: 0.75rem;
          color: #475569;
          margin-top: 10px;
        }

        /* 脈衝動畫海域 */
        .avatar-section {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
          margin: 16px 0;
        }

        .pulse-container {
          position: relative;
          width: 170px;
          height: 170px;
          display: grid;
          place-items: center;
        }

        .avatar-circle {
          width: 130px;
          height: 130px;
          border-radius: 50%;
          display: grid;
          place-items: center;
          z-index: 10;
        }

        .turtle-emoji {
          font-size: 4.5rem;
          user-select: none;
        }

        .pulse-ring {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 1px solid;
          opacity: 0;
        }

        .ring-1 {
          animation: ripple-pulse 4s infinite linear;
        }

        .ring-2 {
          animation: ripple-pulse 4s infinite linear;
          animation-delay: 2s;
        }

        .status-badge {
          font-family: 'Montserrat', sans-serif;
          font-size: 0.65rem;
          font-weight: 900;
          letter-spacing: 2px;
          padding: 4px 12px;
          border-radius: 20px;
        }

        .status-title {
          font-size: 1.15rem;
          font-weight: 700;
          letter-spacing: 1px;
          text-align: center;
        }

        /* 故事敘事卡片 */
        .narrative-card {
          width: 100%;
          background: rgba(15, 23, 42, 0.25);
          border: 1px solid rgba(242, 235, 217, 0.05);
          border-radius: 16px;
          padding: 24px;
          backdrop-filter: blur(10px);
        }

        .narrative-text {
          font-size: 0.88rem;
          line-height: 1.8;
          color: #94a3b8;
          text-align: justify;
          margin-bottom: 20px;
        }

        .user-meta {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 20px;
        }

        .meta-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .meta-title {
          font-size: 0.7rem;
          color: #475569;
          letter-spacing: 1px;
        }

        .meta-val {
          font-size: 0.85rem;
          font-weight: 700;
          color: #cbd5e1;
        }

        /* 頁尾資訊 */
        .footer-info {
          text-align: center;
          margin-bottom: 20px;
        }

        .login-status {
          font-size: 0.78rem;
          color: #475569;
        }

        .login-status strong {
          color: #64748b;
        }

        /* 測試控制台 */
        .test-console {
          width: 100%;
          background: #090d16;
          border: 1px dashed rgba(244, 63, 94, 0.4);
          border-radius: 12px;
          padding: 20px;
          margin-top: 20px;
        }

        .test-console h4 {
          font-size: 0.8rem;
          color: #cbd5e1;
          margin-bottom: 12px;
          letter-spacing: 1px;
        }

        .error-msg {
          font-size: 0.72rem;
          color: #f43f5e;
          margin-bottom: 12px;
          background: rgba(244, 63, 94, 0.05);
          padding: 6px;
          border-radius: 4px;
        }

        .test-form {
          display: flex;
          gap: 8px;
          margin-bottom: 12px;
        }

        .test-input {
          flex: 1;
          background: #111827;
          border: 1px solid #374151;
          border-radius: 6px;
          color: #fff;
          padding: 8px 12px;
          font-size: 0.8rem;
        }

        .test-btn {
          background: #1f2937;
          border: 1px solid #374151;
          border-radius: 6px;
          color: #f3f4f6;
          padding: 8px 16px;
          font-size: 0.8rem;
          cursor: pointer;
          font-weight: 600;
          transition: background 0.2s;
        }

        .test-btn:hover {
          background: #374151;
        }

        .test-tips {
          font-size: 0.68rem;
          color: #4b5563;
          line-height: 1.5;
        }

        /* Keyframe 動態波浪與閃爍 */
        @keyframes ripple-pulse {
          0% {
            transform: scale(0.7);
            opacity: 0.7;
          }
          100% {
            transform: scale(1.4);
            opacity: 0;
          }
        }

        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
