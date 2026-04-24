// --- 區塊鏈積點錢包模組 ---

let walletUserId = null;
let walletData = { balance: 0, transactions: [] };

// ── 初始化（由 auth.js 在登入後呼叫） ────────────────────
window.initWallet = async (userId) => {
  walletUserId = userId;
  await refreshWallet();
};

// ── 重新整理積點資料 ────────────────────────────────────
async function refreshWallet() {
  if (!walletUserId) return;
  try {
    const headers = getSessionToken() ? { "x-session-token": getSessionToken() } : {};
    const res = await fetch(`/api/points/${walletUserId}/ledger?limit=15`, { headers });
    if (!res.ok) return;
    walletData = await res.json();
    renderWallet();
  } catch (e) {
    console.warn("wallet fetch error:", e);
  }
}

window.refreshWallet = refreshWallet;

// ── 渲染錢包 UI ──────────────────────────────────────────
function renderWallet() {
  const balanceEl = document.getElementById("wallet-balance");
  const ledgerEl = document.getElementById("wallet-ledger");
  const walletSection = document.getElementById("wallet-section");

  if (!walletSection) return;
  walletSection.style.display = "block";

  if (balanceEl) {
    balanceEl.textContent = walletData.balance ?? 0;
    // 數字跳動動畫
    if (window.gsap) {
      gsap.from(balanceEl, { innerText: 0, duration: 1, snap: { innerText: 1 }, ease: "power2.out",
        onUpdate() { balanceEl.textContent = Math.round(parseFloat(balanceEl.textContent)); }
      });
    }
  }

  if (!ledgerEl) return;

  const txs = walletData.transactions || [];
  if (txs.length === 0) {
    ledgerEl.innerHTML = `<p class="wallet-empty">尚無積點紀錄</p>`;
    return;
  }

  ledgerEl.innerHTML = txs.map((tx, i) => {
    const isEarn = tx.type === "earn";
    const sign = isEarn ? "+" : "−";
    const colorClass = isEarn ? "tx-earn" : "tx-spend";
    const date = new Date(tx.timestamp).toLocaleString("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

    return `
      <div class="tx-row" style="animation-delay:${i * 0.05}s">
        <div class="tx-left">
          <span class="tx-icon">${isEarn ? "▲" : "▼"}</span>
          <div class="tx-info">
            <span class="tx-reason">${tx.reason}</span>
            <span class="tx-meta">${date} · <span class="tx-hash" title="${tx.hash}">${tx.hash.slice(0, 8)}…</span></span>
          </div>
        </div>
        <span class="tx-amount ${colorClass}">${sign}${tx.amount}</span>
      </div>
      ${i < txs.length - 1 ? `<div class="chain-link">⬆ ${tx.prevHash.slice(0, 6)}…</div>` : ""}
    `;
  }).join("");
}

// ── 新增積點後通知 Toast ─────────────────────────────────
window.showBonusToast = (points, msg) => {
  const toast = document.getElementById("bonus-toast");
  const toastMsg = document.getElementById("bonus-toast-msg");
  const toastPts = document.getElementById("bonus-toast-pts");
  if (!toast) return;
  if (toastMsg) toastMsg.textContent = msg || "獲得守護積點！";
  if (toastPts) toastPts.textContent = `+${points} PTS`;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3500);
  // 同步更新 balance 顯示
  setTimeout(refreshWallet, 500);
};

// ── 點擊錢包卡片展開/收合帳本 ───────────────────────────
window.toggleLedger = () => {
  const ledgerEl = document.getElementById("wallet-ledger");
  const chevron = document.getElementById("ledger-chevron");
  if (!ledgerEl) return;
  const isOpen = ledgerEl.style.maxHeight && ledgerEl.style.maxHeight !== "0px";
  ledgerEl.style.maxHeight = isOpen ? "0px" : "600px";
  if (chevron) chevron.style.transform = isOpen ? "rotate(0deg)" : "rotate(180deg)";
};

// ══════════════════════════════════════════════════════════
// 區塊鏈代幣兌換商城 (OceanToken = OCT)
// 1 PTS = 1 OCT
// ══════════════════════════════════════════════════════════

const REWARD_ITEMS = [
  { id: 'r1', name: '海洋淨灘手套', desc: '100%再生材料製成的環保手套', cost: 30, emoji: '🧤', stock: 50 },
  { id: 'r2', name: '珊瑚守護貼紙', desc: '可貼於自備杯上的防水環保貼紙組', cost: 15, emoji: '🏷️', stock: 100 },
  { id: 'r3', name: '海洋不鏽鋼吸管', desc: '附清潔刷與收納袋的醫療級吸管', cost: 50, emoji: '🥤', stock: 30 },
  { id: 'r4', name: '友善店家折價券', desc: '共生店家通用消費折抵 50 元', cost: 40, emoji: '🎫', stock: 80 },
  { id: 'r5', name: '海龜T-shirt', desc: 'Henkel ESG 聯名有機棉 T-shirt', cost: 150, emoji: '👕', stock: 10 },
  { id: 'r6', name: '海洋繪本', desc: '《這片海，離我多遠？》精裝繪本', cost: 100, emoji: '📘', stock: 20 },
  { id: 'r7', name: '減塑環保餐盒', desc: '小麥纖維可分解便當盒', cost: 60, emoji: '🍱', stock: 40 },
  { id: 'r8', name: 'Social Plastic® 認證NFT', desc: '你的環保貢獻永久上鏈數位認證', cost: 200, emoji: '🔗', stock: 999 },
];

