// --- Symbiosis Impact Sea 2.0 - Core Engine ---

gsap.registerPlugin(MotionPathPlugin);

const state = {
  coasts: [
    { id:'kl1', name:'基隆嶼海域', tag:'北部海域', cityRoute:'城市排水孔 → 基隆河 → 淡水河口 → 基隆嶼', trivia:'龍蝦與黑鳶的家，也是台北人的後花園。', img:'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=1200' },
    { id:'td1', name:'台東三仙台', tag:'東部海域', cityRoute:'部落排水口 → 卑南溪 → 太平洋 → 三仙台', trivia:'擁有台灣最美的八拱橋，是第一道曙光照耀之地。', img:'https://images.unsplash.com/photo-1509233725247-49e657c25aa0?auto=format&fit=crop&q=80&w=1200' },
    { id:'ph1', name:'澎湖七美', tag:'離島海域', cityRoute:'城市水溝 → 台灣海峽 → 澎湖群島 → 七美', trivia:'雙心石滬的古老智慧，需要我們這一代繼續傳承。', img:'https://images.unsplash.com/photo-1468413253725-0d5181091126?auto=format&fit=crop&q=80&w=1200' },
    { id:'hl1', name:'花蓮七星潭', tag:'東部海域', cityRoute:'美崙溪 → 太平洋 → 七星潭月牙灣', trivia:'湛藍的礫石海灘，是東台灣最純淨的呼吸。', img:'https://images.unsplash.com/photo-1505118380757-91f5f45d8de4?auto=format&fit=crop&q=80&w=1200' },
    { id:'kt1', name:'墾丁後壁湖', tag:'南部海域', cityRoute:'恆春水溝 → 巴士海峽 → 後壁湖珊瑚礁', trivia:'台灣最具代表性的珊瑚礁棲息地，潛水者的天堂。', img:'https://images.unsplash.com/photo-1544551763-46a013bb70d5?auto=format&fit=crop&q=80&w=1200' },
    { id:'yl1', name:'宜蘭龜山島', tag:'東北部海域', cityRoute:'蘭陽溪 → 宜蘭外海 → 龜山島海域', trivia:'台灣最活躍的海底溫泉，牛奶海的秘境所在。', img:'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&q=80&w=1200' },
    { id:'tp1', name:'新北野柳', tag:'北部海域', cityRoute:'北海岸排水 → 金山外海 → 野柳地質公園', trivia:'女王頭的故鄉，千萬年地質奇觀的見證。', img:'https://images.unsplash.com/photo-1498623116890-37e912163d5d?auto=format&fit=crop&q=80&w=1200' },
    { id:'km1', name:'金門海域', tag:'離島海域', cityRoute:'城市水道 → 廈門灣 → 金門南海岸', trivia:'鱟的故鄉，活化石與戰地遺跡共存的獨特海岸。', img:'https://images.unsplash.com/photo-1476673160081-cf065607f449?auto=format&fit=crop&q=80&w=1200' }
  ],
  shops: [
    { id:'s1', coastId:'kl1', name:'小島咖啡', type:'友善咖啡店', note:'自備杯折 10 元' },
    { id:'s2', coastId:'td1', name:'成功民宿', type:'綠色旅宿', note:'續住不更換備品折扣' },
    { id:'s3', coastId:'ph1', name:'七美舍', type:'地方創生空間', note:'自備容器加贈飲品' },
    { id:'s4', coastId:'hl1', name:'七星海邊工作室', type:'在地手作', note:'無塑包裝產品 9 折' },
    { id:'s5', coastId:'kt1', name:'後壁湖珊瑚café', type:'友善咖啡店', note:'自備杯折 15 元' },
    { id:'s6', coastId:'yl1', name:'頭城海洋書房', type:'獨立書店', note:'自備袋享閱讀折扣' },
    { id:'s7', coastId:'tp1', name:'野柳地質咖啡', type:'景觀咖啡', note:'自備杯免費升級' },
    { id:'s8', coastId:'km1', name:'金門浯島食堂', type:'在地料理', note:'自備餐具送小菜' }
  ],
  currentCoastId: 'kl1',
  reward: null,
  isDoingRitual: false
};

