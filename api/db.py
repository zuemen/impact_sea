import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db", "impact.db")

def get_db():
    conn = sqlite3.connect(DB_PATH, isolation_level=None)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password TEXT,
        display_name TEXT,
        points REAL DEFAULT 0,
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
        reduction_gram REAL,
        timestamp TEXT
    );
    CREATE TABLE IF NOT EXISTS ledger (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        action_id TEXT,
        points REAL,
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
        id TEXT PRIMARY KEY,
        type TEXT,
        weight_gram REAL,
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
