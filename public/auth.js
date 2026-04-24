// --- Auth Logic：支援 Firebase + Server-side fallback（demo 模式） ---

const IS_DEMO = firebaseConfig.apiKey === "YOUR_API_KEY";

// ── Server-side session 管理 ─────────────────────────────────
const ServerAuth = {
  getToken() { return localStorage.getItem("sea_token"); },
  setToken(token) { localStorage.setItem("sea_token", token); },
  getUserId() { return localStorage.getItem("sea_user_id"); },
  setUser(id, name) {
    localStorage.setItem("sea_user_id", id);
    localStorage.setItem("sea_user_name", name);
  },
  getDisplayName() { return localStorage.getItem("sea_user_name") || "守護者"; },
  clear() {
    localStorage.removeItem("sea_token");
    localStorage.removeItem("sea_user_id");
    localStorage.removeItem("sea_user_name");
  },
  isLoggedIn() { return !!this.getToken(); },

  async register(email, password, displayName) {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, displayName }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "註冊失敗");
    this.setToken(data.token);
    this.setUser(data.user.id, data.user.displayName);
    return data;
  },

  async login(email, password) {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "登入失敗");
    this.setToken(data.token);
    this.setUser(data.user.id, data.user.displayName);
    return data;
  },
};

// ── UI 元素 ────────────────────────────────────────────────
const overlay = document.getElementById("auth-overlay");
const userInfo = document.getElementById("user-info");
const displayNameEl = document.getElementById("display-name");
const authError = document.getElementById("auth-error");

// ── 切換登入 / 註冊 tab ───────────────────────────────────
let authMode = "login"; // "login" | "register"

function renderAuthForm() {
  const loginTab = document.getElementById("auth-tab-login");
  const registerTab = document.getElementById("auth-tab-register");
  const registerExtra = document.getElementById("auth-register-extra");
  const submitBtn = document.getElementById("auth-submit-btn");
  const switchLink = document.getElementById("auth-switch-link");

  if (authMode === "login") {
    loginTab && loginTab.classList.add("active");
    registerTab && registerTab.classList.remove("active");
    registerExtra && (registerExtra.style.display = "none");
    submitBtn && (submitBtn.textContent = "確認登入");
    switchLink && (switchLink.textContent = "還沒有帳號？立即註冊 →");
  } else {
    loginTab && loginTab.classList.remove("active");
    registerTab && registerTab.classList.add("active");
    registerExtra && (registerExtra.style.display = "block");
    submitBtn && (submitBtn.textContent = "建立守護者帳號");
    switchLink && (switchLink.textContent = "已有帳號？返回登入 ←");
  }
  authError && (authError.innerText = "");
}

window.switchAuthMode = () => {
  authMode = authMode === "login" ? "register" : "login";
  renderAuthForm();
};

// ── 表單提交 ─────────────────────────────────────────────
document.getElementById("auth-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("auth-email").value.trim();
  const password = document.getElementById("auth-pw").value;
  const displayName = document.getElementById("auth-display-name")?.value.trim();
  authError.innerText = "";

  try {
    if (IS_DEMO) {
      // Demo 模式：用 server-side auth
      if (authMode === "register") {
        const data = await ServerAuth.register(email, password, displayName);
        onAuthSuccess(data.user.id, data.user.displayName, true, data.bonusPoints);
      } else {
        const data = await ServerAuth.login(email, password);
        onAuthSuccess(data.user.id, data.user.displayName, false, 0);
      }
    } else {
      // Firebase 模式
      if (authMode === "register") {
        const cred = await auth.createUserWithEmailAndPassword(email, password);
        if (displayName) await cred.user.updateProfile({ displayName });
        // 同時在 server 建立積點帳戶
        await ServerAuth.register(email, password, displayName || email.split("@")[0]).catch(() => {});
      } else {
        await auth.signInWithEmailAndPassword(email, password);
      }
    }
  } catch (err) {
    authError.innerText = err.message;
  }
});

// ── 登入/註冊成功後統一處理 ─────────────────────────────
function onAuthSuccess(userId, name, isNew, bonusPoints) {
  if (overlay) overlay.style.display = "none";
  if (userInfo) userInfo.style.display = "block";
  if (displayNameEl) displayNameEl.innerText = name;
  if (window.initApp) window.initApp();
  if (window.initWallet) window.initWallet(userId);
  if (window.initGacha) window.initGacha(userId);

  if (isNew && bonusPoints > 0) {
    setTimeout(() => {
      window.showBonusToast && window.showBonusToast(bonusPoints);
    }, 1500);
  }
}

// ── Firebase 狀態監聽 ────────────────────────────────────
if (!IS_DEMO) {
  auth.onAuthStateChanged((user) => {
    if (user) {
      if (overlay) overlay.style.display = "none";
      if (userInfo) userInfo.style.display = "block";
      if (displayNameEl) displayNameEl.innerText = user.displayName || user.email.split("@")[0];
      if (window.initApp) window.initApp();
      // userId for points: use Firebase UID
      if (window.initWallet) window.initWallet(user.uid);
      if (window.initGacha) window.initGacha(user.uid);
    } else {
      if (userInfo) userInfo.style.display = "none";
      const gate = document.getElementById("mirror-gate");
      if (gate && gate.style.display === "none") {
        if (overlay) overlay.style.display = "flex";
      }
    }
  });
} else {
  // Demo 模式：若有本地 session 直接進入
  if (ServerAuth.isLoggedIn()) {
    const userId = ServerAuth.getUserId();
    const name = ServerAuth.getDisplayName();
    if (userInfo) userInfo.style.display = "block";
    if (displayNameEl) displayNameEl.innerText = name;
    setTimeout(() => {
      if (window.initApp) window.initApp();
      if (window.initWallet) window.initWallet(userId);
      if (window.initGacha) window.initGacha(userId);
    }, 100);
  }
}

// ── 取得當前使用者 ID（統一入口） ─────────────────────────
window.getCurrentUserId = () => {
  if (!IS_DEMO && auth.currentUser) return auth.currentUser.uid;
  if (ServerAuth.isLoggedIn()) return ServerAuth.getUserId();
  return "demo_user";
};

window.getCurrentUserName = () => {
  if (!IS_DEMO && auth.currentUser) return auth.currentUser.displayName || "守護者";
  return ServerAuth.getDisplayName();
};

window.getSessionToken = () => ServerAuth.getToken();

// ── 登出 ─────────────────────────────────────────────────
window.logout = async () => {
  if (!IS_DEMO) {
    await auth.signOut().catch(() => {});
  }
  ServerAuth.clear();
  window.location.reload();
};
