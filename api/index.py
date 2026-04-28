from flask import Flask, request, jsonify, send_from_directory
import os
import json
import time
import hashlib
import uuid
import random
from .db import get_db, init_db

app = Flask(__name__, static_folder='../', static_url_path='/')

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
    
    c.execute("SELECT id FROM users WHERE email = %s", (email,))
    if c.fetchone():
        return jsonify({"error": "該信箱已被註冊"}), 400
    
    user_id = "u_" + str(int(time.time()))
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    display_name = display_name or email.split("@")[0]
    
    c.execute("INSERT INTO users (id, email, password, display_name, created_at) VALUES (%s, %s, %s, %s, %s)",
              (user_id, email, password, display_name, created_at))
    
    # 註冊送積點
    c.execute("SELECT hash FROM ledger ORDER BY auto_id DESC LIMIT 1")
    row = c.fetchone()
    prev_hash = row["hash"] if row else "0"*64
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    tx_hash = compute_hash(prev_hash, "register_bonus", 30, user_id, timestamp)
    
    tx_id = f"tx_{int(time.time())}"
    c.execute("INSERT INTO ledger (id, user_id, action_id, points, hash, prev_hash, timestamp) VALUES (%s, %s, %s, %s, %s, %s, %s)",
              (tx_id, user_id, "register_bonus", 30, tx_hash, prev_hash, timestamp))
              
    token = f"{user_id}::{uuid.uuid4()}"
    c.execute("INSERT INTO sessions (token, user_id, created_at) VALUES (%s, %s, %s)",
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
    c.execute("SELECT id, display_name FROM users WHERE email = %s AND password = %s", (email, password))
    user = c.fetchone()
    
    if not user:
        c.execute("SELECT id FROM users WHERE email = %s", (email,))
        if c.fetchone():
            conn.close()
            return jsonify({"error": "密碼錯誤，請重新輸入"}), 401
        else:
            conn.close()
            return jsonify({"error": "此信箱尚未註冊，請先建立帳號"}), 401
        
    token = f"{user['id']}::{uuid.uuid4()}"
    created_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    c.execute("INSERT INTO sessions (token, user_id, created_at) VALUES (%s, %s, %s)",
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
    if not token or "::" not in token:
        return jsonify({"valid": False}), 401
        
    user_id = token.split("::")[0]
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT display_name FROM users WHERE id = %s", (user_id,))
    user = c.fetchone()
    
    if not user:
        conn.close()
        return jsonify({"valid": False, "error": "Session 已失效，請重新登入"}), 401
        
    display_name = user["display_name"]
    conn.close()
    
    return jsonify({
        "valid": True,
        "userId": user_id,
        "displayName": display_name or "守護者"
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
    
    c.execute("INSERT INTO actions (id, user_id, coast_id, verified_items, reduction_gram, timestamp) VALUES (%s, %s, %s, %s, %s, %s)",
              (action_id, user_id, coast_id, json.dumps(items), round(reduction, 2), timestamp))
              
    c.execute("SELECT hash FROM ledger ORDER BY auto_id DESC LIMIT 1")
    row = c.fetchone()
    prev_hash = row["hash"] if row else "0"*64
    tx_hash = compute_hash(prev_hash, action_id, points_earned, user_id, timestamp)
    
    tx_id = f"tx_{int(time.time())}"
    c.execute("INSERT INTO ledger (id, user_id, action_id, points, hash, prev_hash, timestamp) VALUES (%s, %s, %s, %s, %s, %s, %s)",
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
    
    c.execute("SELECT SUM(points) as balance FROM ledger WHERE user_id = %s", (user_id,))
    row = c.fetchone()
    balance = row["balance"] if row and row["balance"] else 0
    
    c.execute("SELECT * FROM ledger WHERE user_id = %s ORDER BY auto_id DESC LIMIT 20", (user_id,))
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
    
    c.execute("SELECT SUM(points) as balance FROM ledger WHERE user_id = %s", (user_id,))
    row = c.fetchone()
    balance = row["balance"] if row and row["balance"] else 0
    
    cost = redeem_cost if redeem_item else count * 10
    if balance < cost:
        conn.close()
        return jsonify({"error": "積點不足"}), 400
        
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    c.execute("SELECT hash FROM ledger ORDER BY auto_id DESC LIMIT 1")
    row = c.fetchone()
    prev_hash = row["hash"] if row else "0"*64
    
    action_type = "redeem_item" if redeem_item else f"draw_{count}"
    tx_hash = compute_hash(prev_hash, action_type, -cost, user_id, timestamp)
    
    tx_id = f"tx_{int(time.time())}"
    c.execute("INSERT INTO ledger (id, user_id, action_id, points, hash, prev_hash, timestamp) VALUES (%s, %s, %s, %s, %s, %s, %s)",
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
        c.execute("INSERT INTO user_cards (instance_id, user_id, card_id, name, rarity, emoji, acquired_at) VALUES (%s, %s, %s, %s, %s, %s, %s)",
                  (inst_id, user_id, card["id"], card["name"], card["rarity"], card["emoji"], timestamp))
        new_records.append({
            "instanceId": inst_id, "cardId": card["id"], "name": card["name"],
            "rarity": card["rarity"], "emoji": card["emoji"], "acquiredAt": timestamp,
            "power": card["power"], "desc": card["desc"]
        })
        
    conn.commit()
    conn.close()
    
    return jsonify({
        "success": True,
        "drawnCards": new_records,
        "transaction": tx_obj,
        "newBalance": balance - cost,
        "cost": cost
    }), 200

@app.route("/api/cards/<user_id>", methods=["GET"])
def get_cards(user_id):
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT * FROM user_cards WHERE user_id = %s", (user_id,))
    cards = []
    stats = {"common": 0, "rare": 0, "epic": 0, "legendary": 0}
    for row in c.fetchall():
        card_id = row["card_id"]
        rarity = row["rarity"]
        if rarity in stats:
            stats[rarity] += 1
        pool_card = next((c for c in CARD_POOL if c["id"] == card_id), None)
        if not pool_card:
            pool_card = REWARD_ITEMS.get(card_id, {})
        cards.append({
            "instanceId": row["instance_id"],
            "cardId": card_id,
            "name": row["name"],
            "rarity": rarity,
            "emoji": row["emoji"],
            "acquiredAt": row["acquired_at"],
            "power": pool_card.get("power", 0),
            "desc": pool_card.get("desc", "")
        })
    conn.close()
    return jsonify({"cards": cards, "stats": stats, "total": len(cards)})

# --- Token / ESG API ---
REWARD_ITEMS = {
    "r1": {"name": "海洋淨灘手套", "cost": 30, "stock": 50, "emoji": "🧤", "desc": "100%再生材料製成的環保手套", "power": 30},
    "r2": {"name": "珊瑚守護貼紙", "cost": 15, "stock": 100, "emoji": "🏷️", "desc": "可貼於自備杯上的防水環保貼紙組", "power": 15},
    "r3": {"name": "海洋不鏽鋼吸管", "cost": 50, "stock": 30, "emoji": "🥤", "desc": "附清潔刷與收納袋的醫療級吸管", "power": 50},
    "r4": {"name": "友善店家折價券", "cost": 40, "stock": 80, "emoji": "🎫", "desc": "共生店家通用消費折抵 50 元", "power": 40},
    "r5": {"name": "海龜T-shirt", "cost": 150, "stock": 10, "emoji": "👕", "desc": "Henkel ESG 聯名有機棉 T-shirt", "power": 150},
    "r6": {"name": "海洋繪本", "cost": 100, "stock": 20, "emoji": "📘", "desc": "《這片海，離我多遠？》精裝繪本", "power": 100},
    "r7": {"name": "減塑環保餐盒", "cost": 60, "stock": 40, "emoji": "🍱", "desc": "小麥纖維可分解便當盒", "power": 60},
    "r8": {"name": "Social Plastic® 認證NFT", "cost": 200, "stock": 999, "emoji": "🔗", "desc": "你的環保貢獻永久上鏈數位認證", "power": 200},
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
    c.execute("SELECT SUM(points) as balance FROM ledger WHERE user_id = %s", (user_id,))
    row = c.fetchone()
    balance = row["balance"] if row and row["balance"] else 0
    
    if balance < item["cost"]:
        conn.close()
        return jsonify({"error": "積點不足"}), 400
        
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    c.execute("SELECT hash FROM ledger ORDER BY auto_id DESC LIMIT 1")
    row = c.fetchone()
    prev_hash = row["hash"] if row else "0"*64
    action_id = f"redeem_{item['name']}"
    tx_hash = compute_hash(prev_hash, action_id, -item["cost"], user_id, timestamp)
    
    tx_id = f"tx_{int(time.time())}"
    c.execute("INSERT INTO ledger (id, user_id, action_id, points, hash, prev_hash, timestamp) VALUES (%s, %s, %s, %s, %s, %s, %s)",
              (tx_id, user_id, action_id, -item["cost"], tx_hash, prev_hash, timestamp))
              
    # Add redeemed item to user_cards so it appears in collection
    inst_id = f"inst_{uuid.uuid4().hex[:8]}"
    emoji = item.get("emoji", "🎁")
    c.execute("INSERT INTO user_cards (instance_id, user_id, card_id, name, rarity, emoji, acquired_at) VALUES (%s, %s, %s, %s, %s, %s, %s)",
              (inst_id, user_id, item_id, item["name"], "legendary", emoji, timestamp))
              
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
    
    c.execute("SELECT * FROM social_plastic ORDER BY auto_id DESC LIMIT 20")
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
    c.execute("SELECT hash FROM social_plastic ORDER BY auto_id DESC LIMIT 1")
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
        
        c.execute("INSERT INTO social_plastic (id, type, weight_gram, brand, user_id, hash, prev_hash, timestamp) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                  (tx_id, "sponsor", actual, brand, "system", tx_hash, prev_hash, timestamp))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"{brand} 成功收購並認證了 {actual}g 的 Social Plastic®！"}), 201
    else:
        user_id = body.get("userId", "anonymous")
        weight = float(body.get("weight", 0.42))
        tx_hash = compute_hash(prev_hash, "collect", weight, user_id, timestamp)[:40]
        tx_id = f"sp_{int(time.time())}_collect"
        
        c.execute("INSERT INTO social_plastic (id, type, weight_gram, brand, user_id, hash, prev_hash, timestamp) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                  (tx_id, "collect", weight, "", user_id, tx_hash, prev_hash, timestamp))
        conn.commit()
        conn.close()
        return jsonify({"success": True, "message": f"已記錄 {weight}g Social Plastic® 貢獻。"}), 201

# --- Photos & Submissions ---
@app.route("/api/submissions", methods=["POST"])
def submit_photo():
    body = request.get_json() or {}
    user_id = body.get("userId", "demo_user")
    coast_id = body.get("coastId")
    photo_url = body.get("photoUrl")
    nickname = body.get("nickname")
    location_name = body.get("locationName")
    story = body.get("story")
    
    if not photo_url or not coast_id:
        return jsonify({"error": "缺少照片或海域資訊"}), 400
        
    conn = get_db()
    c = conn.cursor()
    photo_id = f"photo_{int(time.time())}_{uuid.uuid4().hex[:4]}"
    timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    
    c.execute("INSERT INTO photos (id, user_id, coast_id, photo_url, nickname, location_name, story, timestamp) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
              (photo_id, user_id, coast_id, photo_url, nickname, location_name, story, timestamp))
              
    # Give 15 points for submission
    c.execute("SELECT hash FROM ledger ORDER BY auto_id DESC LIMIT 1")
    row = c.fetchone()
    prev_hash = row["hash"] if row else "0"*64
    action_id = "photo_submission"
    tx_hash = compute_hash(prev_hash, action_id, 15, user_id, timestamp)
    tx_id = f"tx_{int(time.time())}"
    
    c.execute("INSERT INTO ledger (id, user_id, action_id, points, hash, prev_hash, timestamp) VALUES (%s, %s, %s, %s, %s, %s, %s)",
              (tx_id, user_id, action_id, 15, tx_hash, prev_hash, timestamp))
              
    conn.commit()
    conn.close()
    return jsonify({"success": True}), 201

@app.route("/api/photos/random", methods=["GET"])
def get_random_photo():
    coast_id = request.args.get("coastId")
    conn = get_db()
    c = conn.cursor()
    
    if coast_id:
        c.execute("SELECT * FROM photos WHERE coast_id = %s ORDER BY RANDOM() LIMIT 1", (coast_id,))
    else:
        c.execute("SELECT * FROM photos ORDER BY RANDOM() LIMIT 1")
        
    row = c.fetchone()
    conn.close()
    
    if not row:
        return jsonify({"item": {}})
        
    return jsonify({
        "item": {
            "photoUrl": row["photo_url"],
            "nickname": row["nickname"],
            "locationName": row["location_name"],
            "story": row["story"]
        }
    })

# --- Missing Routes ---
@app.route("/api/progress", methods=["GET"])
def get_progress():
    user_id = request.args.get("deviceId")
    if not user_id: return jsonify({"error": "deviceId required"}), 400
    
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT timestamp FROM actions WHERE user_id = %s", (user_id,))
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
    c.execute("SELECT user_id, reduction_gram, coast_id FROM actions WHERE timestamp LIKE %s", (f"{month}%",))
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

@app.route('/')
def serve_index():
    return send_from_directory('../', 'index.html')

@app.route('/<path:path>')
def serve_static_files(path):
    if os.path.exists(os.path.join('../', path)):
        return send_from_directory('../', path)
    return jsonify({"error": "Not found"}), 404

@app.errorhandler(Exception)
def handle_exception(e):
    return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(port=8080)
