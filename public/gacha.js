// --- 抽卡祭壇模組 ---

const RARITY_CONFIG = {
  common:    { label: "普通",  color: "#899293", glow: "rgba(137,146,147,0.3)", stars: 1 },
  rare:      { label: "稀有",  color: "#2B676A", glow: "rgba(43,103,106,0.5)",  stars: 2 },
  epic:      { label: "史詩",  color: "#7c3aed", glow: "rgba(124,58,237,0.6)",  stars: 3 },
  legendary: { label: "傳說",  color: "#D4AF37", glow: "rgba(212,175,55,0.8)",  stars: 4 },
};

let gachaUserId = null;

// ── 初始化（auth.js 呼叫） ───────────────────────────────
window.initGacha = async (userId) => {
  gachaUserId = userId;
  await loadCollection();
};

// ── 執行抽卡 ─────────────────────────────────────────────
window.doDraw = async (count = 1) => {
  if (!gachaUserId) {
    document.getElementById("auth-overlay").style.display = "flex";
    return;
  }

  const btn1 = document.getElementById("draw-btn-1");
  const btn10 = document.getElementById("draw-btn-10");
  if (btn1) btn1.disabled = true;
  if (btn10) btn10.disabled = true;

  try {
    const token = window.getSessionToken ? window.getSessionToken() : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["x-session-token"] = token;

    const res = await fetch("/api/cards/draw", {
      method: "POST",
      headers,
      body: JSON.stringify({ userId: gachaUserId, count }),
    });

    const data = await res.json();

    if (!res.ok) {
      showGachaError(data.error || "抽卡失敗，請稍後再試");
      return;
    }

    // 顯示抽卡結果動畫
    await showDrawResult(data.drawnCards);

    // 更新積點顯示
    const balanceEl = document.getElementById("wallet-balance");
    if (balanceEl) balanceEl.textContent = data.newBalance;
    if (window.refreshWallet) await window.refreshWallet();

    // 更新卡片收藏
    await loadCollection();

    // 顯示積點消耗提示
    if (window.showBonusToast) {
      window.showBonusToast(data.cost, `抽卡消耗 ${data.cost} 積點`);
    }
  } catch (e) {
    showGachaError("網路錯誤，請稍後再試");
    console.error(e);
  } finally {
    if (btn1) btn1.disabled = false;
    if (btn10) btn10.disabled = false;
  }
};

// ── 抽卡結果動畫 ─────────────────────────────────────────
async function showDrawResult(cards) {
  const modal = document.getElementById("gacha-result-modal");
  const container = document.getElementById("gacha-result-cards");
  if (!modal || !container) return;

  container.innerHTML = "";
  modal.style.display = "flex";
  // 稍後 fadeIn
  gsap.fromTo(modal, { opacity: 0 }, { opacity: 1, duration: 0.4 });

  for (let i = 0; i < cards.length; i++) {
    await new Promise(resolve => setTimeout(resolve, i * (cards.length === 1 ? 0 : 120)));
    const card = cards[i];
    const cfg = RARITY_CONFIG[card.rarity];
    const cardEl = document.createElement("div");
    cardEl.className = `gacha-card gacha-${card.rarity}`;
    cardEl.style.cssText = `--rarity-color:${cfg.color}; --rarity-glow:${cfg.glow};`;
    cardEl.innerHTML = `
      <div class="gacha-card-inner">
        <div class="gacha-card-face">
          <div class="gacha-emoji">${card.emoji}</div>
          <div class="gacha-rarity-badge">${cfg.label}</div>
          <div class="gacha-stars">${"★".repeat(cfg.stars)}${"☆".repeat(4 - cfg.stars)}</div>
          <div class="gacha-name">${card.name}</div>
          <div class="gacha-power">POWER <span>${card.power}</span></div>
          <div class="gacha-desc">${card.desc}</div>
        </div>
      </div>
    `;
    container.appendChild(cardEl);

    // 依稀有度決定動畫強度
    const intensity = { common: 0.3, rare: 0.6, epic: 1.0, legendary: 1.5 }[card.rarity] || 0.3;
    gsap.fromTo(cardEl,
      { scale: 0, rotationY: 180, opacity: 0 },
      { scale: 1, rotationY: 0, opacity: 1, duration: 0.7 * intensity + 0.3, ease: "back.out(1.5)", delay: 0 }
    );

    // 傳說：全螢幕金光
    if (card.rarity === "legendary") {
      playLegendaryEffect();
    }
  }
}

function playLegendaryEffect() {
  const flash = document.createElement("div");
  flash.style.cssText = `
    position: fixed; inset: 0; z-index: 9999; pointer-events: none;
    background: radial-gradient(circle, rgba(212,175,55,0.6) 0%, transparent 70%);
  `;
  document.body.appendChild(flash);
  gsap.to(flash, { opacity: 0, duration: 1.5, onComplete: () => flash.remove() });
}

// ── 關閉抽卡結果 ─────────────────────────────────────────
window.closeGachaResult = () => {
  const modal = document.getElementById("gacha-result-modal");
  if (!modal) return;
  gsap.to(modal, { opacity: 0, duration: 0.3, onComplete: () => { modal.style.display = "none"; } });
};

// ── 載入卡片收藏 ─────────────────────────────────────────
async function loadCollection() {
  if (!gachaUserId) return;
  try {
    const res = await fetch(`/api/cards/${gachaUserId}`);
    if (!res.ok) return;
    const data = await res.json();
    renderCollection(data);
  } catch {}
}

function renderCollection(data) {
  const collEl = document.getElementById("card-collection");
  const statsEl = document.getElementById("collection-stats");
  if (!collEl) return;

  if (statsEl) {
    statsEl.innerHTML = Object.entries(data.stats).map(([rarity, count]) => {
      const cfg = RARITY_CONFIG[rarity];
      return `<span class="stat-pill" style="color:${cfg.color}">${cfg.label} <b>${count}</b></span>`;
    }).join("");
  }

  if (data.total === 0) {
    collEl.innerHTML = `<p class="wallet-empty" style="grid-column:1/-1;">尚未獲得任何守護卡片，啟動儀式後開始抽卡！</p>`;
    return;
  }

  // 依稀有度排序：傳說 > 史詩 > 稀有 > 普通
  const order = { legendary: 0, epic: 1, rare: 2, common: 3 };
  const sorted = [...data.cards].sort((a, b) => (order[a.rarity] || 3) - (order[b.rarity] || 3));

  collEl.innerHTML = sorted.map(card => {
    const cfg = RARITY_CONFIG[card.rarity];
    return `
      <div class="collection-card coll-${card.rarity}" style="--rarity-color:${cfg.color}; --rarity-glow:${cfg.glow};" title="${card.desc}">
        <div class="coll-emoji">${card.emoji}</div>
        <div class="coll-rarity">${cfg.label}</div>
        <div class="coll-name">${card.name}</div>
        <div class="coll-power">⚡ ${card.power}</div>
      </div>
    `;
  }).join("");
}

function showGachaError(msg) {
  const el = document.getElementById("gacha-error");
  if (!el) { alert(msg); return; }
  el.textContent = msg;
  el.style.opacity = "1";
  setTimeout(() => { el.style.opacity = "0"; }, 3500);
}