const el = {
  appShell:     document.getElementById("app-shell"),
  stampRow:     document.getElementById("stampRow"),
  streakText:   document.getElementById("streakText"),
  actBtn:       document.getElementById("actBtn"),
  actionStatus: document.getElementById("actionStatus"),
  shopList:     document.getElementById("shopList"),
  kpiActions:   document.getElementById("kpiActions"),
  kpiGram:      document.getElementById("kpiGram"),
  coastBar:     document.getElementById("coastBar")
};

// ── 取得當前使用者 ID（統一用 auth.js 匯出的函數） ───────────
function getUid() {
  if (window.getCurrentUserId) return window.getCurrentUserId();
  if (typeof auth !== 'undefined' && auth.currentUser) return auth.currentUser.uid;
  return null;
}

// ── 初始化：登入後呼叫 ───────────────────────────────────────
window.initApp = async () => {
  gsap.to(el.appShell, { opacity: 1, duration: 1.5, ease: "power2.out" });
  const uid = getUid();
  refreshUI(uid);
  // 啟動錢包與抽卡模組
  if (uid) {
    if (window.initWallet) window.initWallet(uid);
    if (window.initGacha) window.initGacha(uid);
  }
};

async function refreshUI(uid) {
  const userId = uid || getUid() || 'demo_user';
  if (getUid()) updateUserProgress(userId);
  renderShops();
  loadMetrics();
}

async function updateUserProgress(userId) {
  try {
    const progress = await DB.getUserProgress(userId);
    el.stampRow.innerHTML = "";
    for (let i = 1; i <= 5; i++) {
      const div = document.createElement("div");
      div.className = `stamp ${i <= progress.stampCount ? "active" : ""}`;
      div.innerHTML = i;
      el.stampRow.appendChild(div);
    }
    el.streakText.textContent = progress.streakDays;
  } catch (err) { console.error(err); }
}

// ── 入口儀式：點擊鏡像門 ─────────────────────────────────────
window.enterApp = () => {
  gsap.to("#mirror-gate", { opacity: 0, scale: 1.2, duration: 1.5, onComplete: () => {
    document.getElementById('mirror-gate').style.display = 'none';

    // 無論 Firebase 模式或 demo 模式，都需要確認已登入
    const uid = getUid();
    if (!uid) {
      // 未登入 → 顯示登入/註冊 overlay
      document.getElementById('auth-overlay').style.display = 'flex';
    } else {
      window.initApp();
    }
  }});
};

