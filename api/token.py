"""
OceanToken (OCT) 代幣兌換 Python API
Vercel Serverless Function
1 PTS = 1 OCT
"""

from http.server import BaseHTTPRequestHandler
import json
import hashlib
import time
import os

# Vercel serverless 的臨時存儲路徑
DATA_DIR = "/tmp/data"

def ensure_data():
    os.makedirs(DATA_DIR, exist_ok=True)
    ledger_path = os.path.join(DATA_DIR, "redemptions.json")
    if not os.path.exists(ledger_path):
        with open(ledger_path, "w") as f:
            json.dump([], f)

def read_redemptions():
    ensure_data()
    path = os.path.join(DATA_DIR, "redemptions.json")
    try:
        with open(path, "r") as f:
            return json.load(f)
    except:
        return []

def write_redemptions(data):
    ensure_data()
    path = os.path.join(DATA_DIR, "redemptions.json")
    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def compute_hash(prev_hash, user_id, item_name, cost, timestamp):
    """計算區塊鏈交易 hash"""
    data = f"OCT|{prev_hash}|{user_id}|{item_name}|{cost}|{timestamp}"
    return hashlib.sha256(data.encode()).hexdigest()[:40]

# 可兌換商品列表
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


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """GET /api/token?userId=xxx — 查詢兌換紀錄"""
        from urllib.parse import urlparse, parse_qs
        query = parse_qs(urlparse(self.path).query)
        user_id = query.get("userId", [None])[0]

        redemptions = read_redemptions()
        user_redemptions = [r for r in redemptions if r.get("userId") == user_id] if user_id else []

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({
            "items": list(REWARD_ITEMS.values()),
            "userRedemptions": user_redemptions,
            "totalRedemptions": len(redemptions),
        }, ensure_ascii=False).encode())

    def do_POST(self):
        """POST /api/token — 兌換商品"""
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        user_id = body.get("userId")
        item_id = body.get("itemId")

        if not user_id or not item_id:
            self._send_error(400, "userId 與 itemId 為必填")
            return

        item = REWARD_ITEMS.get(item_id)
        if not item:
            self._send_error(404, "找不到此商品")
            return

        # 記錄兌換交易（區塊鏈 hash）
        redemptions = read_redemptions()
        prev_hash = redemptions[-1]["hash"] if redemptions else "0" * 40
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        tx_hash = compute_hash(prev_hash, user_id, item["name"], item["cost"], timestamp)

        tx = {
            "id": f"redeem_{int(time.time())}_{item_id}",
            "userId": user_id,
            "itemId": item_id,
            "itemName": item["name"],
            "cost": item["cost"],
            "prevHash": prev_hash,
            "hash": tx_hash,
            "timestamp": timestamp,
        }
        redemptions.append(tx)
        write_redemptions(redemptions)

        self.send_response(201)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({
            "success": True,
            "message": f"成功兌換「{item['name']}」！",
            "transaction": tx,
            "cost": item["cost"],
        }, ensure_ascii=False).encode())

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "*")
        self.end_headers()

    def _send_error(self, code, msg):
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({"error": msg}, ensure_ascii=False).encode())
