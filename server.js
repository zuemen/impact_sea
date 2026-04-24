const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");

const IS_VERCEL = process.env.VERCEL === "1";
const DATA_DIR = IS_VERCEL ? path.join("/tmp", "data") : path.join(ROOT, "data");

if (IS_VERCEL) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const sourceDataDir = path.join(ROOT, "data");
  if (fs.existsSync(sourceDataDir)) {
    fs.readdirSync(sourceDataDir).forEach(file => {
      const destFile = path.join(DATA_DIR, file);
      if (!fs.existsSync(destFile)) {
        fs.copyFileSync(path.join(sourceDataDir, file), destFile);
      }
    });
  }
}

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

// ── 卡片資料池（靜態定義，無需資料庫） ───────────────────────
const CARD_POOL = [
  // Common (普通) - 60%
  { id:'c01', name:'玳瑁海龜', rarity:'common',    emoji:'🐢', power:12, desc:'漫遊珊瑚礁間，是海洋智慧的化身。' },
  { id:'c02', name:'小丑魚',   rarity:'common',    emoji:'🐠', power:8,  desc:'躲藏在海葵之中，家的守護者。' },
  { id:'c03', name:'招潮蟹',   rarity:'common',    emoji:'🦀', power:10, desc:'以螯揮舞潮汐的信號，是沙灘的哨兵。' },
  { id:'c04', name:'飛魚',     rarity:'common',    emoji:'🐟', power:9,  desc:'跳躍海面，連結了海與天的邊界。' },
  { id:'c05', name:'硨磲貝',   rarity:'common',    emoji:'🐚', power:7,  desc:'濾淨一生的海水，靜默地守護水質。' },
  { id:'c06', name:'海星',     rarity:'common',    emoji:'⭐', power:11, desc:'以五臂感知海底的律動。' },
  // Rare (稀有) - 25%
  { id:'r01', name:'海馬',     rarity:'rare',      emoji:'🦄', power:25, desc:'雄性孕育後代，顛覆了自然的法則。' },
  { id:'r02', name:'章魚',     rarity:'rare',      emoji:'🐙', power:28, desc:'擁有三顆心臟與九個大腦，智謀超群。' },
  { id:'r03', name:'海豚',     rarity:'rare',      emoji:'🐬', power:30, desc:'用超音波歌唱海洋的故事。' },
  { id:'r04', name:'蝠魟',     rarity:'rare',      emoji:'🦋', power:27, desc:'在深藍中翱翔，是海底的蝴蝶。' },
  { id:'r05', name:'獅子魚',   rarity:'rare',      emoji:'🦁', power:26, desc:'華麗的毒棘，美麗與危險並存。' },
  // Epic (史詩) - 12%
  { id:'e01', name:'鯊魚',     rarity:'epic',      emoji:'🦈', power:55, desc:'四億年的演化使其成為完美的獵者。' },
  { id:'e02', name:'抹香鯨',   rarity:'epic',      emoji:'🐋', power:60, desc:'潛至千米深海，尋訪黑暗中的章魚。' },
  { id:'e03', name:'珊瑚群落', rarity:'epic',      emoji:'🪸', power:50, desc:'千年積累的生命奇蹟，正面臨白化危機。' },
  // Legendary (傳說) - 3%
  { id:'l01', name:'藍鯨',     rarity:'legendary', emoji:'🌊', power:99, desc:'地球上最大的生命，以低鳴振動整片海洋。' },
  { id:'l02', name:'海龍神',   rarity:'legendary', emoji:'🐉', power:95, desc:'深海傳說之靈，守護所有海域的古老意識。' },
];

// 各稀有度抽中機率（累積值）
const RARITY_RATES = [
  { rarity: 'legendary', rate: 0.03 },
  { rarity: 'epic',      rate: 0.15 },
  { rarity: 'rare',      rate: 0.40 },
  { rarity: 'common',    rate: 1.00 },
];

const RARITY_POINTS_REWARD = { common: 5, rare: 15, epic: 30, legendary: 100 };
const DRAW_COST = 10; // 每次抽卡消耗積點

// ── 工具函數 ─────────────────────────────────────────

function ensureDataFile(name, fallback) {
  const file = path.join(DATA_DIR, name);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fallback, null, 2), "utf8");
}

function readJson(name) {
  const file = path.join(DATA_DIR, name);
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return []; }
}

function writeJson(name, value) {
  fs.writeFileSync(path.join(DATA_DIR, name), JSON.stringify(value, null, 2), "utf8");
}

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  res.end(body);
}

