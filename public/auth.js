// --- Firebase Auth Logic ---

document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-pw').value;
  const errorEl = document.getElementById('auth-error');
  errorEl.innerText = '';

  try {
    await auth.signInWithEmailAndPassword(email, password);
    // 成功後 overlay 會透過 onAuthStateChanged 關閉
  } catch (err) {
    errorEl.innerText = '登入錯誤: ' + err.message;
  }
});

auth.onAuthStateChanged((user) => {
  const overlay = document.getElementById('auth-overlay');
  const userInfo = document.getElementById('user-info');
  const displayName = document.getElementById('display-name');

  if (user) {
    if (overlay) overlay.style.display = 'none';
    if (userInfo) userInfo.style.display = 'block';
    if (displayName) displayName.innerText = user.displayName || user.email.split('@')[0] || '守護者';
    if (window.initApp) window.initApp();
  } else {
    if (userInfo) userInfo.style.display = 'none';
    // 只有在不是鏡像入口時才顯示登入
    const gate = document.getElementById('mirror-gate');
    if (gate && gate.style.display === 'none') {
      if (overlay) overlay.style.display = 'flex';
    }
  }
});

window.logout = () => {
  auth.signOut().then(() => {
    window.location.reload();
  });
};
