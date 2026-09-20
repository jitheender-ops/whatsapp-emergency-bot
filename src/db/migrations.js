import { getDb, runSql } from './database.js';

/**
 * Run all database migrations.
 * Creates tables if they don't exist. Safe to call multiple times.
 */
export async function runMigrations() {
  const db = await getDb();

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      name TEXT,
      blood_group TEXT,
      city TEXT,
      latitude REAL,
      longitude REAL,
      is_donor INTEGER DEFAULT 0,
      is_available INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS blood_requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      requester_phone TEXT NOT NULL,
      blood_group TEXT NOT NULL,
      city TEXT,
      latitude REAL,
      longitude REAL,
      units_needed INTEGER DEFAULT 1,
      hospital_name TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT (datetime('now')),
      expires_at TEXT DEFAULT (datetime('now', '+24 hours')),
      FOREIGN KEY (requester_phone) REFERENCES users(phone) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS donor_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      request_id INTEGER NOT NULL,
      donor_phone TEXT NOT NULL,
      responded INTEGER DEFAULT 0,
      response TEXT,
      notified_at TEXT DEFAULT (datetime('now')),
      responded_at TEXT,
      FOREIGN KEY (request_id) REFERENCES blood_requests(id) ON DELETE CASCADE
    )
  `);

  // Indexes — wrap in try/catch since CREATE INDEX IF NOT EXISTS
  // is supported but we want to be safe
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_users_blood_group ON users(blood_group)',
    'CREATE INDEX IF NOT EXISTS idx_users_city ON users(city)',
    'CREATE INDEX IF NOT EXISTS idx_users_donor ON users(is_donor, is_available)',
    'CREATE INDEX IF NOT EXISTS idx_blood_requests_status ON blood_requests(status)',
    'CREATE INDEX IF NOT EXISTS idx_blood_requests_blood_group ON blood_requests(blood_group)',
    'CREATE INDEX IF NOT EXISTS idx_donor_notifications_request ON donor_notifications(request_id)',
  ];

  for (const idx of indexes) {
    db.run(idx);
  }

  // Save after schema changes
  const { saveDb } = await import('./database.js');
  saveDb();

  console.log('✅ Database migrations completed');
}