function sendText(res, code, text) {
  res.writeHead(code, { "Content-Type": "text/plain; charset=utf-8" });
  res.end(text);
}

function resolvePublicPath(urlPath) {
  const safePath = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, safePath);
  if (!filePath.startsWith(PUBLIC_DIR)) return null;
  return filePath;
}

function serveStatic(req, res, urlObj) {
  let pathname = urlObj.pathname;
  if (pathname === "/") pathname = "/index.html";
  const filePath = resolvePublicPath(pathname);
  if (!filePath || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    sendText(res, 404, "Not Found");
    return;
  }
  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME_TYPES[ext] || "application/octet-stream";
  const content = fs.readFileSync(filePath);
  res.writeHead(200, { "Content-Type": mime, "Content-Length": content.length });
  res.end(content);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) reject(new Error("Body too large"));
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try { resolve(JSON.parse(body)); }
      catch (err) { reject(err); }
    });
    req.on("error", reject);
  });
}

function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit"
  }).format(date);
}

function monthKey(date = new Date()) {
  return dateKey(date).slice(0, 7);
}

function randomItem(list) {
  if (!Array.isArray(list) || list.length === 0) return null;
  return list[Math.floor(Math.random() * list.length)];
}

function buildProgress(deviceId, actions) {
  const myActions = actions.filter((a) => a.deviceId === deviceId);
  const uniqueDays = [...new Set(myActions.map((a) => a.dateKey))].sort();
  const stampCount = Math.min(uniqueDays.length, 5);
  let streak = 0;
  const cursor = new Date();
  while (true) {
    const key = dateKey(cursor);
    if (!uniqueDays.includes(key)) break;
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return { stampCount, streakDays: streak, totalActions: myActions.length };
}

function computeMetrics(actions, submissions, month) {
  const monthActions = actions.filter((a) => a.dateKey.startsWith(month));
  const uniquePeople = new Set(monthActions.map((a) => a.deviceId)).size;
  const totalReduction = monthActions.reduce((sum, a) => sum + (a.reductionGram || 0), 0);
  const byCoast = {};
  monthActions.forEach((a) => { byCoast[a.coastId] = (byCoast[a.coastId] || 0) + 1; });
  const approvedSubmissions = submissions.filter((s) => s.status === "approved").length;
  return {
    month,
    actionCount: monthActions.length,
    participantCount: uniquePeople,
    reductionGram: Number(totalReduction.toFixed(2)),
    approvedSubmissions,
    byCoast
  };
}

// ── 密碼雜湊（Node.js 內建 crypto.scrypt，無需外部套件） ──────
async function hashPassword(password, salt) {
  return new Promise((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (err, key) => {
      if (err) reject(err);
      else resolve(key.toString("hex"));
    });
  });
}

function generateToken() {
  return "tok_" + crypto.randomBytes(24).toString("hex");
}

// ── 區塊鏈積點與 Social Plastic：計算交易 hash ────────────────────────────────
function computeTxHash(prevHash, userId, amount, type, reason, timestamp) {
  const data = `${prevHash}|${userId}|${amount}|${type}|${reason}|${timestamp}`;
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 40);
}

function computePlasticTxHash(prevHash, actionId, weightGram, type, brand, timestamp) {
  const data = `plastic|${prevHash}|${actionId}|${weightGram}|${type}|${brand}|${timestamp}`;
  return crypto.createHash("sha256").update(data).digest("hex").slice(0, 40);
}

// 取得使用者積點總計
function getUserBalance(userId, ledger) {
  return ledger
    .filter(tx => tx.userId === userId)
    .reduce((sum, tx) => sum + (tx.type === "earn" ? tx.amount : -tx.amount), 0);
}

