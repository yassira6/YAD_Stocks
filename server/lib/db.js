import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import path from "node:path";
import fs from "node:fs";

// DB_PATH lets a Railway Volume (or any persistent mount) be used in
// production — see README "Persistence" section. Without one, this file
// lives in the container's ephemeral filesystem and resets on redeploy.
const DEFAULT_DB_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "myshare.db");
const DB_PATH = process.env.DB_PATH || DEFAULT_DB_PATH;

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

export const db = new DatabaseSync(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS companies (
    code TEXT PRIMARY KEY,
    name_en TEXT NOT NULL,
    name_ar TEXT,
    sector_en TEXT,
    sector_ar TEXT,
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

  CREATE INDEX IF NOT EXISTS idx_alerts_email ON alerts(email);
  CREATE INDEX IF NOT EXISTS idx_alerts_status_code ON alerts(status, code);
  CREATE INDEX IF NOT EXISTS idx_companies_updated ON companies(updated_at);
`);

export { DB_PATH };