// ── 守護行動儀式 ─────────────────────────────────────────────
window.startRitual = async function() {
  if (state.isDoingRitual) return;

  const userId = getUid();
  if (!userId) {
    document.getElementById('auth-overlay').style.display = 'flex';
    return;
  }

  const checked = [...document.querySelectorAll(".task-icons input:checked")].map(i => i.value);
  if (checked.length === 0) {
    el.actionStatus.innerText = "請至少選擇一項行動。";
    return;
  }

  const randomCoast = state.coasts[Math.floor(Math.random() * state.coasts.length)];
  state.currentCoastId = randomCoast.id;

  state.isDoingRitual = true;
  el.actBtn.disabled = true;
  el.actionStatus.innerText = "正在感應海洋連結...";

  try {
    // 1. 儲存行動（server 同步記錄積點）
    const actionResult = await DB.saveAction(userId, { coastId: state.currentCoastId, verifiedItems: checked });

    // 行動完成後顯示積點 toast（等動畫結束後）
    if (actionResult && actionResult.pointsEarned) {
      setTimeout(() => {
        if (window.showBonusToast) {
          window.showBonusToast(
            actionResult.pointsEarned,
            `守護行動完成！鏈上雜湊：${(actionResult.txHash || '').slice(0, 8)}…`
          );
        }
        // 同步更新錢包顯示
        if (window.refreshWallet) window.refreshWallet();
      }, 6200);

      // 同步記錄 Social Plastic® 貢獻至 Python API
      fetch("/api/esg", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "collect", userId, weight: actionResult.reductionGram || 0.42 }),
      }).catch(e => console.warn("ESG record:", e));
    }

    // 2. 取隨機獎勵照片
    state.reward = await DB.getRandomReward(state.currentCoastId);
    const coast = randomCoast;

    // 更新路徑顯示
    const routeContainer = document.getElementById('route-container');
    document.getElementById('routeText').textContent = coast.cityRoute;
    document.getElementById('path-fill').style.width = '0%';
    routeContainer.style.display = 'block';

    // 3. 啟動 GSAP 動畫
    const ov = document.getElementById('anim-overlay');
    ov.style.display = 'flex';
    ov.style.opacity = 1;

    const photon = document.getElementById('light-essence');
    gsap.set(photon, { top: "100%", left: "50%", scale: 1, opacity: 1 });

    const tl = gsap.timeline();
    gsap.to("#line-1", { opacity: 1, y: -20, duration: 1.5 });

    tl.to(photon, {
      motionPath: { path: "#river-path", align: "#river-path", alignOrigin: [0.5, 0.5] },
      duration: 5, ease: "power2.inOut"
    })
    .add(() => {
      gsap.to("#line-1", { opacity: 0, duration: 1 });
      gsap.to("#line-2", { opacity: 1, y: -20, delay: 0.8, duration: 1.5 });
      gsap.to(document.getElementById('path-fill'), { width: (Math.random() * 50 + 40) + '%', duration: 4, ease: "power1.inOut" });
    })
    .to(photon, { scale: 150, opacity: 0, duration: 2 })
    .add(() => {
      gsap.to("#line-2", { opacity: 0, duration: 1 });
      const line3 = document.getElementById('line-3');
      line3.innerText = "已隨機連結至 " + coast.name;
      gsap.to(line3, { opacity: 1, duration: 1.5 });
      document.getElementById('btn-reveal-final').style.display = 'block';
    });

    refreshUI(userId);

  } catch (err) {
    el.actionStatus.innerText = err.message || "儀式啟動失敗，請稍後再試。";
    state.isDoingRitual = false;
    el.actBtn.disabled = false;
    document.getElementById('anim-overlay').style.display = 'none';
  }
};

window.revealReward = () => {
  const ov = document.getElementById('anim-overlay');
  gsap.to(ov, { opacity: 0, duration: 0.4, onComplete: () => {
    ov.style.display = 'none';
    showCard();
  }});
};

