# Slynk — ePOS Now ↔ WooCommerce Multi-Store Sync

A self-hosted web application that connects **multiple ePOS Now** POS devices to **multiple WooCommerce stores**, keeping products, inventory, and orders in sync automatically.

Built for businesses like **Sterlin Glams** that operate several physical locations (Opebi, Ajah, Abuja…) each with their own ePOS Now device and their own WooCommerce storefront.

---

## Features

| Feature | Description |
|---|---|
| **Multi-Store Support** | Connect unlimited WooCommerce stores, each with its own ePOS Now API device |
| **Product Sync** | Imports products from ePOS Now → creates/updates them in WooCommerce |
| **Inventory Sync** | Pushes stock levels from ePOS Now → WooCommerce (per-location filtering) |
| **Order Sync** | Sends WooCommerce orders → ePOS Now as transactions |
| **Real-Time Webhooks** | ePOS Now pushes stock/product changes instantly via webhooks |
| **BMLS Multi-Location Stock** | Per-location stock via the Better Multi Location Stock WordPress plugin |
| **Product Linking** | Auto-match by SKU/barcode, or manually link ePOS ↔ Woo products |
| **Category & Customer Linking** | Map ePOS categories/customers to WooCommerce equivalents |
| **Dashboard** | Per-store connection status, sync stats, quick actions |
| **Sync Logs** | Full audit trail of every sync operation with error details |

## Tech Stack

