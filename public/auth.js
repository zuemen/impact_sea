// --- Firebase Auth Logic ---

let currentMode = 'login';

window.switchAuthTab = (mode) => {
  currentMode = mode;
  const loginTab = document.getElementById('tab-login');
  const signupTab = document.getElementById('tab-signup');
  const signupFields = document.getElementById('signup-fields');
  const submitBtn = document.getElementById('auth-submit');
  const title = document.getElementById('auth-title');

  if (mode === 'login') {
    loginTab.classList.add('active');
    signupTab.classList.remove('active');
    signupFields.style.display = 'none';
    submitBtn.innerText = '登入';
    title.innerText = '歡迎回來，守護者';
  } else {
    signupTab.classList.add('active');
    loginTab.classList.remove('active');
    signupFields.style.display = 'block';
    submitBtn.innerText = '註冊帳號';
    title.innerText = '加入守護者的行列';
  }
};

document.getElementById('auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-pw').value;
  const name = document.getElementById('auth-name').value;
  const errorEl = document.getElementById('auth-error');
  errorEl.innerText = '';

  try {
    if (currentMode === 'signup') {
      const userCredential = await auth.createUserWithEmailAndPassword(email, password);
      await userCredential.user.updateProfile({ displayName: name });
      // 初始化 Firestore 用戶資料
      await db.collection('users').doc(userCredential.user.uid).set({
        displayName: name,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        totalActions: 0,
        stamps: 0
      });
    } else {
      await auth.signInWithEmailAndPassword(email, password);
    }
    // 成功後 overlay 會透過 onAuthStateChanged 關閉
  } catch (err) {
    errorEl.innerText = '錯誤: ' + err.message;
  }
});

auth.onAuthStateChanged((user) => {
  const overlay = document.getElementById('auth-overlay');
  const userInfo = document.getElementById('user-info');
  const displayName = document.getElementById('display-name');

  if (user) {
    overlay.style.display = 'none';
    userInfo.style.display = 'block';
    displayName.innerText = user.displayName || '守護者';
    // 觸發應用程式初始化或重新讀取
    if (window.initApp) window.initApp();
  } else {
    // 只有在不是鏡像入口時才顯示登入
    if (document.getElementById('mirror-gate').style.display === 'none') {
      overlay.style.display = 'flex';
    }
    userInfo.style.display = 'none';
  }
});

window.logout = () => {
  auth.signOut();
};
