import { neon } from '@neondatabase/serverless';

function getSQL() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is not set. Create a Neon project at https://neon.tech and add the connection string.');
  }
  return neon(url);
}

/* ---------- Migration ---------- */

let migrated = false;

export async function ensureMigrated(): Promise<void> {
  if (migrated) return;
  const sql = getSQL();

  await sql`
    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS woo_stores (
      id              SERIAL PRIMARY KEY,
      name            TEXT NOT NULL,
      site_url        TEXT NOT NULL,
      consumer_key    TEXT NOT NULL,
      consumer_secret TEXT NOT NULL,
      epos_app_id     TEXT,
      epos_app_secret TEXT,
      epos_location_id TEXT,
      bmls_location_id TEXT
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS product_mappings (
      id                  SERIAL PRIMARY KEY,
      store_id            INTEGER NOT NULL DEFAULT 0,
      epos_id             TEXT NOT NULL,
      woo_id              INTEGER NOT NULL,
      epos_name           TEXT,
      woo_name            TEXT,
      last_synced         TEXT,
      ignore_stock_update INTEGER NOT NULL DEFAULT 0,
      UNIQUE(store_id, epos_id),
      UNIQUE(store_id, woo_id)
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS sync_logs (
      id          SERIAL PRIMARY KEY,
      created_at  TEXT NOT NULL DEFAULT (NOW()::TEXT),
      type        TEXT NOT NULL,
      status      TEXT NOT NULL,
      message     TEXT,
      details     TEXT
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS sync_schedules (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      cron        TEXT NOT NULL,
      enabled     INTEGER NOT NULL DEFAULT 1,
      last_run    TEXT,
      next_run    TEXT
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS category_mappings (
      id          SERIAL PRIMARY KEY,
      store_id    INTEGER NOT NULL DEFAULT 0,
      epos_id     TEXT NOT NULL,
      woo_id      INTEGER NOT NULL,
      epos_name   TEXT,
      woo_name    TEXT,
      last_synced TEXT,
      UNIQUE(store_id, epos_id),
      UNIQUE(store_id, woo_id)
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS customer_mappings (
      id          SERIAL PRIMARY KEY,
      store_id    INTEGER NOT NULL DEFAULT 0,
      epos_id     TEXT NOT NULL,
      woo_id      INTEGER NOT NULL,
      epos_name   TEXT,
      woo_name    TEXT,
      last_synced TEXT,
      UNIQUE(store_id, epos_id),
      UNIQUE(store_id, woo_id)
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS queue_items (
      id            SERIAL PRIMARY KEY,
      queue_type    TEXT NOT NULL,
      store_id      INTEGER NOT NULL,
      reference_id  TEXT,
      title         TEXT NOT NULL,
      status        TEXT NOT NULL DEFAULT 'pending',
      priority      INTEGER NOT NULL DEFAULT 0,
      payload       TEXT,
      result        TEXT,
      error         TEXT,
      created_at    TEXT NOT NULL DEFAULT (NOW()::TEXT),
      started_at    TEXT,
      completed_at  TEXT
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS order_sync_log (
      id                    SERIAL PRIMARY KEY,
      store_id              INTEGER NOT NULL,
      woo_order_id          INTEGER NOT NULL,
      epos_transaction_id   INTEGER,
      status                TEXT NOT NULL DEFAULT 'pending',
      error                 TEXT,
      synced_at             TEXT NOT NULL DEFAULT (NOW()::TEXT),
      UNIQUE(store_id, woo_order_id)
    )`;

  await sql`
    CREATE TABLE IF NOT EXISTS webhook_subscriptions (
      id              SERIAL PRIMARY KEY,
      store_id        INTEGER NOT NULL,
      epos_webhook_id TEXT,
      event_type      INTEGER NOT NULL,
      event_name      TEXT NOT NULL,
      webhook_url     TEXT NOT NULL,
      enabled         INTEGER NOT NULL DEFAULT 1,
      created_at      TEXT NOT NULL DEFAULT (NOW()::TEXT),
      UNIQUE(store_id, event_type)
    )`;

  const countResult = await sql`SELECT COUNT(*) as c FROM sync_schedules`;
  if (Number(countResult[0].c) === 0) {
    await sql`INSERT INTO sync_schedules (name, cron, enabled) VALUES ('Products (every 30 min)', '*/30 * * * *', 1)`;
    await sql`INSERT INTO sync_schedules (name, cron, enabled) VALUES ('Orders (every hour)', '0 * * * *', 1)`;
    await sql`INSERT INTO sync_schedules (name, cron, enabled) VALUES ('Inventory (every 15 min)', '*/15 * * * *', 1)`;
  }

  migrated = true;
}

