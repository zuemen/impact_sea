// --- Symbiosis Impact Sea 2.0 - Core Engine ---

gsap.registerPlugin(MotionPathPlugin);

const state = {
  coasts: [
    { id:'kl1', name:'基隆嶼海域', tag:'北部海域', cityRoute:'城市排水孔 → 基隆河 → 淡水河口 → 基隆嶼', trivia:'龍蝦與黑鳶的家，也是台北人的後花園。', img:'https://images.unsplash.com/photo-1505118380757-91f5f45d8de4?w=1000&q=80' },
    { id:'td1', name:'台東三仙台', tag:'東部海域', cityRoute:'部落排水口 → 卑南溪 → 太平洋 → 三仙台', trivia:'擁有台灣最美的八拱橋，是第一道曙光照耀之地。', img:'https://images.unsplash.com/photo-1520113526514-99dec0cb393d?w=1000&q=80' },
    { id:'ph1', name:'澎湖七美', tag:'離島海域', cityRoute:'城市水溝 → 台灣海峽 → 澎湖群島 → 七美', trivia:'雙心石滬的古老智慧，需要我們這一代繼續傳承。', img:'https://images.unsplash.com/photo-1538332576228-eb5b4c4de6f5?w=1000&q=80' },
    { id:'hl1', name:'花蓮七星潭', tag:'東部海域', cityRoute:'美崙溪 → 太平洋 → 七星潭月牙灣', trivia:'湛藍的礫石海灘，是東台灣最純淨的呼吸。', img:'https://images.unsplash.com/photo-1621539201550-20227918a3be?w=1000&q=80' },
    { id:'kt1', name:'墾丁後壁湖', tag:'南部海域', cityRoute:'恆春水溝 → 巴士海峽 → 後壁湖珊瑚礁', trivia:'台灣最具代表性的珊瑚礁棲息地，潛水者的天堂。', img:'https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1000&q=80' }
  ],
  shops: [
    { id:'s1', coastId:'kl1', name:'小島咖啡', type:'友善咖啡店', note:'自備杯折 10 元' },
    { id:'s2', coastId:'td1', name:'成功民宿', type:'綠色旅宿', note:'續住不更換備品折扣' },
    { id:'s3', coastId:'ph1', name:'七美舍', type:'地方創生空間', note:'自備容器加贈飲品' },
    { id:'s4', coastId:'hl1', name:'七星海邊工作室', type:'在地手作', note:'無塑包裝產品 9 折' }
  ],
  currentCoastId: 'kl1',
  reward: null,
  isDoingRitual: false
};

const el = {
  appShell: document.getElementById("app-shell"),
  routeText: document.getElementById("routeText"),
  pathFill: document.getElementById("path-fill"),
  stampRow: document.getElementById("stampRow"),
  streakText: document.getElementById("streakText"),
  coastSelect: document.getElementById("coastSelect"),
  actBtn: document.getElementById("actBtn"),
  actionStatus: document.getElementById("actionStatus"),
  shopList: document.getElementById("shopList"),
  kpiActions: document.getElementById("kpiActions"),
  kpiGram: document.getElementById("kpiGram"),
  coastBar: document.getElementById("coastBar")
};

// --- 初始化 ---

window.initApp = async () => {
  const user = auth.currentUser;
  const IS_DEMO = firebaseConfig.apiKey === "YOUR_API_KEY";
  
  if (!user && !IS_DEMO) return;

  gsap.to(el.appShell, { opacity: 1, duration: 1.5, ease: "power2.out" });
  if (IS_DEMO) {
    const badge = document.getElementById('demo-badge');
    if (badge) badge.style.display = 'block';
  }

  loadInitialData();
  refreshUI();
};

function loadInitialData() {
  el.coastSelect.innerHTML = state.coasts
    .map((c) => `<option value="${c.id}">${c.name}</option>`)
    .join("");
  state.currentCoastId = state.coasts[0].id;
  updateContext();
}

async function refreshUI() {
  const userId = auth.currentUser ? auth.currentUser.uid : 'demo_user';
  updateUserProgress(userId);
  renderShops();
  loadMetrics();
}

