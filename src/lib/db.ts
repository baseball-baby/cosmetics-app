import Database from 'better-sqlite3'
import path from 'path'
import fs from 'fs'

export const DATA_DIR = path.join(process.cwd(), 'data')
export const UPLOADS_DIR_PATH = path.join(DATA_DIR, 'uploads')
const DB_PATH = path.join(DATA_DIR, 'cosmetics.db')

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
}

const UPLOADS_DIR = UPLOADS_DIR_PATH
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true })
}

// Migrate legacy uploads from public/uploads/ to data/uploads/
const LEGACY_UPLOADS = path.join(process.cwd(), 'public', 'uploads')
if (fs.existsSync(LEGACY_UPLOADS)) {
  try {
    for (const f of fs.readdirSync(LEGACY_UPLOADS)) {
      const src = path.join(LEGACY_UPLOADS, f)
      const dst = path.join(UPLOADS_DIR, f)
      if (!fs.existsSync(dst)) fs.renameSync(src, dst)
    }
  } catch {}
}

let _db: Database.Database | null = null

export function getDb(): Database.Database {
  if (_db) return _db

  _db = new Database(DB_PATH)
  _db.pragma('journal_mode = WAL')
  _db.pragma('foreign_keys = ON')
  initSchema(_db)
  return _db
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS cosmetics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      brand TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      shade_name TEXT,
      shade_description TEXT,
      official_description TEXT,
      official_positioning TEXT,
      personal_notes TEXT,
      expiry_date TEXT,
      purchase_date TEXT,
      price REAL,
      photo_url TEXT,
      color_verdict TEXT,
      color_verdict_reason TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS color_profile (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      skin_tone_description TEXT,
      skin_type TEXT,
      undertone TEXT,
      undertone_confidence TEXT,
      depth TEXT,
      skin_concerns TEXT,
      makeup_preferences TEXT,
      suitable_foundation_shades TEXT,
      color_analysis_summary TEXT,
      analysis_photo_urls TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS shade_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cosmetic_id INTEGER REFERENCES cosmetics(id) ON DELETE SET NULL,
      photo_url TEXT,
      ai_verdict TEXT NOT NULL,
      ai_analysis TEXT NOT NULL,
      is_current INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    );
  `)

  // Migrations
  try { db.exec('ALTER TABLE cosmetics ADD COLUMN photo_urls TEXT') } catch {}
  try { db.exec('ALTER TABLE cosmetics ADD COLUMN sub_tags TEXT') } catch {}
  try { db.exec('ALTER TABLE cosmetics ADD COLUMN color_data TEXT') } catch {}
  try { db.exec('ALTER TABLE color_profile ADD COLUMN shade_notes TEXT') } catch {}

  db.exec(`
    CREATE TABLE IF NOT EXISTS advice_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      ai_answer TEXT NOT NULL,
      user_correction TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
    )
  `)

  const row = db.prepare('SELECT COUNT(*) as cnt FROM color_profile').get() as { cnt: number }
  if (row.cnt === 0) {
    db.prepare("INSERT INTO color_profile (id, updated_at) VALUES (1, datetime('now','localtime'))").run()
  }
}