/* ---------- Settings ---------- */

export async function getSetting(key: string): Promise<string | null> {
  await ensureMigrated();
  const sql = getSQL();
  const rows = await sql`SELECT value FROM settings WHERE key = ${key}`;
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  await sql`
    INSERT INTO settings (key, value) VALUES (${key}, ${value})
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`;
}

/* ---------- WooCommerce stores ---------- */

export interface WooStore {
  id: number;
  name: string;
  site_url: string;
  consumer_key: string;
  consumer_secret: string;
  epos_app_id: string | null;
  epos_app_secret: string | null;
  epos_location_id: string | null;
  bmls_location_id: string | null;
}

export async function getWooStores(): Promise<WooStore[]> {
  await ensureMigrated();
  const sql = getSQL();
  return await sql`SELECT * FROM woo_stores ORDER BY name` as WooStore[];
}

export async function getWooStore(id: number): Promise<WooStore | undefined> {
  await ensureMigrated();
  const sql = getSQL();
  const rows = await sql`SELECT * FROM woo_stores WHERE id = ${id}`;
  return rows[0] as WooStore | undefined;
}

export async function createWooStore(
  name: string, siteUrl: string, consumerKey: string, consumerSecret: string,
  eposAppId?: string, eposAppSecret?: string, eposLocationId?: string, bmlsLocationId?: string
): Promise<WooStore> {
  await ensureMigrated();
  const sql = getSQL();
  const rows = await sql`
    INSERT INTO woo_stores (name, site_url, consumer_key, consumer_secret, epos_app_id, epos_app_secret, epos_location_id, bmls_location_id)
    VALUES (${name}, ${siteUrl}, ${consumerKey}, ${consumerSecret}, ${eposAppId ?? null}, ${eposAppSecret ?? null}, ${eposLocationId ?? null}, ${bmlsLocationId ?? null})
    RETURNING *`;
  return rows[0] as WooStore;
}

export async function updateWooStore(
  id: number, name: string, siteUrl: string, consumerKey: string, consumerSecret: string,
  eposAppId?: string, eposAppSecret?: string, eposLocationId?: string, bmlsLocationId?: string
): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  await sql`
    UPDATE woo_stores SET name = ${name}, site_url = ${siteUrl}, consumer_key = ${consumerKey}, consumer_secret = ${consumerSecret},
    epos_app_id = ${eposAppId ?? null}, epos_app_secret = ${eposAppSecret ?? null},
    epos_location_id = ${eposLocationId ?? null}, bmls_location_id = ${bmlsLocationId ?? null}
    WHERE id = ${id}`;
}

export async function deleteWooStore(id: number): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  await sql`DELETE FROM product_mappings WHERE store_id = ${id}`;
  await sql`DELETE FROM woo_stores WHERE id = ${id}`;
}

/* ---------- Logs ---------- */

export async function addLog(type: string, status: 'success' | 'error' | 'info', message: string, details?: unknown): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  await sql`INSERT INTO sync_logs (type, status, message, details) VALUES (${type}, ${status}, ${message}, ${details ? JSON.stringify(details) : null})`;
}

export interface SyncLog { id: number; created_at: string; type: string; status: string; message: string; details: string | null; }

export async function getLogs(limit = 100): Promise<SyncLog[]> {
  await ensureMigrated();
  const sql = getSQL();
  return await sql`SELECT * FROM sync_logs ORDER BY created_at DESC LIMIT ${limit}` as SyncLog[];
}

/* ---------- Product Mappings ---------- */

export interface ProductMapping {
  id: number; store_id: number; epos_id: string; woo_id: number;
  epos_name: string | null; woo_name: string | null; last_synced: string | null; ignore_stock_update: number;
}

export async function getProductMappings(storeId?: number): Promise<ProductMapping[]> {
  await ensureMigrated();
  const sql = getSQL();
  if (storeId !== undefined) {
    return await sql`SELECT * FROM product_mappings WHERE store_id = ${storeId} ORDER BY epos_name` as ProductMapping[];
  }
  return await sql`SELECT * FROM product_mappings ORDER BY epos_name` as ProductMapping[];
}