// 新增一筆積點交易（區塊鏈樣式）
function appendTransaction(userId, amount, type, reason, ledger) {
  const lastTx = [...ledger].reverse().find(tx => tx.userId === userId);
  const prevHash = lastTx ? lastTx.hash : "0".repeat(40);
  const timestamp = new Date().toISOString();
  const hash = computeTxHash(prevHash, userId, amount, type, reason, timestamp);
  const tx = {
    id: `tx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    userId,
    type,     // "earn" | "spend"
    amount,
    reason,
    prevHash,
    hash,
    timestamp,
  };
  ledger.push(tx);
  return tx;
}

// 抽卡邏輯：根據機率隨機選牌
function drawRandomCard() {
  const roll = Math.random();
  let selected = RARITY_RATES.find(r => roll <= r.rate)?.rarity || "common";
  const pool = CARD_POOL.filter(c => c.rarity === selected);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ── 驗證 session token，回傳 userId 或 null ─────────────────
function getAuthedUserId(req) {
  const token = req.headers["x-session-token"];
  if (!token) return null;
  const sessions = readJson("sessions.json");
  const session = sessions.find(s => s.token === token && new Date(s.expiresAt) > new Date());
  return session ? session.userId : null;
}

// ══════════════════════════════════════════════════════════════
// API 路由總分配
// ══════════════════════════════════════════════════════════════

function handleApi(req, res, urlObj) {
  const method = req.method || "GET";
  const pathname = urlObj.pathname;

  // CORS preflight
  if (method === "OPTIONS") {
    res.writeHead(204, { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" });
    res.end();
    return;
  }

  // ── 原有路由 ─────────────────────────────────────────────

  if (pathname === "/api/health" && method === "GET") {
    return sendJson(res, 200, { ok: true, now: new Date().toISOString() });
  }

  // 個人進度（印章、連續天數）
  if (pathname === "/api/progress" && method === "GET") {
    const deviceId = urlObj.searchParams.get("deviceId");
    if (!deviceId) return sendJson(res, 400, { error: "deviceId required" });
    return sendJson(res, 200, buildProgress(deviceId, readJson("actions.json")));
  }

  if (pathname === "/api/coasts" && method === "GET") {
    return sendJson(res, 200, { items: readJson("coasts.json") });
  }

  if (pathname === "/api/shops" && method === "GET") {
    const shops = readJson("shops.json");
    const region = urlObj.searchParams.get("region");
    const coastId = urlObj.searchParams.get("coastId");
    const filtered = shops.filter(s => {
      if (region && region !== "all" && s.region !== region) return false;
      if (coastId && s.coastId !== coastId) return false;
      return true;
    });
    return sendJson(res, 200, { items: filtered });
  }

  if (pathname === "/api/photos/random" && method === "GET") {
    const photos = readJson("photos.json");
    const submissions = readJson("submissions.json");
    const coastId = urlObj.searchParams.get("coastId");
    const combined = [...photos, ...submissions.filter(s => s.status === "approved")];
    const pool = coastId ? combined.filter(p => p.coastId === coastId) : combined;
    return sendJson(res, 200, { item: randomItem(pool.length ? pool : combined) });
  }

  if (pathname === "/api/progress" && method === "GET") {
    const deviceId = urlObj.searchParams.get("deviceId");
    if (!deviceId) return sendJson(res, 400, { error: "deviceId required" });
    return sendJson(res, 200, buildProgress(deviceId, actions));
  }

  if (pathname === "/api/metrics" && method === "GET") {
    const month = urlObj.searchParams.get("month") || monthKey();
    return sendJson(res, 200, computeMetrics(readJson("actions.json"), readJson("submissions.json"), month));
  }

  if (pathname === "/api/submissions" && method === "GET") {
    const status = urlObj.searchParams.get("status") || "approved";
    return sendJson(res, 200, { items: readJson("submissions.json").filter(s => s.status === status) });
  }

  if (pathname === "/api/submissions" && method === "POST") {
    return parseBody(req).then(body => {
      const { nickname, photoUrl, locationName, coastId, story, consent } = body;
      if (!nickname || !photoUrl || !locationName || !coastId || !story || !consent) {
        return sendJson(res, 400, { error: "Required fields are incomplete." });
      }
      if (story.length > 100) return sendJson(res, 400, { error: "Story must be 100 characters or less." });
      const submissions = readJson("submissions.json");
      const item = {
        id: `sub_${Date.now()}`, createdAt: new Date().toISOString(),
        nickname, photoUrl, locationName, coastId, story, ig: body.ig || "", consent: true, status: "pending"
      };
      submissions.push(item);
      writeJson("submissions.json", submissions);

      // 投稿成功：+15 積點
      const userId = getAuthedUserId(req) || body.userId;
      if (userId) {
        const ledger = readJson("points-ledger.json");
        appendTransaction(userId, 15, "earn", "投稿海岸觀察", ledger);
        writeJson("points-ledger.json", ledger);
      }

      return sendJson(res, 201, { item });
    }).catch(() => sendJson(res, 400, { error: "Invalid JSON body." }));
  }

  // 行動記錄（加入積點發放）
  if (pathname === "/api/actions" && method === "POST") {
    return parseBody(req).then(body => {
      const { deviceId, coastId, verifiedItems, locationPoint } = body;
      if (!deviceId || !coastId || !Array.isArray(verifiedItems) || verifiedItems.length === 0) {
        return sendJson(res, 400, { error: "Missing required fields." });
      }
      const actions = readJson("actions.json");
      const today = dateKey();
      const reductionGram = Number((0.3 + Math.random() * 0.5).toFixed(2));
      const action = {
        id: `act_${Date.now()}`, createdAt: new Date().toISOString(),
        dateKey: today, deviceId, coastId,
        locationPoint: locationPoint || "unknown",
        verifiedItems, reductionGram
      };
      actions.push(action);
      writeJson("actions.json", actions);

      // 行動完成：+10 積點
      const ledger = readJson("points-ledger.json");
      const earnTx = appendTransaction(deviceId, 10, "earn", `守護行動 (${verifiedItems.join(", ")})`, ledger);
      writeJson("points-ledger.json", ledger);

      // --- Social Plastic 區塊鏈紀錄 ---
      const spData = readJson("social-plastic.json");
      const lastSpTx = spData.transactions.length > 0 ? spData.transactions[spData.transactions.length - 1] : null;
      const prevSpHash = lastSpTx ? lastSpTx.hash : "0".repeat(40);
      const spTimestamp = new Date().toISOString();
      const spHash = computePlasticTxHash(prevSpHash, action.id, reductionGram, "collect", "none", spTimestamp);
      
      const spTx = {
        id: `sptx_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        actionId: action.id,
        userId: deviceId,
        type: "collect",
        weightGram: reductionGram,
        brand: "none",
        prevHash: prevSpHash,
        hash: spHash,
        timestamp: spTimestamp,
      };
      spData.transactions.push(spTx);
      spData.totalCollected = Number((spData.totalCollected + reductionGram).toFixed(2));
      writeJson("social-plastic.json", spData);

      const photos = readJson("photos.json");
      const rewardPool = photos.filter(p => p.coastId === coastId);
      const reward = randomItem(rewardPool.length ? rewardPool : photos);

      return sendJson(res, 201, {
        action, reward,
        progress: buildProgress(deviceId, actions),
        pointsEarned: 10,
        newBalance: getUserBalance(deviceId, ledger),
        txHash: earnTx.hash,
        spTxHash: spTx.hash,
      });
    }).catch(() => sendJson(res, 400, { error: "Invalid JSON body." }));
  }

  // ── 新功能：Social Plastic (ESG) 儀表板與贊助 ───────────────────
  if (pathname === "/api/esg/social-plastic" && method === "GET") {
    const spData = readJson("social-plastic.json");
    // 回傳總覽與最近的交易紀錄
    return sendJson(res, 200, {
      totalCollected: spData.totalCollected,
      totalSponsored: spData.totalSponsored,
      transactions: spData.transactions.slice(-50).reverse() // 最新的 50 筆
    });
  }

  if (pathname === "/api/esg/sponsor" && method === "POST") {
    return parseBody(req).then(body => {
      // 模擬品牌贊助 (例如 Henkel)
      const brand = body.brand || "Henkel 漢高";
      const sponsorAmount = Number(body.amount) || 10; // 模擬贊助多少克

      const spData = readJson("social-plastic.json");
      const available = spData.totalCollected - spData.totalSponsored;

      if (available <= 0) {
        return sendJson(res, 400, { error: "目前沒有尚未贊助的 Social Plastic® 可以收購。" });
      }

      const actualSponsor = Math.min(sponsorAmount, available);
      
      const lastSpTx = spData.transactions.length > 0 ? spData.transactions[spData.transactions.length - 1] : null;
      const prevSpHash = lastSpTx ? lastSpTx.hash : "0".repeat(40);
      const spTimestamp = new Date().toISOString();
      const spHash = computePlasticTxHash(prevSpHash, "sponsor", actualSponsor, "sponsor", brand, spTimestamp);

      const spTx = {
        id: `sptx_${Date.now()}_sponsor`,
        actionId: "sponsor",
        userId: "system",
        type: "sponsor",
        weightGram: actualSponsor,
        brand: brand,
        prevHash: prevSpHash,
        hash: spHash,
        timestamp: spTimestamp,
      };

      spData.transactions.push(spTx);
      spData.totalSponsored = Number((spData.totalSponsored + actualSponsor).toFixed(2));
      writeJson("social-plastic.json", spData);

      return sendJson(res, 201, {
        message: `${brand} 成功收購並認證了 ${actualSponsor}g 的 Social Plastic®！`,
        transaction: spTx,
        totalCollected: spData.totalCollected,
        totalSponsored: spData.totalSponsored
      });
    }).catch(err => sendJson(res, 500, { error: err.message }));
  }

  // ── 新功能：驗證 session token ─────────────────────────────

  if (pathname === "/api/auth/verify" && method === "GET") {
    const userId = getAuthedUserId(req);
    if (!userId) return sendJson(res, 401, { valid: false });
    const users = readJson("users.json");
    const user = users.find(u => u.id === userId);
    return sendJson(res, 200, {
      valid: true,
      userId,
      displayName: user ? user.displayName : "守護者"
    });
  }

  // ── 新功能：使用者註冊 ────────────────────────────────────

  if (pathname === "/api/auth/register" && method === "POST") {
    return parseBody(req).then(async body => {
      const { email, password, displayName } = body;
      if (!email || !password) return sendJson(res, 400, { error: "email 與 password 為必填" });
      if (password.length < 6) return sendJson(res, 400, { error: "密碼至少需要 6 個字元" });

      const users = readJson("users.json");
      if (users.find(u => u.email === email)) {
        return sendJson(res, 409, { error: "此 email 已被註冊" });
      }

      const salt = crypto.randomBytes(16).toString("hex");
      const hashedPw = await hashPassword(password, salt);
      const userId = `user_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
      const user = {
        id: userId,
        email,
        displayName: displayName || email.split("@")[0],
        password: hashedPw,
        salt,
        createdAt: new Date().toISOString(),
      };
      users.push(user);
      writeJson("users.json", users);

      // 新用戶：贈送 30 開局積點
      const ledger = readJson("points-ledger.json");
      appendTransaction(userId, 30, "earn", "新守護者歡迎禮", ledger);
      writeJson("points-ledger.json", ledger);

      // 建立 session（7 天有效）
      const token = generateToken();
      const sessions = readJson("sessions.json");
      sessions.push({ token, userId, expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString() });
      writeJson("sessions.json", sessions);

      return sendJson(res, 201, {
        token,
        user: { id: userId, email, displayName: user.displayName },
        bonusPoints: 30,
      });
    }).catch(err => sendJson(res, 500, { error: err.message }));
  }

  // ── 新功能：登入 ──────────────────────────────────────────

  if (pathname === "/api/auth/login" && method === "POST") {
    return parseBody(req).then(async body => {
      const { email, password } = body;
      if (!email || !password) return sendJson(res, 400, { error: "email 與 password 為必填" });

      const users = readJson("users.json");
      const user = users.find(u => u.email === email);
      if (!user) return sendJson(res, 401, { error: "帳號或密碼錯誤" });

      const hashed = await hashPassword(password, user.salt);
      if (hashed !== user.password) return sendJson(res, 401, { error: "帳號或密碼錯誤" });

      const token = generateToken();
      const sessions = readJson("sessions.json");
      // 清除舊 session
      const validSessions = sessions.filter(s => s.userId !== user.id || new Date(s.expiresAt) > new Date());
      validSessions.push({ token, userId: user.id, expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString() });
      writeJson("sessions.json", validSessions);

      return sendJson(res, 200, {
        token,
        user: { id: user.id, email: user.email, displayName: user.displayName },
      });
    }).catch(err => sendJson(res, 500, { error: err.message }));
  }

  // ── 新功能：取得使用者資料 ────────────────────────────────

  if (pathname.startsWith("/api/users/") && method === "GET") {
    const userId = pathname.split("/")[3];
    const users = readJson("users.json");
    const user = users.find(u => u.id === userId);
    if (!user) return sendJson(res, 404, { error: "找不到使用者" });
    const ledger = readJson("points-ledger.json");
    return sendJson(res, 200, {
      id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt,
      balance: getUserBalance(userId, ledger),
    });
  }

  // ── 新功能：積點查詢 ──────────────────────────────────────

  if (pathname.startsWith("/api/points/") && !pathname.endsWith("/ledger") && method === "GET") {
    const userId = pathname.split("/")[3];
    const ledger = readJson("points-ledger.json");
    return sendJson(res, 200, {
      userId,
      balance: getUserBalance(userId, ledger),
      txCount: ledger.filter(tx => tx.userId === userId).length,
    });
  }

  if (pathname.startsWith("/api/points/") && pathname.endsWith("/ledger") && method === "GET") {
    const userId = pathname.split("/")[3];
    const ledger = readJson("points-ledger.json");
    const limit = parseInt(urlObj.searchParams.get("limit") || "20", 10);
    const userTxs = ledger.filter(tx => tx.userId === userId).reverse().slice(0, limit);
    return sendJson(res, 200, {
      userId,
      balance: getUserBalance(userId, ledger),
      transactions: userTxs,
    });
  }

  // ── 新功能：卡片抽卡 ──────────────────────────────────────

  if (pathname === "/api/cards/draw" && method === "POST") {
    return parseBody(req).then(body => {
      const userId = getAuthedUserId(req) || body.userId;
      if (!userId) return sendJson(res, 401, { error: "請先登入" });

      const count = Math.min(parseInt(body.count || 1, 10), 10); // 最多一次 10 連抽
      const totalCost = DRAW_COST * count;

      const ledger = readJson("points-ledger.json");
      const balance = getUserBalance(userId, ledger);
      if (balance < totalCost) {
        return sendJson(res, 400, { error: `積點不足，需要 ${totalCost} 點，目前僅有 ${balance} 點` });
      }

      // 扣除積點
      const spendTx = appendTransaction(userId, totalCost, "spend", `抽卡 x${count}`, ledger);

      // 抽卡，並給稀有卡積點獎勵
      const drawnCards = [];
      const userCards = readJson("user-cards.json");

      for (let i = 0; i < count; i++) {
        const card = drawRandomCard();
        const rarityBonus = RARITY_POINTS_REWARD[card.rarity] || 0;
        const userCard = {
          id: `uc_${Date.now()}_${i}`,
          userId,
          cardId: card.id,
          rarity: card.rarity,
          drawnAt: new Date().toISOString(),
        };
        userCards.push(userCard);
        drawnCards.push({ ...card, instanceId: userCard.id });

        // 稀有以上自動補償積點
        if (rarityBonus > 0) {
          appendTransaction(userId, rarityBonus, "earn", `抽到 ${card.rarity} 稀有度補償`, ledger);
        }
      }

      writeJson("user-cards.json", userCards);
      writeJson("points-ledger.json", ledger);

      return sendJson(res, 200, {
        drawnCards,
        cost: totalCost,
        newBalance: getUserBalance(userId, ledger),
        spendTxHash: spendTx.hash,
      });
    }).catch(err => sendJson(res, 500, { error: err.message }));
  }

  // ── 新功能：查詢使用者卡片收藏 ────────────────────────────

  if (pathname.startsWith("/api/cards/") && method === "GET") {
    const userId = pathname.split("/")[3];
    const userCards = readJson("user-cards.json");
    const owned = userCards.filter(uc => uc.userId === userId);
    const enriched = owned.map(uc => {
      const card = CARD_POOL.find(c => c.id === uc.cardId);
      return { ...uc, ...card };
    });
    // 統計各稀有度數量
    const stats = { common: 0, rare: 0, epic: 0, legendary: 0 };
    enriched.forEach(c => { if (stats[c.rarity] !== undefined) stats[c.rarity]++; });
    return sendJson(res, 200, { total: enriched.length, stats, cards: enriched });
  }

  // ── 新功能：卡片池資料（給前端展示） ──────────────────────

  if (pathname === "/api/cards/pool" && method === "GET") {
    return sendJson(res, 200, { cards: CARD_POOL, drawCost: DRAW_COST, rates: RARITY_RATES });
  }

  sendText(res, 404, "API route not found");
}

// ── 初始化資料文件 ────────────────────────────────────────────
ensureDataFile("coasts.json", []);
ensureDataFile("shops.json", []);
ensureDataFile("photos.json", []);
ensureDataFile("actions.json", []);
ensureDataFile("submissions.json", []);
ensureDataFile("users.json", []);
ensureDataFile("sessions.json", []);
ensureDataFile("points-ledger.json", []);
ensureDataFile("user-cards.json", []);
ensureDataFile("social-plastic.json", { totalCollected: 0, totalSponsored: 0, transactions: [] });

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  if (urlObj.pathname.startsWith("/api/")) return handleApi(req, res, urlObj);
  return serveStatic(req, res, urlObj);
});

server.listen(PORT, () => {
  console.log(`🌊 impact_sea server running at http://localhost:${PORT}`);
});