- **Next.js 16** (App Router + API Routes)
- **TypeScript** / **React 19**
- **Tailwind CSS**
- **SQLite** (via `better-sqlite3`) — local database, no external DB required
- **ePOS Now REST API v4** — Basic Auth per API device
- **WooCommerce REST API v3** — standard REST API
- **BMLS REST API** — optional, for per-location stock via the [Better Multi Location Stock](https://wordpress.org/plugins/) plugin

---

## Prerequisites

- **Node.js 18+** (LTS recommended)
- **npm** or **yarn**
- An **ePOS Now** account with API access enabled (one API device per store location)
- One or more **WooCommerce** stores with REST API keys

---

## Quick Start

### 1. Clone and install

```bash
git clone https://github.com/raphealdev-coder/sync.git
cd sync
npm install
```

### 2. Run in development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 3. Production build

```bash
npm run build
npm start
```

The app runs on port **3000** by default.

---

## Step-by-Step Setup Guide

### Step 1 — Add Your WooCommerce Stores

1. Open the app and go to **Settings** in the sidebar.
2. Scroll to **WooCommerce Stores** and click **Add Store**.
3. For each store, enter:

| Field | Where to find it |
|---|---|
| **Store Name** | Your label, e.g. "Sterlin Glams Opebi" |
| **Store URL** | The full URL, e.g. `https://opebi.sterlinglams.com` |
| **Consumer Key** | WordPress → WooCommerce → Settings → Advanced → REST API → Add Key |
| **Consumer Secret** | Same as above — shown once when created |

> **Permissions:** Set the API key to **Read/Write** so the app can create products and update stock.

Repeat for every store (Opebi, Ajah, Abuja, etc.).

### Step 2 — Connect ePOS Now API Devices (Per Store)

Each physical location has its own ePOS Now device with separate API credentials. In the same store form:

| Field | Where to find it |
|---|---|
| **ePOS Application ID** | ePOS Now Back Office → Apps → API → select the API device for this location |
| **ePOS Application Secret** | Same screen — click "Show Secret" or regenerate |
| **ePOS Location ID** | ePOS Now Back Office → Setup → Locations → note the ID number |
| **BMLS Location ID** | *(Optional)* WordPress Admin → WooCommerce → Stock Locations → note the location ID |

> **Important:** Each store must use the API device that belongs to that specific location. Do **not** share one API device across stores — stock levels would be wrong.

> **BMLS Location ID:** Only fill this in if you use the **Better Multi Location Stock** plugin on a single WooCommerce install. When set, stock syncs update per-location quantities via the BMLS REST API instead of the main WooCommerce `stock_quantity`. Leave blank for standard WooCommerce stock management.

Click **Update Store** to save.

### Step 3 — Test Connections

1. Go to **Settings** and click **Test Connections**.
2. Each store should show green checkmarks for both WooCommerce and ePOS Now.
3. If a connection fails, double-check the credentials and store URL.

### Step 4 — Configure Sync Settings

In the **Sync Configuration** section of Settings:

| Setting | Description | Recommended |
|---|---|---|
| **Product Match Field** | Match products by `sku` or `barcode` | `sku` |
| **Price Sync** | Update WooCommerce prices from ePOS | Enable if ePOS is price master |
| **New Product Status** | Status for newly created Woo products | `draft` (review before publishing) |
| **Delete Action** | What happens when ePOS product is deleted | `draft` |

In the **Customer & Order Sync** section:

| Setting | Description |
|---|---|
| **Customer Sync** | Enable to map WooCommerce customers to ePOS customers |
| **Default Sync Customer ID** | ePOS customer ID used for guest/unmapped orders |
| **Transaction Details** | Log detailed transaction info during order sync |

### Step 5 — Link Products

1. Go to **Product Links** page.
2. Click **Auto-Match** to automatically link products that share the same SKU/barcode between ePOS and WooCommerce.
3. For unmatched products, use the manual linking interface.
4. Toggle **Ignore Stock** on any product you don't want stock-synced.

### Step 6 — Run Your First Sync

Use the **Products** page to:
- **Sync Products** — pulls all ePOS products and creates/updates them in WooCommerce
- **Sync Inventory** — pushes current stock levels to WooCommerce

Use the **Orders** page to:
- **Sync Orders** — sends WooCommerce orders to ePOS as transactions

### Step 7 — Set Up Webhooks (Real-Time Updates)

For automatic, real-time sync when stock changes at the till:

1. In **Settings**, find a store and click **Setup Webhooks**.
2. The app registers with ePOS Now to receive notifications for:
   - Stock created/updated (events 201, 202)
   - Product created/updated/deleted (events 121, 122, 123)
   - Transaction completed (event 304)
3. When any of these happen in ePOS, the app automatically updates WooCommerce.

> **Requirement:** Your app must be accessible from the internet for webhooks to work. Use a service like [ngrok](https://ngrok.com) for development, or deploy to a server with a public URL.

---

## Architecture Overview

```
┌─────────────┐         ┌──────────┐         ┌─────────────────┐
│  ePOS Now   │◄───────►│          │◄───────►│  WooCommerce    │
│  Device 1   │  API v4 │          │  REST   │  Store 1        │
│  (Opebi)    │─webhook─│  Slynk   │  API v3 │  (opebi.com)    │
├─────────────┤         │  App     │         ├─────────────────┤
│  ePOS Now   │◄───────►│          │◄───────►│  WooCommerce    │
│  Device 2   │  API v4 │ (SQLite) │  REST   │  Store 2        │
│  (Ajah)     │─webhook─│          │  API v3 │  (ajah.com)     │
├─────────────┤         │          │         ├─────────────────┤
│  ePOS Now   │◄───────►│          │◄───────►│  WooCommerce    │
│  Device 3   │  API v4 │          │  REST   │  Store 3        │
│  (Abuja)    │─webhook─│          │  API v3 │  (abuja.com)    │
└─────────────┘         └──────────┘         └─────────────────┘
```

### Sync Flows

**Manual sync (triggered from UI):**
```
Products:   ePOS Now ──► Slynk ──► WooCommerce  (create/update by SKU)
Inventory:  ePOS Now ──► Slynk ──► WooCommerce  (batch stock update)
Orders:     WooCommerce ──► Slynk ──► ePOS Now  (create transaction)
```

**Webhook sync (automatic, real-time):**
```
Stock change at till ──► ePOS Now webhook ──► Slynk /api/webhooks/epos ──► WooCommerce stock update
```

**BMLS mode (single WooCommerce install with per-location stock):**
```
ePOS Device A (Opebi)  ──► Slynk Store A ──► BMLS API ──► Location 1 stock
ePOS Device B (Ajah)   ──► Slynk Store B ──► BMLS API ──► Location 2 stock
ePOS Device C (Abuja)  ──► Slynk Store C ──► BMLS API ──► Location 3 stock
                                    ▲
                        Same WooCommerce site, same credentials,
                        different BMLS Location IDs
```

### Data Storage

All data is stored in a local SQLite database at `./data/slynk.db`:

| Table | Purpose |
|---|---|
| `settings` | Global configuration (key-value) |
| `woo_stores` | Store credentials, per-store ePOS config, optional BMLS location ID |
| `product_mappings` | ePOS product ID ↔ WooCommerce product ID (per store) |
| `category_mappings` | ePOS category ↔ WooCommerce category (per store) |
| `customer_mappings` | ePOS customer ↔ WooCommerce customer (per store) |
| `webhook_subscriptions` | Registered ePOS webhooks per store |
| `sync_logs` | Audit trail of all sync operations |
| `order_sync_log` | WooCommerce order → ePOS transaction tracking |
| `queue_items` | Background job queue |
| `sync_schedules` | Cron-based sync schedules (products, orders, inventory) |

> **Security:** The database contains API keys. It is excluded from git via `.gitignore`. **Never commit it.**

---

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DB_PATH` | `./data` | Directory for the SQLite database file |
| `PORT` | `3000` | Port the server listens on |

---

## Pages

| URL | Description |
|---|---|
| `/` | Dashboard — per-store connection status, stats, quick sync |
| `/settings` | Store credentials, ePOS config, sync settings, webhooks |
| `/products` | View ePOS/Woo products, trigger sync |
| `/product-links` | Manage product mappings, auto-match, ignore stock toggle |
| `/category-linker` | Map ePOS categories to WooCommerce categories |
| `/customer-linker` | Map ePOS customers to WooCommerce customers |
| `/orders` | Browse WooCommerce orders |
| `/orders-queue` | Sync WooCommerce orders to ePOS |
| `/woo-products-queue` | View WooCommerce product queue |
| `/order-print-queue` | Print queue for orders |
| `/logs` | Full sync audit trail with filtering |

---

## API Routes Reference

### Stores & Settings
| Method | Route | Description |
|---|---|---|
| GET/POST | `/api/settings` | Global settings |
| GET/POST/DELETE | `/api/stores` | WooCommerce store CRUD |
| GET | `/api/dashboard` | Dashboard stats (per-store status) |
| GET | `/api/sync/test` | Test connections (per-store) |

### ePOS Now Data
| Method | Route | Description |
|---|---|---|
| GET | `/api/epos/products?store_id=X` | List ePOS products for a store |
| GET | `/api/epos/categories?store_id=X` | List ePOS categories |
| GET | `/api/epos/customers?store_id=X` | List ePOS customers |
| GET | `/api/epos/locations?store_id=X` | List ePOS locations |

### WooCommerce Data
| Method | Route | Description |
|---|---|---|
| GET | `/api/woo/products?store_id=X` | List WooCommerce products |
| GET | `/api/woo/categories?store_id=X` | List WooCommerce categories |
| GET | `/api/woo/customers?store_id=X` | List WooCommerce customers |

### Queues
| Method | Route | Description |
|---|---|---|
| GET | `/api/queues?type=X&store_id=X` | Query queue items by type/store |
| POST | `/api/queues` | Add items to the job queue |
| PATCH | `/api/queues` | Update queue item status |

### Sync Operations
| Method | Route | Description |
|---|---|---|
| POST | `/api/sync/products` | Sync products ePOS → WooCommerce |
| POST | `/api/sync/inventory` | Sync stock levels ePOS → WooCommerce |
| GET/POST | `/api/sync/orders` | GET: fetch recent Woo orders; POST: sync orders Woo → ePOS |
| POST | `/api/sync/auto-match` | Auto-match products by SKU |
| GET | `/api/sync/order-log?store_id=X` | Fetch order sync history for a store |

### Mappings
| Method | Route | Description |
|---|---|---|
| GET/POST/DELETE/PATCH | `/api/mappings` | Product mappings |
| GET/POST/DELETE | `/api/category-mappings` | Category mappings |
| GET/POST/DELETE | `/api/customer-mappings` | Customer mappings |

### Webhooks
| Method | Route | Description |
|---|---|---|
| GET | `/api/webhooks/manage?store_id=X` | List webhook subscriptions |
| POST | `/api/webhooks/manage` | Register all webhooks for a store |
| DELETE | `/api/webhooks/manage?store_id=X` | Remove all webhooks for a store |
| PATCH | `/api/webhooks/manage` | Update webhook subscription status |
| POST | `/api/webhooks/epos?store_id=X&event=Y` | Incoming ePOS webhook handler |

---

## WooCommerce Multi-Store Compatibility

### What This App Expects

This app communicates with each WooCommerce store using the **standard WooCommerce REST API v3**. It does **not** require any custom WordPress plugin. Each store entry has its own:

- **Site URL** — the WordPress/WooCommerce address
- **Consumer Key / Secret** — standard WooCommerce REST API credentials

### Supported Multi-Store Setups

| Setup | Compatible? | Notes |
|---|---|---|
| **Separate WordPress installs** (e.g. opebi.store.com, ajah.store.com) | **Yes** | Each install has its own REST API — works perfectly |
| **WordPress Multisite** with WooCommerce per subsite | **Yes** | Each subsite has its own REST API endpoint |
| **WooMultistore plugin** (by jeev) | **Yes** | Creates child sites with their own REST API |
| **Single WooCommerce install** with one product catalog | **Partial** | Works for shared catalog; use **BMLS plugin** for per-location stock (see below) |

### If You Have a Single WordPress Install

If all your stores run on **one WordPress installation**, you have three options:

1. **Use the BMLS plugin (recommended)** — Install the [Better Multi Location Stock](https://wordpress.org/plugins/) plugin. Each Slynk store maps to a BMLS location. Products are shared, but stock quantities are tracked per-location. See the BMLS setup section below.
2. **Switch to WordPress Multisite** — each subsite gets its own WooCommerce and REST API.
3. **Use a multistore plugin that creates child sites** — plugins like WooMultistore by Jeev create separate WordPress installs that sync with a master, each with their own REST API.

> The standard WooCommerce REST API manages one store's products with a single `stock_quantity`. For per-location stock on a single install, use the BMLS plugin which provides a dedicated REST API for location-based stock management.

### BMLS Plugin Setup (Single Install, Per-Location Stock)

The **Better Multi Location Stock (BMLS)** plugin adds per-location stock tracking to a single WooCommerce installation. Slynk has built-in integration.

> **BMLS v2.0 Plugin Upgrade:** The BMLS plugin has been upgraded to **v2.0.0** with native ePOS Now integration. The plugin now includes its own EPOS client, sync engine, order manager, and admin dashboard — meaning it can sync stock and orders directly with ePOS Now devices **without Slynk** for simpler setups. Slynk remains the recommended approach for multi-store orchestration, advanced queue management, webhook handling, and centralized dashboard control.

#### BMLS v2.0 Built-In Features

| Feature | Description |
|---|---|
| **EPOS Store Management** | Admin UI to add/edit/delete EPOS stores with per-device API credentials (WooCommerce → EPOS Stores) |
| **Product Mapping** | Auto-match products by SKU/barcode or manually link ePOS ↔ WooCommerce products (WooCommerce → Product Mapping) |
| **Stock Sync Engine** | Cron-based stock sync (configurable interval, default 5 min) from ePOS → per-location BMLS stock |
| **Order Dispatch** | Auto-send WooCommerce orders to ePOS as transactions when they hit a configurable status |
| **Order Splitting** | When cart items span multiple locations, splits the order and dispatches each part to the correct EPOS device |
| **Sync Logs** | Full audit trail viewable in WooCommerce → Sync Logs |
| **Failed Sync Retry** | Automatic retry of failed order syncs (up to 3 attempts via cron) |
| **Settings Integration** | New "EPOS Integration" tab in BMLS settings for sync interval, stock master, match field, price sync, etc. |

#### BMLS v2.0 Database Tables

| Table | Purpose |
|---|---|
| `bmls_epos_stores` | EPOS device connections (API URL, credentials, BMLS location mapping, active status) |
| `bmls_product_map` | WooCommerce ↔ ePOS product mappings (per store, with ignore_stock flag) |
| `bmls_order_sync` | Order sync tracking (status, attempts, error messages) |
| `bmls_sync_logs` | Sync activity log (type, status, message, details per store) |

#### Slynk vs BMLS v2.0 — When to Use Which

| Scenario | Recommendation |
|---|---|
| Multiple WooCommerce stores, each with their own ePOS device | **Slynk** — orchestrates across stores |
| Single WooCommerce install with per-location stock, wants simple sync | **BMLS v2.0 alone** — plugin handles everything natively |
| Single WooCommerce + BMLS, but needs webhook support and centralized dashboard | **Slynk + BMLS** — Slynk manages webhooks, queues, and dashboard; BMLS handles per-location stock |
| Complex multi-store setup with queues, category/customer linking, print queues | **Slynk + BMLS** — full feature set |

> **Compatibility:** When using Slynk with BMLS v2.0, Slynk manages stock updates via the BMLS REST API. The BMLS plugin's built-in cron sync should be **disabled** (`enable_epos_sync = off` in BMLS settings) to avoid conflicts — let Slynk be the single source of sync.

#### Prerequisites

1. Install and activate the BMLS plugin on your WordPress site.
2. In WordPress Admin → WooCommerce → Settings → BMLS, **enable the REST API** (`enable_rest_api` setting).
3. Create one location per physical store (WordPress Admin → WooCommerce → Stock Locations).

#### Configuration

In Slynk, create one store entry per location. All stores share the **same** WooCommerce credentials but have **different** ePOS and BMLS settings:

| Store | Site URL | WooCommerce Keys | ePOS Device | BMLS Location ID |
|---|---|---|---|---|
| Opebi | `https://store.com` | Same key/secret | Device A | `1` |
| Ajah | `https://store.com` | Same key/secret | Device B | `2` |
| Abuja | `https://store.com` | Same key/secret | Device C | `3` |

#### How It Works

- **Inventory sync** (`/api/sync/inventory`): When `bmls_location_id` is set, stock updates go to `POST /wp-json/bmls/v1/stock/bulk` instead of the standard WooCommerce batch endpoint. Each product's stock is set at the specific BMLS location.
- **Webhook stock updates**: When ePOS Now fires a stock change webhook, Slynk checks the store's `bmls_location_id`. If set, it calls `POST /wp-json/bmls/v1/stock/update` for that single product at that location.
- **Transaction webhooks**: When a transaction completes in ePOS, Slynk refreshes all mapped product stock levels via BMLS bulk update for that location.
- **No BMLS = standard behavior**: If `bmls_location_id` is left blank, all stock operations use the standard WooCommerce `stock_quantity` field — no change from the default behavior.

#### BMLS REST API Endpoints Used

**Core endpoints (used by Slynk):**

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/wp-json/bmls/v1/locations` | List all BMLS locations |
| GET | `/wp-json/bmls/v1/stock?product_id=X&location_id=Y` | Get stock for a product at a location |
| POST | `/wp-json/bmls/v1/stock/update` | Update single product stock at a location |
| POST | `/wp-json/bmls/v1/stock/bulk` | Bulk update stock for multiple products |

**EPOS endpoints (added in BMLS v2.0):**

| Method | Endpoint | Purpose |
|---|---|---|
| GET/POST | `/wp-json/bmls/v1/epos-stores` | List / create EPOS store connections |
| GET/PUT/DELETE | `/wp-json/bmls/v1/epos-stores/{id}` | Get / update / delete a specific EPOS store |
| POST | `/wp-json/bmls/v1/epos-stores/{id}/test` | Test EPOS API connection for a store |
| POST | `/wp-json/bmls/v1/sync-stock` | Trigger manual stock sync for a store |
| POST | `/wp-json/bmls/v1/sync-order` | Trigger manual order sync to EPOS |

> **Auth:** BMLS uses the same WooCommerce consumer key/secret (Basic Auth). No additional credentials needed.

---

## Deployment

### Running on a VPS (Recommended)

```bash
# Clone the repo
git clone https://github.com/raphealdev-coder/sync.git
cd sync

# Install dependencies
npm install

# Build for production
npm run build

# Start the server
npm start
```

Use a process manager like **PM2** to keep it running:

```bash
npm install -g pm2
pm2 start npm --name "slynk" -- start
pm2 save
pm2 startup
```

### Reverse Proxy (nginx example)

```nginx
server {
    listen 80;
    server_name sync.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

> **HTTPS is required** for ePOS Now webhooks to work. Use Let's Encrypt / Certbot.

---

## Troubleshooting

| Issue | Solution |
|---|---|
| ePOS connection fails | Verify App ID and Secret in ePOS Back Office → Apps → API |
| WooCommerce connection fails | Check Consumer Key/Secret, ensure REST API is enabled, URL includes `https://` |
| Webhooks not firing | App must be accessible from the internet. Check firewall and HTTPS. |
| Stock not updating | Check Product Links — product must be linked and "Ignore Stock" must be off |
| Wrong stock numbers | Verify the ePOS Location ID matches the physical location |
| Database errors | Delete `./data/slynk.db` to reset (you'll need to re-enter all credentials) |

---

## License

Private — Sterlin Glams internal use.