export async function upsertProductMapping(storeId: number, eposId: string, wooId: number, eposName: string, wooName: string): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  await sql`
    INSERT INTO product_mappings (store_id, epos_id, woo_id, epos_name, woo_name, last_synced)
    VALUES (${storeId}, ${eposId}, ${wooId}, ${eposName}, ${wooName}, NOW()::TEXT)
    ON CONFLICT (store_id, epos_id) DO UPDATE SET woo_id = EXCLUDED.woo_id, woo_name = EXCLUDED.woo_name, last_synced = EXCLUDED.last_synced`;
}

export async function deleteProductMapping(id: number): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  await sql`DELETE FROM product_mappings WHERE id = ${id}`;
}

export async function deleteProductMappingByEposId(eposId: string): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  await sql`DELETE FROM product_mappings WHERE epos_id = ${eposId}`;
}

export async function setIgnoreStockUpdate(id: number, ignore: boolean): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  await sql`UPDATE product_mappings SET ignore_stock_update = ${ignore ? 1 : 0} WHERE id = ${id}`;
}

/* ---------- Category Mappings ---------- */

export interface CategoryMapping {
  id: number; store_id: number; epos_id: string; woo_id: number;
  epos_name: string | null; woo_name: string | null; last_synced: string | null;
}

export async function getCategoryMappings(storeId?: number): Promise<CategoryMapping[]> {
  await ensureMigrated();
  const sql = getSQL();
  if (storeId !== undefined) {
    return await sql`SELECT * FROM category_mappings WHERE store_id = ${storeId} ORDER BY epos_name` as CategoryMapping[];
  }
  return await sql`SELECT * FROM category_mappings ORDER BY epos_name` as CategoryMapping[];
}

export async function upsertCategoryMapping(storeId: number, eposId: string, wooId: number, eposName: string, wooName: string): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  await sql`
    INSERT INTO category_mappings (store_id, epos_id, woo_id, epos_name, woo_name, last_synced)
    VALUES (${storeId}, ${eposId}, ${wooId}, ${eposName}, ${wooName}, NOW()::TEXT)
    ON CONFLICT (store_id, epos_id) DO UPDATE SET woo_id = EXCLUDED.woo_id, woo_name = EXCLUDED.woo_name, last_synced = EXCLUDED.last_synced`;
}

export async function deleteCategoryMapping(id: number): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  await sql`DELETE FROM category_mappings WHERE id = ${id}`;
}

/* ---------- Customer Mappings ---------- */

export interface CustomerMapping {
  id: number; store_id: number; epos_id: string; woo_id: number;
  epos_name: string | null; woo_name: string | null; last_synced: string | null;
}

export async function getCustomerMappings(storeId?: number): Promise<CustomerMapping[]> {
  await ensureMigrated();
  const sql = getSQL();
  if (storeId !== undefined) {
    return await sql`SELECT * FROM customer_mappings WHERE store_id = ${storeId} ORDER BY epos_name` as CustomerMapping[];
  }
  return await sql`SELECT * FROM customer_mappings ORDER BY epos_name` as CustomerMapping[];
}

export async function upsertCustomerMapping(storeId: number, eposId: string, wooId: number, eposName: string, wooName: string): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  await sql`
    INSERT INTO customer_mappings (store_id, epos_id, woo_id, epos_name, woo_name, last_synced)
    VALUES (${storeId}, ${eposId}, ${wooId}, ${eposName}, ${wooName}, NOW()::TEXT)
    ON CONFLICT (store_id, epos_id) DO UPDATE SET woo_id = EXCLUDED.woo_id, woo_name = EXCLUDED.woo_name, last_synced = EXCLUDED.last_synced`;
}

export async function deleteCustomerMapping(id: number): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  await sql`DELETE FROM customer_mappings WHERE id = ${id}`;
}

/* ---------- Queue Items ---------- */

export interface QueueItem {
  id: number; queue_type: string; store_id: number; reference_id: string | null;
  title: string; status: string; priority: number; payload: string | null;
  result: string | null; error: string | null; created_at: string;
  started_at: string | null; completed_at: string | null;
}

export async function getQueueItems(queueType: string, storeId?: number, limit = 100): Promise<QueueItem[]> {
  await ensureMigrated();
  const sql = getSQL();
  if (storeId !== undefined) {
    return await sql`SELECT * FROM queue_items WHERE queue_type = ${queueType} AND store_id = ${storeId} ORDER BY created_at DESC LIMIT ${limit}` as QueueItem[];
  }
  return await sql`SELECT * FROM queue_items WHERE queue_type = ${queueType} ORDER BY created_at DESC LIMIT ${limit}` as QueueItem[];
}

