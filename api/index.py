from flask import Flask, request, jsonify
import os
import json
import time
import hashlib
import uuid
import random
from .db import get_db, init_db

app = Flask(__name__)

# Ensure DB schema is initialized on startup
try:
    init_db()
except Exception as e:
    print("DB Init Error:", e)

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
    
    conn = get_db()
    c = conn.cursor()
    
    c.execute("SELECT id FROM users WHERE email = ?", (email,))
    if c.fetchone():
        return jsonify({"error": "該信箱已被註冊"}), 400
    
    user_id = "u_" + str(int(time.time()))
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    display_name = display_name or email.split("@")[0]
    
    c.execute("INSERT INTO users (id, email, password, display_name, created_at) VALUES (?, ?, ?, ?, ?)",
              (user_id, email, password, display_name, created_at))
    
    # 註冊送積點
    c.execute("SELECT hash FROM ledger ORDER BY rowid DESC LIMIT 1")
    row = c.fetchone()
    prev_hash = row["hash"] if row else "0"*64
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    tx_hash = compute_hash(prev_hash, "register_bonus", 30, user_id, timestamp)
    
    tx_id = f"tx_{int(time.time())}"
    c.execute("INSERT INTO ledger (id, user_id, action_id, points, hash, prev_hash, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
              (tx_id, user_id, "register_bonus", 30, tx_hash, prev_hash, timestamp))
              
    token = str(uuid.uuid4())
    c.execute("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
              (token, user_id, created_at))
    
    conn.commit()
    conn.close()
    
    return jsonify({
        "message": "註冊成功",
        "user": {"id": user_id, "displayName": display_name},
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
        
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT id, display_name FROM users WHERE email = ? AND password = ?", (email, password))
    user = c.fetchone()
    
    if not user:
        conn.close()
        return jsonify({"error": "帳號或密碼錯誤"}), 401
        
    token = str(uuid.uuid4())
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    c.execute("INSERT INTO sessions (token, user_id, created_at) VALUES (?, ?, ?)",
              (token, user["id"], created_at))
    conn.commit()
    conn.close()
    
    return jsonify({
        "message": "登入成功",
        "user": {"id": user["id"], "displayName": user["display_name"]},
        "token": token
    })

@app.route("/api/auth/verify", methods=["GET"])
def verify():
    token = request.headers.get("x-session-token")
    if not token:
        return jsonify({"valid": False}), 401
        
    conn = get_db()
    c = conn.cursor()
    c.execute("""
        SELECT u.id, u.display_name 
        FROM sessions s 
        JOIN users u ON s.user_id = u.id 
        WHERE s.token = ?
    """, (token,))
    user = c.fetchone()
    conn.close()
    
    if not user:
        return jsonify({"valid": False}), 401
        
    return jsonify({
        "valid": True,
        "userId": user["id"],
        "displayName": user["display_name"] or "守護者"
    })

# --- Actions Routes ---
@app.route("/api/actions", methods=["POST"])
def save_action():
    body = request.get_json() or {}
    user_id = body.get("userId") or body.get("deviceId", "anonymous")
    coast_id = body.get("coastId", "kl1")
    items = body.get("verifiedItems", [])
    
    if not items:
        return jsonify({"error": "未提供守護行動"}), 400
        
    action_id = f"act_{int(time.time())}"
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    
    reduction = len(items) * 0.15
    points_earned = len(items) * 10
    
    conn = get_db()
    c = conn.cursor()
    
    c.execute("INSERT INTO actions (id, user_id, coast_id, verified_items, reduction_gram, timestamp) VALUES (?, ?, ?, ?, ?, ?)",
              (action_id, user_id, coast_id, json.dumps(items), round(reduction, 2), timestamp))
              
    c.execute("SELECT hash FROM ledger ORDER BY rowid DESC LIMIT 1")
    row = c.fetchone()
    prev_hash = row["hash"] if row else "0"*64
    tx_hash = compute_hash(prev_hash, action_id, points_earned, user_id, timestamp)
    
    tx_id = f"tx_{int(time.time())}"
    c.execute("INSERT INTO ledger (id, user_id, action_id, points, hash, prev_hash, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
              (tx_id, user_id, action_id, points_earned, tx_hash, prev_hash, timestamp))
              
    conn.commit()
    conn.close()
    
    return jsonify({
        "success": True,
        "actionId": action_id,
        "pointsEarned": points_earned,
        "reductionGram": round(reduction, 2),
        "txHash": tx_hash
    }), 201

# --- Points/Wallet Routes ---
@app.route("/api/points/<user_id>/ledger", methods=["GET"])
def get_ledger(user_id):
    conn = get_db()
    c = conn.cursor()
    
    c.execute("SELECT SUM(points) as balance FROM ledger WHERE user_id = ?", (user_id,))
    row = c.fetchone()
    balance = row["balance"] if row and row["balance"] else 0
    
    c.execute("SELECT * FROM ledger WHERE user_id = ? ORDER BY rowid DESC LIMIT 20", (user_id,))
    txs = [dict(row) for row in c.fetchall()]
    
    # Format keys to camelCase for frontend
    formatted_txs = []
    for tx in txs:
        formatted_txs.append({
            "id": tx["id"],
            "userId": tx["user_id"],
            "actionId": tx["action_id"],
            "points": tx["points"],
            "hash": tx["hash"],
            "prevHash": tx["prev_hash"],
            "timestamp": tx["timestamp"]
        })
        
    conn.close()
    
    return jsonify({
        "userId": user_id,
        "balance": balance,
        "transactions": formatted_txs
    })

# --- Draw Gacha Routes ---
CARD_POOL = [
    { "id":'c01', "name":'玳瑁海龜', "rarity":'common',    "emoji":'🐢', "power":12, "desc":'漫遊珊瑚礁間，是海洋智慧的化身。' },
    { "id":'c02', "name":'小丑魚',   "rarity":'common',    "emoji":'🐠', "power":8,  "desc":'躲藏在海葵之中，家的守護者。' },
    { "id":'r01', "name":'海馬',     "rarity":'rare',      "emoji":'🦄', "power":25, "desc":'雄性孕育後代，顛覆了自然的法則。' },
    { "id":'e01', "name":'鯊魚',     "rarity":'epic',      "emoji":'🦈', "power":55, "desc":'四億年的演化使其成為完美的獵者。' },
    { "id":'l01', "name":'藍鯨',     "rarity":'legendary', "emoji":'🌊', "power":99, "desc":'地球上最大的生命，以低鳴振動整片海洋。' }
]

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
    redeem_item = body.get("redeemItem")
    redeem_cost = body.get("redeemCost", 0)
    
    if not user_id:
        return jsonify({"error": "userId 為必填"}), 400
        
    conn = get_db()
    c = conn.cursor()
    
    c.execute("SELECT SUM(points) as balance FROM ledger WHERE user_id = ?", (user_id,))
    row = c.fetchone()
    balance = row["balance"] if row and row["balance"] else 0
    
    cost = redeem_cost if redeem_item else count * 10
    if balance < cost:
        conn.close()
        return jsonify({"error": "積點不足"}), 400
        
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    c.execute("SELECT hash FROM ledger ORDER BY rowid DESC LIMIT 1")
    row = c.fetchone()
    prev_hash = row["hash"] if row else "0"*64
    
    action_type = "redeem_item" if redeem_item else f"draw_{count}"
    tx_hash = compute_hash(prev_hash, action_type, -cost, user_id, timestamp)
    
    tx_id = f"tx_{int(time.time())}"
    c.execute("INSERT INTO ledger (id, user_id, action_id, points, hash, prev_hash, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
              (tx_id, user_id, action_type, -cost, tx_hash, prev_hash, timestamp))
              
    tx_obj = {
        "id": tx_id, "userId": user_id, "actionId": action_type,
        "points": -cost, "prevHash": prev_hash, "hash": tx_hash, "timestamp": timestamp
    }
              
    if redeem_item:
        conn.commit()
        conn.close()
        return jsonify({"success": True, "transaction": tx_obj, "item": redeem_item}), 200
        
    drawn_cards = [draw_card() for _ in range(count)]
    new_records = []
    
    for card in drawn_cards:
        inst_id = f"inst_{uuid.uuid4().hex[:8]}"
        c.execute("INSERT INTO user_cards (instance_id, user_id, card_id, name, rarity, emoji, acquired_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
                  (inst_id, user_id, card["id"], card["name"], card["rarity"], card["emoji"], timestamp))
        new_records.append({
            "instanceId": inst_id, "cardId": card["id"], "name": card["name"],
            "rarity": card["rarity"], "emoji": card["emoji"], "acquiredAt": timestamp
        })
        
    conn.commit()
    conn.close()
    
    return jsonify({
        "success": True,
        "results": new_records,
        "transaction": tx_obj
    }), 200

@app.route("/api/cards/<user_id>", methods=["GET"])
def get_cards(user_id):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM user_cards WHERE user_id = ?", (user_id,))
    cards = []
    for row in c.fetchall():
        cards.append({
            "instanceId": row["instance_id"],
            "cardId": row["card_id"],
            "name": row["name"],
            "rarity": row["rarity"],
            "emoji": row["emoji"],
            "acquiredAt": row["acquired_at"]
        })
    conn.close()
    return jsonify({"cards": cards})

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
    return jsonify({"items": list(REWARD_ITEMS.values()), "userRedemptions": []})

@app.route("/api/token", methods=["POST"])
def redeem_token():
    body = request.get_json() or {}
    user_id = body.get("userId")
    item_id = body.get("itemId")
    if not user_id or not item_id:
        return jsonify({"error": "userId 與 itemId 為必填"}), 400
        
    item = REWARD_ITEMS.get(item_id)
    if not item: return jsonify({"error": "找不到此商品"}), 404
    
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT SUM(points) as balance FROM ledger WHERE user_id = ?", (user_id,))
    row = c.fetchone()
    balance = row["balance"] if row and row["balance"] else 0
    
    if balance < item["cost"]:
        conn.close()
        return jsonify({"error": "積點不足"}), 400
        
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    c.execute("SELECT hash FROM ledger ORDER BY rowid DESC LIMIT 1")
    row = c.fetchone()
    prev_hash = row["hash"] if row else "0"*64
    action_id = f"redeem_{item['name']}"
    tx_hash = compute_hash(prev_hash, action_id, -item["cost"], user_id, timestamp)
    
    tx_id = f"tx_{int(time.time())}"
    c.execute("INSERT INTO ledger (id, user_id, action_id, points, hash, prev_hash, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?)",
              (tx_id, user_id, action_id, -item["cost"], tx_hash, prev_hash, timestamp))
              
    conn.commit()
    conn.close()
    
    return jsonify({
        "success": True,
        "message": f"成功兌換「{item['name']}」！",
        "transaction": {
            "id": tx_id, "userId": user_id, "actionId": action_id,
            "points": -item["cost"], "prevHash": prev_hash, "hash": tx_hash, "timestamp": timestamp
        },
        "cost": item["cost"]
    }), 201

@app.route("/api/esg", methods=["GET"])
def get_esg():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT SUM(weight_gram) as collected FROM social_plastic WHERE type='collect'")
    col_row = c.fetchone()
    total_collected = col_row["collected"] if col_row and col_row["collected"] else 0
    
    c.execute("SELECT SUM(weight_gram) as sponsored FROM social_plastic WHERE type='sponsor'")
    spon_row = c.fetchone()
    total_sponsored = spon_row["sponsored"] if spon_row and spon_row["sponsored"] else 0
    
    c.execute("SELECT * FROM social_plastic ORDER BY rowid DESC LIMIT 20")
    txs = []
    for row in c.fetchall():
        txs.append({
            "id": row["id"], "type": row["type"], "weightGram": row["weight_gram"],
            "brand": row["brand"], "userId": row["user_id"],
            "hash": row["hash"], "prevHash": row["prev_hash"], "timestamp": row["timestamp"]
        })
    conn.close()
    return jsonify({
        "totalCollected": round(total_collected, 2),
        "totalSponsored": round(total_sponsored, 2),
        "transactions": txs
    })

@app.route("/api/esg", methods=["POST"])
def post_esg():
    body = request.get_json() or {}
    action = body.get("action", "collect")
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT hash FROM social_plastic ORDER BY rowid DESC LIMIT 1")
    row = c.fetchone()
    prev_hash = row["hash"] if row else "0"*40
    
    if action == "sponsor":
        brand = body.get("brand", "Henkel 漢高")
        amount = float(body.get("amount", 10))
        
        c.execute("SELECT SUM(weight_gram) as collected FROM social_plastic WHERE type='collect'")
        col_row = c.fetchone()
        c.execute("SELECT SUM(weight_gram) as sponsored FROM social_plastic WHERE type='sponsor'")
        spon_row = c.fetchone()
        
        total_collected = col_row["collected"] if col_row and col_row["collected"] else 0
        total_sponsored = spon_row["sponsored"] if spon_row and spon_row["sponsored"] else 0
        
        available = total_collected - total_sponsored
        if available <= 0:
            conn.close()
            return jsonify({"error": "目前沒有尚未贊助的 Social Plastic® 可以收購。"}), 400
            
        actual = min(amount, available)
        tx_hash = compute_hash(prev_hash, "sponsor", actual, "system", timestamp)[:40]
        tx_id = f"sp_{int(time.time())}_sponsor"
        
        c.execute("INSERT INTO social_plastic (id, type, weight_gram, brand, user_id, hash, prev_hash, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                  (tx_id, "sponsor", actual, brand, "system", tx_hash, prev_hash, timestamp))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"{brand} 成功收購並認證了 {actual}g 的 Social Plastic®！"}), 201
    else:
        user_id = body.get("userId", "anonymous")
        weight = float(body.get("weight", 0.42))
        tx_hash = compute_hash(prev_hash, "collect", weight, user_id, timestamp)[:40]
        tx_id = f"sp_{int(time.time())}_collect"
        
        c.execute("INSERT INTO social_plastic (id, type, weight_gram, brand, user_id, hash, prev_hash, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                  (tx_id, "collect", weight, "", user_id, tx_hash, prev_hash, timestamp))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"已記錄 {weight}g Social Plastic® 貢獻。"}), 201

# --- Missing Routes ---
@app.route("/api/progress", methods=["GET"])
def get_progress():
    user_id = request.args.get("deviceId")
    if not user_id: return jsonify({"error": "deviceId required"}), 400
    
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT timestamp FROM actions WHERE user_id = ?", (user_id,))
    actions = [row["timestamp"][:10] for row in c.fetchall()]
    conn.close()
    
    unique_days = sorted(list(set(actions)))
    stamp_count = min(len(unique_days), 5)
    
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
        "totalActions": len(actions)
    })

@app.route("/api/metrics", methods=["GET"])
def get_metrics():
    month = request.args.get("month", time.strftime("%Y-%m"))
    
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT user_id, reduction_gram, coast_id FROM actions WHERE timestamp LIKE ?", (f"{month}%",))
    actions = [dict(row) for row in c.fetchall()]
    conn.close()
    
    unique_people = len(set(a["user_id"] for a in actions))
    total_reduction = sum(a["reduction_gram"] for a in actions if a["reduction_gram"])
    
    by_coast = {}
    for a in actions:
        cid = a["coast_id"] or "kl1"
        by_coast[cid] = by_coast.get(cid, 0) + 1
        
    return jsonify({
        "month": month,
        "actionCount": len(actions),
        "participantCount": unique_people,
        "reductionGram": round(total_reduction, 2),
        "byCoast": by_coast
    })

@app.route("/api/coasts", methods=["GET"])
def get_coasts():
    return jsonify({"items": []}) # Replaced by frontend static state

@app.route("/api/shops", methods=["GET"])
def get_shops():
    return jsonify({"items": []})

@app.after_request
def add_header(response):
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    response.headers['Expires'] = '-1'
    return response

@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=8080)
