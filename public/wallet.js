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
