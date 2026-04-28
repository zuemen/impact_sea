import psycopg2
from psycopg2.extras import RealDictCursor
import os
import time

DATABASE_URL = os.environ.get("DATABASE_URL")

def get_db():
    # 使用 RealDictCursor 讓回傳結果像字典，取代 sqlite3.Row
    conn = psycopg2.connect(DATABASE_URL, cursor_factory=RealDictCursor)
    conn.autocommit = True
    return conn

def init_db():
    if not DATABASE_URL:
        print("DATABASE_URL not found. Skipping DB init.")
        return
        
    conn = get_db()
    c = conn.cursor()
    
    # 建立資料表 (PostgreSQL 語法)
    # 注意：我們加入了 auto_id 欄位來替代 SQLite 的 rowid
    c.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        display_name TEXT,
        points DOUBLE PRECISION DEFAULT 0,
        created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT,
        created_at TEXT
    );
    CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        coast_id TEXT,
        verified_items TEXT,
        reduction_gram DOUBLE PRECISION,
        timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS ledger (
        auto_id SERIAL,
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action_id TEXT,
        points DOUBLE PRECISION,
        hash TEXT,
        prev_hash TEXT,
        timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS user_cards (
        instance_id TEXT PRIMARY KEY,
        user_id TEXT,
        card_id TEXT,
        name TEXT,
        rarity TEXT,
        emoji TEXT,
        acquired_at TEXT
    );
    CREATE TABLE IF NOT EXISTS social_plastic (
        auto_id SERIAL,
        id TEXT PRIMARY KEY,
        type TEXT,
        weight_gram DOUBLE PRECISION,
        brand TEXT,
        user_id TEXT,
        hash TEXT,
        prev_hash TEXT,
        timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS photos (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        coast_id TEXT,
        photo_url TEXT,
        nickname TEXT,
        location_name TEXT,
        story TEXT,
        timestamp TEXT
    );
    """)
    conn.close()

# Ensure schema exists on startup
try:
    init_db()
except Exception as e:
    print("DB Init Error:", e)
