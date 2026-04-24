"""
Social Plastic® ESG 認證 Python API
Vercel Serverless Function
模擬區塊鏈透明帳本 + 品牌贊助收購
"""

from http.server import BaseHTTPRequestHandler
import json
import hashlib
import time
import os

DATA_DIR = "/tmp/data"

def ensure_data():
    os.makedirs(DATA_DIR, exist_ok=True)
    sp_path = os.path.join(DATA_DIR, "social-plastic.json")
    if not os.path.exists(sp_path):
        with open(sp_path, "w") as f:
            json.dump({
                "totalCollected": 0,
                "totalSponsored": 0,
                "transactions": []
            }, f)

def read_sp():
    ensure_data()
    path = os.path.join(DATA_DIR, "social-plastic.json")
    try:
        with open(path, "r") as f:
            return json.load(f)
    except:
        return {"totalCollected": 0, "totalSponsored": 0, "transactions": []}

def write_sp(data):
    ensure_data()
    path = os.path.join(DATA_DIR, "social-plastic.json")
    with open(path, "w") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

def compute_sp_hash(prev_hash, tx_type, weight, user_id, brand, timestamp):
    """計算 Social Plastic 區塊鏈交易 hash"""
    data = f"SP|{prev_hash}|{tx_type}|{weight}|{user_id}|{brand}|{timestamp}"
    return hashlib.sha256(data.encode()).hexdigest()[:40]


class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        """GET /api/esg — 查詢 Social Plastic® 總覽"""
        sp_data = read_sp()

        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(json.dumps({
            "totalCollected": round(sp_data["totalCollected"], 2),
            "totalSponsored": round(sp_data["totalSponsored"], 2),
            "transactions": sp_data["transactions"][-20:],  # 最新 20 筆
        }, ensure_ascii=False).encode())

    def do_POST(self):
        """POST /api/esg — 記錄環保貢獻或品牌贊助"""
        content_length = int(self.headers.get("Content-Length", 0))
        body = json.loads(self.rfile.read(content_length)) if content_length > 0 else {}

        action = body.get("action", "collect")  # "collect" 或 "sponsor"

        sp_data = read_sp()
        txs = sp_data["transactions"]
        prev_hash = txs[-1]["hash"] if txs else "0" * 40
        timestamp = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())

        if action == "sponsor":
            # 品牌贊助收購
            brand = body.get("brand", "Henkel 漢高")
            amount = float(body.get("amount", 10))
            available = sp_data["totalCollected"] - sp_data["totalSponsored"]

            if available <= 0:
                self._send_error(400, "目前沒有尚未贊助的 Social Plastic® 可以收購。")
                return

            actual = min(amount, available)
            tx_hash = compute_sp_hash(prev_hash, "sponsor", actual, "system", brand, timestamp)

            tx = {
                "id": f"sp_{int(time.time())}_sponsor",
                "type": "sponsor",
                "weightGram": round(actual, 2),
                "brand": brand,
                "userId": "system",
                "prevHash": prev_hash,
                "hash": tx_hash,
                "timestamp": timestamp,
            }
            txs.append(tx)
            sp_data["totalSponsored"] = round(sp_data["totalSponsored"] + actual, 2)
            write_sp(sp_data)

            self.send_response(201)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "message": f"{brand} 成功收購並認證了 {actual}g 的 Social Plastic®！",
                "transaction": tx,
                "totalCollected": sp_data["totalCollected"],
                "totalSponsored": sp_data["totalSponsored"],
            }, ensure_ascii=False).encode())

        else:
            # 記錄環保貢獻
            user_id = body.get("userId", "anonymous")
            weight = float(body.get("weight", round(0.3 + (time.time() % 30) / 100, 2)))
            tx_hash = compute_sp_hash(prev_hash, "collect", weight, user_id, "", timestamp)

            tx = {
                "id": f"sp_{int(time.time())}_collect",
                "type": "collect",
                "weightGram": round(weight, 2),
                "userId": user_id,
                "brand": "",
                "prevHash": prev_hash,
                "hash": tx_hash,
                "timestamp": timestamp,
            }
            txs.append(tx)
            sp_data["totalCollected"] = round(sp_data["totalCollected"] + weight, 2)
            write_sp(sp_data)

            self.send_response(201)
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            self.wfile.write(json.dumps({
                "success": True,
                "message": f"已記錄 {weight}g Social Plastic® 貢獻。",
                "transaction": tx,
                "totalCollected": sp_data["totalCollected"],
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
