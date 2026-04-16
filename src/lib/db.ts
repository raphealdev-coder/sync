import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

function getDbDir(): string {
  return process.env.DB_PATH || path.join(process.cwd(), 'data');
}

function getDbFile(): string {
  return path.join(getDbDir(), 'slynk.db');
}

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const dbDir = getDbDir();
  const dbFile = getDbFile();

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(dbFile);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  migrate(db);
  return db;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS woo_stores (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      name            TEXT NOT NULL,
      site_url        TEXT NOT NULL,
      consumer_key    TEXT NOT NULL,
      consumer_secret TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS product_mappings (
      id            INTEGER PRIMARY KEY AUTOINCREMENT,
      store_id      INTEGER NOT NULL DEFAULT 0,
      epos_id       TEXT NOT NULL,
      woo_id        INTEGER NOT NULL,
      epos_name     TEXT,
      woo_name      TEXT,
      last_synced   TEXT,
      UNIQUE(store_id, epos_id),
      UNIQUE(store_id, woo_id)
    );

    CREATE TABLE IF NOT EXISTS sync_logs (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      type        TEXT NOT NULL,
      status      TEXT NOT NULL,
      message     TEXT,
      details     TEXT
    );

    CREATE TABLE IF NOT EXISTS sync_schedules (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      name        TEXT NOT NULL,
      cron        TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      last_run    TEXT,
      next_run    TEXT
    );
  `);

  // Migrate: drop old unique constraints on product_mappings if they exist without store_id
  // (SQLite doesn't support ALTER TABLE DROP CONSTRAINT, so we handle via table recreation if needed)
  try {
    db.exec(`ALTER TABLE product_mappings ADD COLUMN store_id INTEGER NOT NULL DEFAULT 0`);
  } catch {
    // column already exists
  }

  // Seed default schedules if none exist
  const count = (db.prepare('SELECT COUNT(*) as c FROM sync_schedules').get() as { c: number }).c;
  if (count === 0) {
    db.prepare(
      `INSERT INTO sync_schedules (name, cron, enabled) VALUES (?, ?, ?)`
    ).run('Products (every 30 min)', '*/30 * * * *', 1);
    db.prepare(
      `INSERT INTO sync_schedules (name, cron, enabled) VALUES (?, ?, ?)`
    ).run('Orders (every hour)', '0 * * * *', 1);
    db.prepare(
      `INSERT INTO sync_schedules (name, cron, enabled) VALUES (?, ?, ?)`
    ).run('Inventory (every 15 min)', '*/15 * * * *', 1);
  }
}

export function getSetting(key: string): string | null {
  const row = getDb().prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  getDb()
    .prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    .run(key, value);
}

/* ---------- WooCommerce stores ---------- */

export interface WooStore {
  id: number;
  name: string;
  site_url: string;
  consumer_key: string;
  consumer_secret: string;
}

export function getWooStores(): WooStore[] {
  return getDb()
    .prepare('SELECT * FROM woo_stores ORDER BY name')
    .all() as WooStore[];
}

export function getWooStore(id: number): WooStore | undefined {
  return getDb()
    .prepare('SELECT * FROM woo_stores WHERE id = ?')
    .get(id) as WooStore | undefined;
}

export function createWooStore(name: string, siteUrl: string, consumerKey: string, consumerSecret: string): WooStore {
  const result = getDb()
    .prepare('INSERT INTO woo_stores (name, site_url, consumer_key, consumer_secret) VALUES (?, ?, ?, ?)')
    .run(name, siteUrl, consumerKey, consumerSecret);
  return { id: Number(result.lastInsertRowid), name, site_url: siteUrl, consumer_key: consumerKey, consumer_secret: consumerSecret };
}

export function updateWooStore(id: number, name: string, siteUrl: string, consumerKey: string, consumerSecret: string): void {
  getDb()
    .prepare('UPDATE woo_stores SET name = ?, site_url = ?, consumer_key = ?, consumer_secret = ? WHERE id = ?')
    .run(name, siteUrl, consumerKey, consumerSecret, id);
}

export function deleteWooStore(id: number): void {
  const db = getDb();
  db.prepare('DELETE FROM product_mappings WHERE store_id = ?').run(id);
  db.prepare('DELETE FROM woo_stores WHERE id = ?').run(id);
}

export function addLog(
  type: string,
  status: 'success' | 'error' | 'info',
  message: string,
  details?: unknown
): void {
  getDb()
    .prepare(
      `INSERT INTO sync_logs (type, status, message, details) VALUES (?, ?, ?, ?)`
    )
    .run(type, status, message, details ? JSON.stringify(details) : null);
}

export function getLogs(limit = 100): SyncLog[] {
  return getDb()
    .prepare('SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT ?')
    .all(limit) as SyncLog[];
}

export interface SyncLog {
  id: number;
  created_at: string;
  type: string;
  status: string;
  message: string;
  details: string | null;
}

export interface ProductMapping {
  id: number;
  store_id: number;
  epos_id: string;
  woo_id: number;
  epos_name: string | null;
  woo_name: string | null;
  last_synced: string | null;
}

export function getProductMappings(storeId?: number): ProductMapping[] {
  if (storeId !== undefined) {
    return getDb()
      .prepare('SELECT * FROM product_mappings WHERE store_id = ? ORDER BY epos_name')
      .all(storeId) as ProductMapping[];
  }
  return getDb()
    .prepare('SELECT * FROM product_mappings ORDER BY epos_name')
    .all() as ProductMapping[];
}

export function upsertProductMapping(
  storeId: number,
  eposId: string,
  wooId: number,
  eposName: string,
  wooName: string
): void {
  getDb()
    .prepare(
      `INSERT INTO product_mappings (store_id, epos_id, woo_id, epos_name, woo_name, last_synced)
       VALUES (?, ?, ?, ?, ?, datetime('now'))
       ON CONFLICT(store_id, epos_id) DO UPDATE SET
         woo_id = excluded.woo_id,
         woo_name = excluded.woo_name,
         last_synced = excluded.last_synced`
    )
    .run(storeId, eposId, wooId, eposName, wooName);
}

export function deleteProductMapping(id: number): void {
  getDb().prepare('DELETE FROM product_mappings WHERE id = ?').run(id);
}

export function deleteProductMappingByEposId(eposId: string): void {
  getDb().prepare('DELETE FROM product_mappings WHERE epos_id = ?').run(eposId);
}