export async function addQueueItem(queueType: string, storeId: number, title: string, referenceId?: string, payload?: unknown): Promise<QueueItem> {
  await ensureMigrated();
  const sql = getSQL();
  const rows = await sql`
    INSERT INTO queue_items (queue_type, store_id, reference_id, title, payload)
    VALUES (${queueType}, ${storeId}, ${referenceId ?? null}, ${title}, ${payload ? JSON.stringify(payload) : null})
    RETURNING *`;
  return rows[0] as QueueItem;
}

export async function updateQueueItemStatus(id: number, status: string, result?: string, error?: string): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  const now = new Date().toISOString();
  if (status === 'processing') {
    await sql`UPDATE queue_items SET status = ${status}, started_at = ${now} WHERE id = ${id}`;
  } else {
    await sql`UPDATE queue_items SET status = ${status}, result = ${result ?? null}, error = ${error ?? null}, completed_at = ${now} WHERE id = ${id}`;
  }
}

export async function getQueueStats(queueType: string): Promise<{ pending: number; processing: number; completed: number; failed: number }> {
  await ensureMigrated();
  const sql = getSQL();
  const rows = await sql`
    SELECT
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END) as processing,
      SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM queue_items WHERE queue_type = ${queueType}`;
  const row = rows[0];
  return { pending: Number(row?.pending ?? 0), processing: Number(row?.processing ?? 0), completed: Number(row?.completed ?? 0), failed: Number(row?.failed ?? 0) };
}

/* ---------- Order Sync Log ---------- */

export interface OrderSyncEntry {
  id: number; store_id: number; woo_order_id: number;
  epos_transaction_id: number | null; status: string; error: string | null; synced_at: string;
}

export async function getOrderSyncEntries(storeId: number, limit = 100): Promise<OrderSyncEntry[]> {
  await ensureMigrated();
  const sql = getSQL();
  return await sql`SELECT * FROM order_sync_log WHERE store_id = ${storeId} ORDER BY synced_at DESC LIMIT ${limit}` as OrderSyncEntry[];
}

export async function upsertOrderSync(storeId: number, wooOrderId: number, status: string, eposTransactionId?: number, error?: string): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  await sql`
    INSERT INTO order_sync_log (store_id, woo_order_id, epos_transaction_id, status, error, synced_at)
    VALUES (${storeId}, ${wooOrderId}, ${eposTransactionId ?? null}, ${status}, ${error ?? null}, NOW()::TEXT)
    ON CONFLICT (store_id, woo_order_id) DO UPDATE SET
      epos_transaction_id = EXCLUDED.epos_transaction_id, status = EXCLUDED.status,
      error = EXCLUDED.error, synced_at = EXCLUDED.synced_at`;
}

export async function getOrderSyncStatus(storeId: number, wooOrderId: number): Promise<OrderSyncEntry | undefined> {
  await ensureMigrated();
  const sql = getSQL();
  const rows = await sql`SELECT * FROM order_sync_log WHERE store_id = ${storeId} AND woo_order_id = ${wooOrderId}`;
  return rows[0] as OrderSyncEntry | undefined;
}

/* ---------- Webhook Subscriptions ---------- */

export interface WebhookSubscription {
  id: number; store_id: number; epos_webhook_id: string | null;
  event_type: number; event_name: string; webhook_url: string; enabled: number; created_at: string;
}

export async function getWebhookSubscriptions(storeId: number): Promise<WebhookSubscription[]> {
  await ensureMigrated();
  const sql = getSQL();
  return await sql`SELECT * FROM webhook_subscriptions WHERE store_id = ${storeId} ORDER BY event_name` as WebhookSubscription[];
}

export async function upsertWebhookSubscription(storeId: number, eventType: number, eventName: string, webhookUrl: string, eposWebhookId?: string): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  await sql`
    INSERT INTO webhook_subscriptions (store_id, event_type, event_name, webhook_url, epos_webhook_id)
    VALUES (${storeId}, ${eventType}, ${eventName}, ${webhookUrl}, ${eposWebhookId ?? null})
    ON CONFLICT (store_id, event_type) DO UPDATE SET
      webhook_url = EXCLUDED.webhook_url,
      epos_webhook_id = COALESCE(EXCLUDED.epos_webhook_id, webhook_subscriptions.epos_webhook_id)`;
}

export async function deleteWebhookSubscription(id: number): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  await sql`DELETE FROM webhook_subscriptions WHERE id = ${id}`;
}

export async function deleteWebhookSubscriptionsByStore(storeId: number): Promise<void> {
  await ensureMigrated();
  const sql = getSQL();
  await sql`DELETE FROM webhook_subscriptions WHERE store_id = ${storeId}`;
}
