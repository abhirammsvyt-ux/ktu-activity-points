const bcrypt = require('bcryptjs');
const path = require('path');

let db;
try {
  const { Database } = require('node-sqlite3-wasm');
  const DB_PATH = process.env.VERCEL
    ? path.join('/tmp', 'ktu_points.db')
    : path.join(__dirname, '..', 'ktu_points.db');
  db = new Database(DB_PATH);
  db.exec('PRAGMA foreign_keys=ON');
  console.log('[DB] Using SQLite WASM Engine.');
} catch (err) {
  console.warn('[DB Warning] node-sqlite3-wasm init failed:', err.message);
  console.log('[DB] Falling back to Pure JS Database Store for Vercel Serverless environment.');
  const JsDatabase = require('./engine/jsDb');
  db = new JsDatabase();
}

function initializeDatabase() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS students (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      roll_number TEXT    UNIQUE NOT NULL,
      name        TEXT    NOT NULL,
      email       TEXT    UNIQUE,
      password_hash TEXT  NOT NULL,
      department  TEXT    NOT NULL,
      batch_year  INTEGER NOT NULL,
      created_at  DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS password_resets (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      email       TEXT    NOT NULL,
      otp         TEXT    NOT NULL,
      expires_at  DATETIME NOT NULL,
      used        INTEGER DEFAULT 0,
      created_at  DATETIME DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS admins (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      username      TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activities (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id       INTEGER NOT NULL REFERENCES students(id) ON DELETE CASCADE,
      semester         TEXT    NOT NULL,
      category         TEXT    NOT NULL,
      sub_category     TEXT    NOT NULL,
      level            TEXT,
      achievement      TEXT,
      institution_type TEXT,
      document_path    TEXT,
      document_type    TEXT,
      extra_details    TEXT DEFAULT '{}',
      calculated_points REAL NOT NULL DEFAULT 0,
      status           TEXT NOT NULL DEFAULT 'pending',
      admin_remarks    TEXT,
      submitted_at     DATETIME DEFAULT (datetime('now')),
      verified_at      DATETIME
    );

    CREATE INDEX IF NOT EXISTS idx_activities_student ON activities(student_id);
    CREATE INDEX IF NOT EXISTS idx_activities_semester ON activities(semester);
    CREATE INDEX IF NOT EXISTS idx_activities_status   ON activities(status);
    CREATE INDEX IF NOT EXISTS idx_resets_email        ON password_resets(email);
  `);

  // Safe migration: Add email column to students table if missing
  try {
    const columns = db.prepare("PRAGMA table_info(students)").all([]);
    const hasEmail = Array.isArray(columns) && columns.some(c => c && c.name === 'email');
    if (!hasEmail) {
      db.exec("ALTER TABLE students ADD COLUMN email TEXT;");
      console.log('[DB] Migrated students table: added email column.');
    }
  } catch (err) {
    console.warn('[DB Migration Warning]', err.message);
  }

  // Seed default admin if not exists
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(['admin']);
  if (!existing) {
    const hash = bcrypt.hashSync('admin123', 10);
    db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run(['admin', hash]);
    console.log('[DB] Default admin created: username=admin, password=admin123');
  }

  console.log('[DB] Database initialized successfully.');
}

module.exports = { db, initializeDatabase };