function showCard() {
  const stage = document.getElementById('reward-stage');
  stage.style.display = 'flex';

  const r = state.reward || {};
  const coast = state.coasts.find(c => c.id === state.currentCoastId) || state.coasts[0];

  const img = document.getElementById('c-img');
  // 優先使用對應海域的精選海景照片
  img.src = coast.img;
  img.onerror = () => { img.src = 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&q=80&w=1200'; };

  document.getElementById('c-loc').innerText = r.locationName || r.name || coast.name;
  document.getElementById('c-loc-tag').innerText = coast.tag || "台灣海域";
  document.getElementById('c-story').innerText = r.story || "感謝這份守護海洋的心意。這片海域因為你的選擇而更清澈了一點。";
  document.getElementById('c-impact-num').innerText = (0.3 + Math.random() * 0.3).toFixed(2);
  document.getElementById('c-impact-text').innerText = coast.trivia;

  const shop = state.shops.find(s => s.coastId === state.currentCoastId) || state.shops[0];
  document.getElementById('c-s-name').innerText = shop.name;
  document.getElementById('c-s-type').innerText = (shop.type || "友善店家") + " ｜ " + (shop.note || "自備折扣");

  gsap.fromTo("#card-3d", { scale: 0.3, opacity: 0, rotationY: 45 }, { scale: 1, opacity: 1, rotationY: 0, duration: 1, ease: "back.out(1.2)" });
}

window.flipCard = () => {
  const inner = document.getElementById('card-inner');
  const rot = gsap.getProperty(inner, "rotationY");
  gsap.to(inner, { rotationY: rot >= 180 ? 0 : 180, duration: 0.6 });
};

window.closeReward = (e) => {
  e.stopPropagation();
  const stage = document.getElementById('reward-stage');
  gsap.to(stage, { opacity: 0, scale: 0.8, duration: 0.4, onComplete: () => {
    stage.style.display = 'none';
    stage.style.opacity = 1;
    state.isDoingRitual = false;
    el.actBtn.disabled = false;
    document.querySelectorAll(".task-icons input").forEach(i => {
      i.checked = false;
      i.parentElement.classList.remove('active');
    });
  }});
};

// ── 照片上傳 ─────────────────────────────────────────────────
window.handleFileSelect = (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2 * 1024 * 1024) {
    alert("照片檔案過大，請選擇 2MB 以下的圖片。");
    return;
  }
  const reader = new FileReader();
  reader.onload = (event) => {
    state.pendingImageData = event.target.result;
    document.getElementById('upload-placeholder').style.display = 'none';
    document.getElementById('preview-img').src = state.pendingImageData;
    document.getElementById('upload-preview').style.display = 'block';
  };
  reader.readAsDataURL(file);
};

window.submitObservation = async () => {
  const userId = getUid() || 'demo_user';
  const data = {
    photoUrl:     state.pendingImageData,
    nickname:     document.getElementById('sub-nickname').value,
    locationName: document.getElementById('sub-location').value,
    story:        document.getElementById('sub-story').value,
    consent:      document.getElementById('sub-consent').checked,
    coastId:      state.currentCoastId
  };

  const status = document.getElementById('sub-status');
  if (!data.photoUrl || !data.nickname || !data.locationName || !data.story || !data.consent) {
    status.innerText = "請上傳照片並填寫完整資訊。";
    return;
  }

  status.innerText = "正在傳送海洋記憶...";
  try {
    await DB.submitPhoto(userId, data);
    status.innerText = "投稿成功！+15 積點已入帳。感謝你的觀察。";
    document.getElementById('submission-form').reset();
    document.getElementById('upload-placeholder').style.display = 'block';
    document.getElementById('upload-preview').style.display = 'none';
    state.pendingImageData = null;
    if (window.refreshWallet) setTimeout(window.refreshWallet, 500);
  } catch (err) {
    status.innerText = "傳送失敗，請稍後再試。";
    console.error(err);
  }
};

// ── 店家清單 ─────────────────────────────────────────────────
function renderShops() {
  el.shopList.innerHTML = state.shops.map(s => `
    <div class="shop-item">
      <b>${s.name}</b>
      <p>${s.type} ｜ ${s.note}</p>
    </div>
  `).join('');
}

// ── 全體 KPI 數據 ─────────────────────────────────────────────
async function loadMetrics() {
  try {
    const m = await DB.getMonthlyMetrics();
    el.kpiActions.innerText = m.actionCount;
    el.kpiGram.innerText = m.reductionGram;

    const max = Math.max(1, ...Object.values(m.byCoast || {}));
    el.coastBar.innerHTML = state.coasts.slice(0, 3).map(c => {
      const val = m.byCoast?.[c.id] || 0;
      const width = (val / max) * 100;
      return `
        <div class="coast-row">
          <span style="width:70px; opacity:0.6; font-size:0.7rem;">${c.name.slice(0,4)}</span>
          <div class="bar-bg"><div class="bar-fill" style="width:${width}%"></div></div>
          <span style="width:20px; text-align:right; font-size:0.8rem;">${val}</span>
        </div>
      `;
    }).join('');
  } catch (err) { console.error('metrics error:', err); }
}