function updateContext() {
  const coast = state.coasts.find((c) => c.id === state.currentCoastId);
  el.routeText.textContent = coast.cityRoute;
  el.pathFill.style.width = (Math.random() * 50 + 20) + '%';
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

// --- 守護儀式 Core ---

window.enterApp = () => {
  const IS_DEMO = firebaseConfig.apiKey === "YOUR_API_KEY";
  gsap.to("#mirror-gate", { opacity: 0, scale: 1.2, duration: 1, onComplete: () => {
    document.getElementById('mirror-gate').style.display = 'none';
    if (!auth.currentUser && !IS_DEMO) {
      document.getElementById('auth-overlay').style.display = 'flex';
    } else {
      window.initApp();
    }
  }});
};

async function startRitual() {
  if (state.isDoingRitual) return;
  
  const IS_DEMO = firebaseConfig.apiKey === "YOUR_API_KEY";
  const userId = auth.currentUser ? auth.currentUser.uid : (IS_DEMO ? 'demo_user' : null);
  if (!userId) {
    document.getElementById('auth-overlay').style.display = 'flex';
    return;
  }

  const checked = [...document.querySelectorAll(".task-icons input:checked")].map(i => i.value);
  if (checked.length === 0) {
    el.actionStatus.innerText = "請至少選擇一項行動。";
    return;
  }

  state.isDoingRitual = true;
  el.actBtn.disabled = true;
  el.actionStatus.innerText = "";

  try {
    state.reward = await DB.getRandomReward(state.currentCoastId);
    const coast = state.coasts.find(c => c.id === state.currentCoastId);

    const ov = document.getElementById('anim-overlay');
    ov.style.display = 'flex';
    ov.style.opacity = 1;

    const photon = document.getElementById('light-essence');
    gsap.set(photon, { top: "100%", left: "50%", scale: 1, opacity: 1 });
    
    const tl = gsap.timeline();
    gsap.to("#line-1", { opacity: 1, y: -20, duration: 1 });
    
    tl.to(photon, { 
      motionPath: { path: "#river-path", align: "#river-path", alignOrigin: [0.5, 0.5] },
      duration: 3, ease: "power2.inOut" 
    })
    .add(() => {
      gsap.to("#line-1", { opacity: 0, duration: 0.5 });
      gsap.to("#line-2", { opacity: 1, y: -20, delay: 0.5, duration: 1 });
    })
    .to(photon, { scale: 100, opacity: 0, duration: 1 })
    .add(() => {
      gsap.to("#line-2", { opacity: 0, duration: 0.5 });
      const line3 = document.getElementById('line-3');
      line3.innerText = "已連結至 " + coast.name;
      line3.style.opacity = 1;
      document.getElementById('btn-reveal-final').style.display = 'block';
    });

    DB.saveAction(userId, { coastId: state.currentCoastId, items: checked }).then(() => refreshUI());

  } catch (err) {
    state.isDoingRitual = false;
    el.actBtn.disabled = false;
  }
}

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
  
  const r = state.reward;
  const coast = state.coasts.find(c => c.id === state.currentCoastId);

  const img = document.getElementById('c-img');
  img.src = r.photoUrl || coast.img;
  img.onerror = () => { img.src = coast.img; };

  document.getElementById('c-loc').innerText = r.locationName || coast.name;
  document.getElementById('c-loc-tag').innerText = coast.tag;
  document.getElementById('c-story').innerText = r.story || "感謝這份守護海洋的心意。";
  document.getElementById('c-impact-num').innerText = (0.3 + Math.random()*0.3).toFixed(2);
  document.getElementById('c-impact-text').innerText = coast.trivia;
  
  const shop = state.shops.find(s => s.coastId === state.currentCoastId) || state.shops[0];
  document.getElementById('c-s-name').innerText = shop.name;
  document.getElementById('c-s-type').innerText = shop.type + " ｜ " + shop.note;

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
    state.isDoingRitual = false;
    el.actBtn.disabled = false;
    document.querySelectorAll(".task-icons input").forEach(i => { i.checked = false; i.parentElement.classList.remove('active'); });
  }});
};

function renderShops() {
  el.shopList.innerHTML = state.shops.map(s => `
    <div class="shop-item">
      <b>${s.name}</b>
      <p>${s.type} ｜ ${s.note}</p>
    </div>
  `).join('');
}

async function loadMetrics() {
  const m = await DB.getMonthlyMetrics();
  el.kpiActions.innerText = m.actionCount;
  el.kpiGram.innerText = m.reductionGram;

  const max = Math.max(1, ...Object.values(m.byCoast));
  el.coastBar.innerHTML = state.coasts.slice(0, 3).map(c => {
    const val = m.byCoast[c.id] || 0;
    const width = (val / max) * 100;
    return `
      <div class="coast-row">
        <span style="width:70px; opacity:0.6;">${c.name}</span>
        <div class="bar-bg"><div class="bar-fill" style="width:${width}%"></div></div>
        <span style="width:20px; text-align:right;">${val}</span>
      </div>
    `;
  }).join('');
}

el.coastSelect.addEventListener("change", () => {
  state.currentCoastId = el.coastSelect.value;
  updateContext();
});
