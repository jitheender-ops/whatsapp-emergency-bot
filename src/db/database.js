import initSqlJs from 'sql.js';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', '..', 'data', 'emergency_bot.db');

/** @type {import('sql.js').Database|null} */
let db = null;

/** File backing the open db; null for in-memory (tests) so they never overwrite real data. */
let dbPath = null;

/** @type {import('sql.js').SqlJsStatic|null} */
let SQL = null;

/**
 * Initialize the SQL.js engine (loads the WASM binary).
 * Must be called once before any database operations.
 */
async function initEngine() {
  if (!SQL) {
    SQL = await initSqlJs();
  }
  return SQL;
}

/**
 * Get the database instance (singleton).
 * Creates the data directory and loads existing DB file or creates a new one.
 * @returns {Promise<import('sql.js').Database>}
 */
export async function getDb() {
  if (db) return db;

  await initEngine();

  // Ensure data directory exists
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Load existing database or create a new one
  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }
  dbPath = DB_PATH;

  // Enable WAL-like behavior and foreign keys
  db.run('PRAGMA foreign_keys = ON');

  console.log(`✅ Database connected at ${DB_PATH}`);
  return db;
}

/**
 * Initialize the database with a custom path or in-memory (for testing).
 * @param {string} [customPath] - Optional custom path. Pass ':memory:' for in-memory.
 * @returns {Promise<import('sql.js').Database>}
 */
export async function initDb(customPath) {
  if (db) {
    saveDb();
    db.close();
  }

  await initEngine();

  dbPath = customPath === ':memory:' || !customPath ? null : customPath;
  if (!dbPath) {
    db = new SQL.Database();
  } else {
    const dataDir = path.dirname(customPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }
    if (fs.existsSync(customPath)) {
      const fileBuffer = fs.readFileSync(customPath);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
    }
  }

  db.run('PRAGMA foreign_keys = ON');
  return db;
}

/**
 * Save the current database state to disk.
 * sql.js operates in-memory, so we need to explicitly persist.
 */
export function saveDb() {
  if (!db || !dbPath) return;
  const data = db.export();
  const buffer = Buffer.from(data);

  const dataDir = path.dirname(dbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(dbPath, buffer);
}

/**
 * Close the database connection gracefully.
 * Saves to disk before closing.
 */
export function closeDb() {
  if (db) {
    saveDb();
    db.close();
    db = null;
    console.log('Database connection closed');
  }
}

/**
 * Run a SQL statement (INSERT, UPDATE, DELETE, CREATE).
 * Auto-saves after write operations.
 * @param {string} sql - SQL statement
 * @param {Array} [params] - Bind parameters
 * @returns {{changes: number, lastInsertRowid: number}}
 */
export function runSql(sql, params = []) {
  if (!db) throw new Error('Database not initialized. Call getDb() first.');
  db.run(sql, params);
  const changes = db.getRowsModified();
  // Get last insert rowid
  const result = db.exec('SELECT last_insert_rowid() as id');
  const lastInsertRowid = result.length > 0 ? result[0].values[0][0] : 0;
  saveDb();
  return { changes, lastInsertRowid };
}

/**
 * Query a single row.
 * @param {string} sql - SQL query
 * @param {Array} [params] - Bind parameters
 * @returns {Object|undefined} Row as an object, or undefined if not found
 */
export function queryOne(sql, params = []) {
  if (!db) throw new Error('Database not initialized. Call getDb() first.');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    stmt.free();
    const row = {};
    columns.forEach((col, i) => { row[col] = values[i]; });
    return row;
  }
  stmt.free();
  return undefined;
}

/**
 * Query all matching rows.
 * @param {string} sql - SQL query
 * @param {Array} [params] - Bind parameters
 * @returns {Object[]} Array of row objects
 */
export function queryAll(sql, params = []) {
  if (!db) throw new Error('Database not initialized. Call getDb() first.');
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  const columns = stmt.getColumnNames();
  while (stmt.step()) {
    const values = stmt.get();
    const row = {};
    columns.forEach((col, i) => { row[col] = values[i]; });
    rows.push(row);
  }
  stmt.free();
  return rows;
}
