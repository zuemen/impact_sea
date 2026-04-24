from flask import Flask, request, jsonify
import os
import json
import time
import hashlib
import uuid

app = Flask(__name__)

# --- Vercel Serverless Data Handling ---
DATA_DIR = "/tmp/data"
os.makedirs(DATA_DIR, exist_ok=True)

def _read_json(filename, fallback):
    path = os.path.join(DATA_DIR, filename)
    if not os.path.exists(path):
        return fallback
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return fallback

def _write_json(filename, data):
    path = os.path.join(DATA_DIR, filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def compute_hash(prev_hash, action, value, user_id, timestamp):
    data_str = f"{prev_hash}|{action}|{value}|{user_id}|{timestamp}"
    return hashlib.sha256(data_str.encode("utf-8")).hexdigest()

# --- Auth Routes ---
@app.route("/api/auth/register", methods=["POST"])
def register():
    body = request.get_json() or {}
    email = body.get("email")
    password = body.get("password")
    display_name = body.get("displayName")
    if not email or not password:
        return jsonify({"error": "email 與 password 為必填"}), 400
    
    users = _read_json("users.json", [])
    if any(u.get("email") == email for u in users):
        return jsonify({"error": "該信箱已被註冊"}), 400
    
    user_id = "u_" + str(int(time.time()))
    new_user = {
        "id": user_id,
        "email": email,
        "password": password,  # MVP Demo only, no hash
        "displayName": display_name or email.split("@")[0],
        "points": 0,
        "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    }
    users.append(new_user)
    _write_json("users.json", users)
    
    # 註冊送積點
    ledger = _read_json("points-ledger.json", [])
    prev_hash = ledger[-1]["hash"] if ledger else "0"*64
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    tx_hash = compute_hash(prev_hash, "register_bonus", 30, user_id, timestamp)
    
    tx = {
        "id": f"tx_{int(time.time())}",
        "userId": user_id,
        "actionId": "register_bonus",
        "points": 30,
        "prevHash": prev_hash,
        "hash": tx_hash,
        "timestamp": timestamp
    }
    ledger.append(tx)
    _write_json("points-ledger.json", ledger)
    
    token = str(uuid.uuid4())
    sessions = _read_json("sessions.json", [])
    sessions.append({"token": token, "userId": user_id})
    _write_json("sessions.json", sessions)
    
    return jsonify({
        "message": "註冊成功",
        "user": {"id": user_id, "displayName": new_user["displayName"]},
        "token": token,
        "bonusPoints": 30
    }), 201

@app.route("/api/auth/login", methods=["POST"])
def login():
    body = request.get_json() or {}
    email = body.get("email")
    password = body.get("password")
    if not email or not password:
        return jsonify({"error": "email 與 password 為必填"}), 400
        
    users = _read_json("users.json", [])
    user = next((u for u in users if u.get("email") == email and u.get("password") == password), None)
    if not user:
        return jsonify({"error": "帳號或密碼錯誤"}), 401
        
    token = str(uuid.uuid4())
    sessions = _read_json("sessions.json", [])
    sessions.append({"token": token, "userId": user["id"]})
    _write_json("sessions.json", sessions)
    
    return jsonify({
        "message": "登入成功",
        "user": {"id": user["id"], "displayName": user.get("displayName")},
        "token": token
    })

@app.route("/api/auth/verify", methods=["GET"])
def verify():
    token = request.headers.get("x-session-token")
    if not token:
        return jsonify({"valid": False}), 401
    sessions = _read_json("sessions.json", [])
    session = next((s for s in sessions if s.get("token") == token), None)
    if not session:
        return jsonify({"valid": False}), 401
        
    user_id = session["userId"]
    users = _read_json("users.json", [])
    user = next((u for u in users if u.get("id") == user_id), None)
    return jsonify({
        "valid": True,
        "userId": user_id,
        "displayName": user.get("displayName", "守護者") if user else "守護者"
    })

# --- Actions Routes ---
@app.route("/api/actions", methods=["POST"])
def save_action():
    body = request.get_json() or {}
    user_id = body.get("userId", "anonymous")
    coast_id = body.get("coastId", "kl1")
    items = body.get("verifiedItems", [])
    
    if not items:
        return jsonify({"error": "未提供守護行動"}), 400
        
    action_id = f"act_{int(time.time())}"
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    
    # 簡單的減塑計算
    reduction = len(items) * 0.15
    points_earned = len(items) * 10
    
    actions = _read_json("actions.json", [])
    new_action = {
        "id": action_id,
        "userId": user_id,
        "coastId": coast_id,
        "verifiedItems": items,
        "reductionGram": round(reduction, 2),
        "timestamp": timestamp
    }
    actions.append(new_action)
    _write_json("actions.json", actions)
    
    # 積點發放
    ledger = _read_json("points-ledger.json", [])
    prev_hash = ledger[-1]["hash"] if ledger else "0"*64
    tx_hash = compute_hash(prev_hash, action_id, points_earned, user_id, timestamp)
    
    tx = {
        "id": f"tx_{int(time.time())}",
        "userId": user_id,
        "actionId": action_id,
        "points": points_earned,
        "prevHash": prev_hash,
        "hash": tx_hash,
        "timestamp": timestamp
    }
    ledger.append(tx)
    _write_json("points-ledger.json", ledger)
    
    return jsonify({
        "success": True,
        "actionId": action_id,
        "pointsEarned": points_earned,
        "reductionGram": new_action["reductionGram"],
        "txHash": tx_hash
    }), 201

# --- Points/Wallet Routes ---
@app.route("/api/points/<user_id>/ledger", methods=["GET"])
def get_ledger(user_id):
    ledger = _read_json("points-ledger.json", [])
    user_txs = [tx for tx in ledger if tx.get("userId") == user_id]
    
    balance = sum(tx.get("points", 0) for tx in user_txs)
    
    return jsonify({
        "userId": user_id,
        "balance": balance,
        "transactions": list(reversed(user_txs))[:20]
    })

# --- Draw Gacha Routes ---
CARD_POOL = [
    { "id":'c01', "name":'玳瑁海龜', "rarity":'common',    "emoji":'🐢', "power":12, "desc":'漫遊珊瑚礁間，是海洋智慧的化身。' },
    { "id":'c02', "name":'小丑魚',   "rarity":'common',    "emoji":'🐠', "power":8,  "desc":'躲藏在海葵之中，家的守護者。' },
    { "id":'r01', "name":'海馬',     "rarity":'rare',      "emoji":'🦄', "power":25, "desc":'雄性孕育後代，顛覆了自然的法則。' },
    { "id":'e01', "name":'鯊魚',     "rarity":'epic',      "emoji":'🦈', "power":55, "desc":'四億年的演化使其成為完美的獵者。' },
    { "id":'l01', "name":'藍鯨',     "rarity":'legendary', "emoji":'🌊', "power":99, "desc":'地球上最大的生命，以低鳴振動整片海洋。' }
]

import random
def draw_card():
    r = random.random()
    if r < 0.03: rarity = "legendary"
    elif r < 0.15: rarity = "epic"
    elif r < 0.40: rarity = "rare"
    else: rarity = "common"
    
    pool = [c for c in CARD_POOL if c["rarity"] == rarity]
    if not pool: pool = [c for c in CARD_POOL if c["rarity"] == "common"]
    return random.choice(pool)

@app.route("/api/cards/draw", methods=["POST"])
def draw_cards():
    body = request.get_json() or {}
    user_id = body.get("userId")
    count = body.get("count", 1)
    
    # support redeem token hack
    redeem_item = body.get("redeemItem")
    redeem_cost = body.get("redeemCost", 0)
    
    if not user_id:
        return jsonify({"error": "userId 為必填"}), 400
        
    ledger = _read_json("points-ledger.json", [])
    user_txs = [tx for tx in ledger if tx.get("userId") == user_id]
    balance = sum(tx.get("points", 0) for tx in user_txs)
    
    cost = redeem_cost if redeem_item else count * 10
    if balance < cost:
        return jsonify({"error": "積點不足"}), 400
        
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    prev_hash = ledger[-1]["hash"] if ledger else "0"*64
    
    action_type = "redeem_item" if redeem_item else f"draw_{count}"
    tx_hash = compute_hash(prev_hash, action_type, -cost, user_id, timestamp)
    
    tx = {
        "id": f"tx_{int(time.time())}",
        "userId": user_id,
        "actionId": action_type,
        "points": -cost,
        "prevHash": prev_hash,
        "hash": tx_hash,
        "timestamp": timestamp
    }
    ledger.append(tx)
    _write_json("points-ledger.json", ledger)
    
    if redeem_item:
        return jsonify({"success": True, "transaction": tx, "item": redeem_item}), 200
        
    drawn_cards = [draw_card() for _ in range(count)]
    user_cards = _read_json("user-cards.json", {})
    if user_id not in user_cards:
        user_cards[user_id] = []
    
    new_records = []
    for c in drawn_cards:
        record = {
            "instanceId": f"inst_{uuid.uuid4().hex[:8]}",
            "cardId": c["id"],
            "name": c["name"],
            "rarity": c["rarity"],
            "emoji": c["emoji"],
            "acquiredAt": timestamp
        }
        user_cards[user_id].append(record)
        new_records.append(record)
        
    _write_json("user-cards.json", user_cards)
    
    return jsonify({
        "success": True,
        "results": new_records,
        "transaction": tx
    }), 200

@app.route("/api/cards/<user_id>", methods=["GET"])
def get_cards(user_id):
    user_cards = _read_json("user-cards.json", {})
    return jsonify({"cards": user_cards.get(user_id, [])})

# --- Token / ESG API ---
REWARD_ITEMS = {
    "r1": {"name": "海洋淨灘手套", "cost": 30, "stock": 50},
    "r2": {"name": "珊瑚守護貼紙", "cost": 15, "stock": 100},
    "r3": {"name": "海洋不鏽鋼吸管", "cost": 50, "stock": 30},
    "r4": {"name": "友善店家折價券", "cost": 40, "stock": 80},
    "r5": {"name": "海龜T-shirt", "cost": 150, "stock": 10},
    "r6": {"name": "海洋繪本", "cost": 100, "stock": 20},
    "r7": {"name": "減塑環保餐盒", "cost": 60, "stock": 40},
    "r8": {"name": "Social Plastic® 認證NFT", "cost": 200, "stock": 999},
}

@app.route("/api/token", methods=["GET"])
def get_tokens():
    user_id = request.args.get("userId")
    redemptions = _read_json("redemptions.json", [])
    user_redemptions = [r for r in redemptions if r.get("userId") == user_id] if user_id else []
    return jsonify({
        "items": list(REWARD_ITEMS.values()),
        "userRedemptions": user_redemptions
    })

@app.route("/api/token", methods=["POST"])
def redeem_token():
    body = request.get_json() or {}
    user_id = body.get("userId")
    item_id = body.get("itemId")
    if not user_id or not item_id:
        return jsonify({"error": "userId 與 itemId 為必填"}), 400
        
    item = REWARD_ITEMS.get(item_id)
    if not item: return jsonify({"error": "找不到此商品"}), 404
    
    # 這裡會扣點，可以直接呼叫內部 draw_cards 的邏輯或另外寫
    # 為簡單起見，我們手動扣點
    ledger = _read_json("points-ledger.json", [])
    user_txs = [tx for tx in ledger if tx.get("userId") == user_id]
    balance = sum(tx.get("points", 0) for tx in user_txs)
    
    if balance < item["cost"]:
        return jsonify({"error": "積點不足"}), 400
        
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    prev_hash = ledger[-1]["hash"] if ledger else "0"*64
    tx_hash = compute_hash(prev_hash, f"redeem_{item['name']}", -item["cost"], user_id, timestamp)
    
    tx = {
        "id": f"tx_{int(time.time())}",
        "userId": user_id,
        "actionId": f"redeem_{item['name']}",
        "points": -item["cost"],
        "prevHash": prev_hash,
        "hash": tx_hash,
        "timestamp": timestamp
    }
    ledger.append(tx)
    _write_json("points-ledger.json", ledger)
    
    return jsonify({
        "success": True,
        "message": f"成功兌換「{item['name']}」！",
        "transaction": tx,
        "cost": item["cost"]
    }), 201

@app.route("/api/esg", methods=["GET"])
def get_esg():
    sp_data = _read_json("social-plastic.json", {"totalCollected": 0, "totalSponsored": 0, "transactions": []})
    return jsonify({
        "totalCollected": round(sp_data.get("totalCollected", 0), 2),
        "totalSponsored": round(sp_data.get("totalSponsored", 0), 2),
        "transactions": sp_data.get("transactions", [])[-20:]
    })

@app.route("/api/esg", methods=["POST"])
def post_esg():
    body = request.get_json() or {}
    action = body.get("action", "collect")
    
    sp_data = _read_json("social-plastic.json", {"totalCollected": 0, "totalSponsored": 0, "transactions": []})
    txs = sp_data.setdefault("transactions", [])
    prev_hash = txs[-1]["hash"] if txs else "0"*40
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    
    if action == "sponsor":
        brand = body.get("brand", "Henkel 漢高")
        amount = float(body.get("amount", 10))
        available = sp_data["totalCollected"] - sp_data["totalSponsored"]
        if available <= 0:
            return jsonify({"error": "目前沒有尚未贊助的 Social Plastic® 可以收購。"}), 400
            
        actual = min(amount, available)
        tx_hash = compute_hash(prev_hash, "sponsor", actual, "system", timestamp)[:40]
        tx = {
            "id": f"sp_{int(time.time())}_sponsor",
            "type": "sponsor",
            "weightGram": round(actual, 2),
            "brand": brand,
            "userId": "system",
            "prevHash": prev_hash,
            "hash": tx_hash,
            "timestamp": timestamp
        }
        txs.append(tx)
        sp_data["totalSponsored"] = round(sp_data["totalSponsored"] + actual, 2)
        _write_json("social-plastic.json", sp_data)
        
        return jsonify({
            "success": True,
            "message": f"{brand} 成功收購並認證了 {actual}g 的 Social Plastic®！",
            "transaction": tx,
            "totalCollected": sp_data["totalCollected"],
            "totalSponsored": sp_data["totalSponsored"]
        }), 201
    else:
        user_id = body.get("userId", "anonymous")
        weight = float(body.get("weight", 0.42))
        tx_hash = compute_hash(prev_hash, "collect", weight, user_id, timestamp)[:40]
        tx = {
            "id": f"sp_{int(time.time())}_collect",
            "type": "collect",
            "weightGram": round(weight, 2),
            "userId": user_id,
            "brand": "",
            "prevHash": prev_hash,
            "hash": tx_hash,
            "timestamp": timestamp
        }
        txs.append(tx)
        sp_data["totalCollected"] = round(sp_data["totalCollected"] + weight, 2)
        _write_json("social-plastic.json", sp_data)
        
        return jsonify({
            "success": True,
            "message": f"已記錄 {weight}g Social Plastic® 貢獻。",
            "transaction": tx,
            "totalCollected": sp_data["totalCollected"]
        }), 201

# --- Missing Routes (progress, metrics, photos, submissions) ---
@app.route("/api/progress", methods=["GET"])
def get_progress():
    user_id = request.args.get("deviceId")
    if not user_id: return jsonify({"error": "deviceId required"}), 400
    actions = _read_json("actions.json", [])
    my_actions = [a for a in actions if a.get("userId") == user_id or a.get("deviceId") == user_id]
    
    unique_days = sorted(list(set(a.get("timestamp", "")[:10] for a in my_actions if a.get("timestamp"))))
    stamp_count = min(len(unique_days), 5)
    
    # Calculate streak roughly
    streak = 0
    import datetime
    cursor = datetime.date.today()
    for _ in range(365):
        key = cursor.strftime("%Y-%m-%d")
        if key not in unique_days: break
        streak += 1
        cursor -= datetime.timedelta(days=1)
        
    return jsonify({
        "stampCount": stamp_count,
        "streakDays": streak,
        "totalActions": len(my_actions)
    })

@app.route("/api/metrics", methods=["GET"])
def get_metrics():
    month = request.args.get("month", time.strftime("%Y-%m"))
    actions = _read_json("actions.json", [])
    submissions = _read_json("submissions.json", [])
    
    month_actions = [a for a in actions if a.get("timestamp", "").startswith(month)]
    unique_people = len(set(a.get("userId") or a.get("deviceId") for a in month_actions))
    total_reduction = sum(a.get("reductionGram", 0) for a in month_actions)
    
    by_coast = {}
    for a in month_actions:
        cid = a.get("coastId", "kl1")
        by_coast[cid] = by_coast.get(cid, 0) + 1
        
    approved_subs = len([s for s in submissions if s.get("status") == "approved"])
    
    return jsonify({
        "month": month,
        "actionCount": len(month_actions),
        "participantCount": unique_people,
        "reductionGram": round(total_reduction, 2),
        "approvedSubmissions": approved_subs,
        "byCoast": by_coast
    })

@app.route("/api/photos/random", methods=["GET"])
def get_random_photo():
    coast_id = request.args.get("coastId")
    photos = _read_json("photos.json", [])
    submissions = _read_json("submissions.json", [])
    
    combined = photos + [s for s in submissions if s.get("status") == "approved"]
    pool = [p for p in combined if p.get("coastId") == coast_id] if coast_id else combined
    
    if not pool: pool = combined
    if not pool: return jsonify({"item": {}})
    
    return jsonify({"item": random.choice(pool)})

@app.route("/api/submissions", methods=["GET", "POST"])
def submissions_api():
    if request.method == "GET":
        status = request.args.get("status", "approved")
        submissions = _read_json("submissions.json", [])
        return jsonify({"items": [s for s in submissions if s.get("status") == status]})
    else:
        body = request.get_json() or {}
        nickname = body.get("nickname")
        photo_url = body.get("photoUrl")
        location_name = body.get("locationName")
        coast_id = body.get("coastId")
        story = body.get("story")
        
        if not nickname or not photo_url or not location_name or not coast_id or not story:
            return jsonify({"error": "Required fields are incomplete."}), 400
            
        submissions = _read_json("submissions.json", [])
        new_sub = {
            "id": f"sub_{int(time.time())}",
            "createdAt": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "nickname": nickname,
            "photoUrl": photo_url,
            "locationName": location_name,
            "coastId": coast_id,
            "story": story,
            "status": "pending"
        }
        submissions.append(new_sub)
        _write_json("submissions.json", submissions)
        return jsonify({"success": True, "submissionId": new_sub["id"]}), 201

@app.route("/api/coasts", methods=["GET"])
def get_coasts():
    return jsonify({"items": _read_json("coasts.json", [])})

@app.route("/api/shops", methods=["GET"])
def get_shops():
    shops = _read_json("shops.json", [])
    region = request.args.get("region")
    coast_id = request.args.get("coastId")
    filtered = []
    for s in shops:
        if region and region != "all" and s.get("region") != region: continue
        if coast_id and s.get("coastId") != coast_id: continue
        filtered.append(s)
    return jsonify({"items": filtered})

# Add standard error handlers
@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=8080)
