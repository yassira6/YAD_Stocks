import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

// DB_PATH lets a Railway Volume (or any persistent mount) be used in
// production — see README "Persistence" section. Without one, this file
// lives in the container's ephemeral filesystem and resets on redeploy.
const DEFAULT_DB_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "myshare.db");
const DB_PATH = process.env.DB_PATH || DEFAULT_DB_PATH;

if (!process.env.DB_PATH) {
  // Not necessarily wrong (fine for local dev), but on Railway this path is
  // on the container's ephemeral disk — every redeploy wipes it, taking
  // every user account, session, and alert with it. Loud on purpose.
  console.warn(
    "=".repeat(78) +
      "\n[db] DB_PATH is not set — using the in-container default, which does NOT\n" +
      "     survive a redeploy on Railway. If this is production, attach a Volume\n" +
      "     and set DB_PATH (see README “Persistence”) or every user, session,\n" +
      "     and alert will be lost on the next deploy.\n" +
      "=".repeat(78)
  );
}

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    code TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_ar TEXT,
    sector_en TEXT,
    sector_ar TEXT,
    market TEXT NOT NULL DEFAULT 'TASI',
    source TEXT NOT NULL DEFAULT 'seed',
    last_price REAL,
    last_checked_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    email TEXT NOT NULL,
    direction TEXT NOT NULL,
    target_price REAL NOT NULL,
    lang TEXT NOT NULL DEFAULT 'ar',
    status TEXT NOT NULL DEFAULT 'active',
    created_at INTEGER NOT NULL,
    triggered_at INTEGER,
    triggered_price REAL,
    last_checked_at INTEGER
  );

  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    picture TEXT,
    provider TEXT NOT NULL,
    provider_user_id TEXT,
    is_admin INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL,
    last_login_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    expires_at INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin_emails (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    sent_by TEXT NOT NULL,
    subject TEXT NOT NULL,
    body TEXT NOT NULL,
    sent INTEGER,
    error TEXT,
    created_at INTEGER NOT NULL
  );

  -- One row per user: whether they want email/push notifications for
  -- market-wide strong-buy/strong-sell signals (a separate opt-in from the
  -- per-stock price alerts in the 'alerts' table above).
  CREATE TABLE IF NOT EXISTS signal_subscriptions (
    user_id TEXT PRIMARY KEY,
    email_enabled INTEGER NOT NULL DEFAULT 0,
    push_enabled INTEGER NOT NULL DEFAULT 0,
    lang TEXT NOT NULL DEFAULT 'ar',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );

  -- Web Push subscription objects registered by the browser. A user can have
  -- more than one (multiple devices/browsers), so this is keyed by endpoint,
  -- not user_id.
  CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at INTEGER NOT NULL
  );

  -- Last known verdict per company, so the scanner can tell a *new* strong
  -- signal (worth notifying about) from one that's already been announced.
  CREATE TABLE IF NOT EXISTS company_signals (
    code TEXT PRIMARY KEY,
    last_verdict TEXT,
    last_score REAL,
    last_notified_verdict TEXT,
    last_notified_at INTEGER,
    updated_at INTEGER NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_alerts_email ON alerts(email);
  CREATE INDEX IF NOT EXISTS idx_alerts_status_code ON alerts(status, code);
  CREATE INDEX IF NOT EXISTS idx_companies_updated ON companies(updated_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
  CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions(user_id);
`);

// --- Lightweight migrations -------------------------------------------------
// node:sqlite has no migration framework; CREATE TABLE IF NOT EXISTS above
// only helps brand-new databases. A DB file created before this change needs
// these columns added explicitly, so every startup checks for them.
function ensureColumn(table, column, ddl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

ensureColumn("alerts", "user_id", "user_id TEXT");
ensureColumn("alerts", "email_sent", "email_sent INTEGER");
ensureColumn("alerts", "email_error", "email_error TEXT");
db.exec(`CREATE INDEX IF NOT EXISTS idx_alerts_user ON alerts(user_id)`);
ensureColumn("companies", "market", "market TEXT NOT NULL DEFAULT 'TASI'");

export { DB_PATH };
