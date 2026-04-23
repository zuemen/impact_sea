const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

const PORT = process.env.PORT || 8080;
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");

// Vercel Serverless Function 環境下，只有 /tmp 是可寫入的
// 但注意：這裡的寫入是暫時的，重啟後會消失。
const IS_VERCEL = process.env.VERCEL === "1";
const DATA_DIR = IS_VERCEL ? path.join("/tmp", "data") : path.join(ROOT, "data");

// 在 Vercel 環境中，初始化時將預設資料從 ROOT/data 複製到 /tmp/data
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

function ensureDataFile(name, fallback) {
  const file = path.join(DATA_DIR, name);
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(file)) fs.writeFileSync(file, JSON.stringify(fallback, null, 2), "utf8");
}

function readJson(name) {
  const file = path.join(DATA_DIR, name);
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch (e) {
    return [];
  }
}

function writeJson(name, value) {
  const file = path.join(DATA_DIR, name);
  fs.writeFileSync(file, JSON.stringify(value, null, 2), "utf8");
}

function sendJson(res, code, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store"
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
      if (body.length > 1_000_000) reject(new Error("Body too large"));
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function dateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
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
  return {
    stampCount,
    streakDays: streak,
    totalActions: myActions.length
  };
}

function computeMetrics(actions, submissions, month) {
  const monthActions = actions.filter((a) => a.dateKey.startsWith(month));
  const uniquePeople = new Set(monthActions.map((a) => a.deviceId)).size;
  const totalReduction = monthActions.reduce((sum, a) => sum + (a.reductionGram || 0), 0);
  const byCoast = {};
  monthActions.forEach((a) => {
    byCoast[a.coastId] = (byCoast[a.coastId] || 0) + 1;
  });
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

function handleApi(req, res, urlObj) {
  const method = req.method || "GET";
  const pathname = urlObj.pathname;
  const coasts = readJson("coasts.json");
  const shops = readJson("shops.json");
  const photos = readJson("photos.json");
  const actions = readJson("actions.json");
  const submissions = readJson("submissions.json");

  if (pathname === "/api/health" && method === "GET") {
    return sendJson(res, 200, { ok: true, now: new Date().toISOString() });
  }

  if (pathname === "/api/coasts" && method === "GET") {
    return sendJson(res, 200, { items: coasts });
  }

  if (pathname === "/api/shops" && method === "GET") {
    const region = urlObj.searchParams.get("region");
    const coastId = urlObj.searchParams.get("coastId");
    const discount = urlObj.searchParams.get("discount");
    const reuse = urlObj.searchParams.get("reuse");
    const filtered = shops.filter((s) => {
      if (region && region !== "all" && s.region !== region) return false;
      if (coastId && s.coastId !== coastId) return false;
      if (discount === "1" && !s.discount) return false;
      if (reuse === "1" && !s.noSingleUse) return false;
      return true;
    });
    return sendJson(res, 200, { items: filtered });
  }

  if (pathname === "/api/photos/random" && method === "GET") {
    const coastId = urlObj.searchParams.get("coastId");
    // 結合內建照片與審核通過的投稿
    const approvedSubs = submissions.filter(s => s.status === "approved");
    const combinedPool = [...photos, ...approvedSubs];
    
    const pool = coastId ? combinedPool.filter((p) => p.coastId === coastId) : combinedPool;
    return sendJson(res, 200, { item: randomItem(pool.length ? pool : combinedPool) });
  }

  if (pathname === "/api/progress" && method === "GET") {
    const deviceId = urlObj.searchParams.get("deviceId");
    if (!deviceId) return sendJson(res, 400, { error: "deviceId required" });
    return sendJson(res, 200, buildProgress(deviceId, actions));
  }

  if (pathname === "/api/metrics" && method === "GET") {
    const month = urlObj.searchParams.get("month") || monthKey();
    return sendJson(res, 200, computeMetrics(actions, submissions, month));
  }

  if (pathname === "/api/actions" && method === "POST") {
    return parseBody(req)
      .then((body) => {
        const { deviceId, coastId, verifiedItems, locationPoint } = body;
        if (!deviceId || !coastId || !Array.isArray(verifiedItems) || verifiedItems.length === 0) {
          return sendJson(res, 400, { error: "Missing required fields." });
        }
        const today = dateKey();
        
        // --- 測試期間暫時關閉每日限制，方便您連續測試 ---
        /*
        const already = actions.find((a) => a.deviceId === deviceId && a.dateKey === today);
        if (already) {
          return sendJson(res, 409, {
            error: "Today action already completed.",
            progress: buildProgress(deviceId, actions)
          });
        }
        */
        const reductionGram = Number((0.3 + Math.random() * 0.5).toFixed(2));
        const action = {
          id: `act_${Date.now()}`,
          createdAt: new Date().toISOString(),
          dateKey: today,
          deviceId,
          coastId,
          locationPoint: locationPoint || "unknown",
          verifiedItems,
          reductionGram
        };
        actions.push(action);
        writeJson("actions.json", actions);
        const rewardPool = photos.filter((p) => p.coastId === coastId);
        const reward = randomItem(rewardPool.length ? rewardPool : photos);
        return sendJson(res, 201, {
          action,
          reward,
          progress: buildProgress(deviceId, actions)
        });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body." }));
  }

  if (pathname === "/api/submissions" && method === "GET") {
    const status = urlObj.searchParams.get("status") || "approved";
    const items = submissions.filter((s) => s.status === status);
    return sendJson(res, 200, { items });
  }

  if (pathname === "/api/submissions" && method === "POST") {
    return parseBody(req)
      .then((body) => {
        const { nickname, photoUrl, locationName, coastId, story, consent, ig } = body;
        if (!nickname || !photoUrl || !locationName || !coastId || !story || !consent) {
          return sendJson(res, 400, { error: "Required fields are incomplete." });
        }
        if (story.length > 100) {
          return sendJson(res, 400, { error: "Story must be 100 characters or less." });
        }
        const item = {
          id: `sub_${Date.now()}`,
          createdAt: new Date().toISOString(),
          nickname,
          photoUrl,
          locationName,
          coastId,
          story,
          ig: ig || "",
          consent: true,
          status: "pending"
        };
        submissions.push(item);
        writeJson("submissions.json", submissions);
        return sendJson(res, 201, { item });
      })
      .catch(() => sendJson(res, 400, { error: "Invalid JSON body." }));
  }

  sendText(res, 404, "API route not found");
}

ensureDataFile("coasts.json", []);
ensureDataFile("shops.json", []);
ensureDataFile("photos.json", []);
ensureDataFile("actions.json", []);
ensureDataFile("submissions.json", []);

const server = http.createServer((req, res) => {
  const urlObj = new URL(req.url, `http://${req.headers.host}`);
  if (urlObj.pathname.startsWith("/api/")) {
    return handleApi(req, res, urlObj);
  }
  return serveStatic(req, res, urlObj);
});

server.listen(PORT, () => {
  console.log(`impact_sea server running at http://localhost:${PORT}`);
});