function initRewardShop() {
  const section = document.getElementById("reward-shop-section");
  const grid = document.getElementById("reward-shop-grid");
  const tokenEl = document.getElementById("token-balance");
  if (!section || !grid) return;

  section.style.display = "block";
  const balance = walletData.balance || 0;
  if (tokenEl) tokenEl.textContent = balance;

  grid.innerHTML = REWARD_ITEMS.map(item => {
    const canAfford = balance >= item.cost;
    return `
      <div class="collection-card" style="--rarity-color:${canAfford ? 'var(--sea-teal)' : 'var(--sea-slate)'}; --rarity-glow:${canAfford ? 'rgba(43,103,106,0.3)' : 'rgba(0,0,0,0)'}; padding: 20px; align-items: flex-start; cursor: ${canAfford ? 'pointer' : 'default'}; opacity: ${canAfford ? '1' : '0.5'};" onclick="${canAfford ? `window.redeemReward('${item.id}')` : ''}">
        <div style="font-size:2rem; margin-bottom:8px;">${item.emoji}</div>
        <div style="font-size:0.85rem; color:var(--sea-sand); font-weight:600; margin-bottom:4px;">${item.name}</div>
        <div style="font-size:0.7rem; color:var(--sea-slate); line-height:1.5; margin-bottom:12px;">${item.desc}</div>
        <div style="margin-top:auto; display:flex; justify-content:space-between; width:100%; align-items:center;">
          <span style="font-size:0.75rem; color:var(--sea-teal); font-weight:600;">${item.cost} OCT</span>
          <span style="font-size:0.6rem; color:var(--sea-slate);">剩餘 ${item.stock}</span>
        </div>
      </div>
    `;
  }).join("");
}

window.redeemReward = async (itemId) => {
  const item = REWARD_ITEMS.find(i => i.id === itemId);
  if (!item || !walletUserId) return;

  const balance = walletData.balance || 0;
  if (balance < item.cost) {
    alert(`代幣不足！需要 ${item.cost} OCT，你目前有 ${balance} OCT。`);
    return;
  }

  if (!confirm(`確定要用 ${item.cost} OCT 兌換「${item.name}」嗎？`)) return;

  try {
    const token = window.getSessionToken ? window.getSessionToken() : null;
    const headers = { "Content-Type": "application/json" };
    if (token) headers["x-session-token"] = token;

    // 使用抽卡 API 的 spend 機制扣除積點 (模擬代幣兌換)
    const res = await fetch("/api/cards/draw", {
      method: "POST",
      headers,
      body: JSON.stringify({ userId: walletUserId, count: 0, redeemItem: item.name, redeemCost: item.cost }),
    });

    // 即使 API 回傳錯誤也模擬成功（MVP 展示用）
    if (window.showBonusToast) {
      window.showBonusToast(item.cost, `兌換成功：${item.name}！已扣除 ${item.cost} OCT`);
    }

    // 模擬扣除餘額
    walletData.balance = Math.max(0, balance - item.cost);
    initRewardShop();
    renderWallet();
  } catch (e) {
    console.error(e);
  }
};

// ══════════════════════════════════════════════════════════
// Social Plastic® ESG 儀表板
// ══════════════════════════════════════════════════════════

async function initESGDashboard() {
  const section = document.getElementById("esg-section");
  if (!section) return;
  section.style.display = "block";

  try {
    const res = await fetch("/api/esg/social-plastic");
    if (!res.ok) return;
    const data = await res.json();

    const collectedEl = document.getElementById("sp-total-collected");
    const sponsoredEl = document.getElementById("sp-total-sponsored");
    if (collectedEl) collectedEl.innerHTML = `${data.totalCollected} <small style="font-size:0.9rem; opacity:0.5;">g</small>`;
    if (sponsoredEl) sponsoredEl.innerHTML = `${data.totalSponsored} <small style="font-size:0.9rem; opacity:0.5;">g</small>`;

    const list = document.getElementById("sp-tx-list");
    if (!list) return;

    if (data.transactions.length === 0) {
      list.innerHTML = `<p class="wallet-empty">尚無紀錄，完成守護行動後即可產生 Social Plastic® 認證。</p>`;
    } else {
      list.innerHTML = data.transactions.map((tx, i) => {
        const isSponsor = tx.type === "sponsor";
        const date = new Date(tx.timestamp).toLocaleString("zh-TW", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
        return `
          <div class="tx-row" style="animation-delay:${i * 0.03}s">
            <div class="tx-left">
              <span class="tx-icon" style="color:${isSponsor ? 'var(--gold)' : 'var(--sea-teal)'};">${isSponsor ? '🤝' : '🌊'}</span>
              <div class="tx-info">
                <span class="tx-reason">${isSponsor ? `${tx.brand} 收購認證` : '守護者環保貢獻'}</span>
                <span class="tx-meta">${date} · <span class="tx-hash" title="${tx.hash}">${tx.hash.slice(0, 10)}…</span></span>
              </div>
            </div>
            <span class="tx-amount ${isSponsor ? 'tx-spend' : 'tx-earn'}" style="color:${isSponsor ? 'var(--gold)' : '#4ade80'};">${tx.weightGram}g</span>
          </div>
        `;
      }).join("");
    }
  } catch (e) {
    console.error("ESG fetch error:", e);
  }
}

window.simulateSponsor = async () => {
  try {
    const res = await fetch("/api/esg/sponsor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: "Henkel 漢高", amount: 10 }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert(data.error || "贊助失敗");
      return;
    }
    alert(data.message);
    initESGDashboard();
  } catch (e) {
    console.error(e);
  }
};

// ── 擴展原 renderWallet 函數，同時更新代幣商城 ──────────────
const _origRenderWallet = renderWallet;
renderWallet = function() {
  _origRenderWallet();
  initRewardShop();
  initESGDashboard();
};

