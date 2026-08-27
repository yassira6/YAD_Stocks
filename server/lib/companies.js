import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { db } from "./db.js";

const SEED_PATH = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "companies.json");

const insertSeedStmt = db.prepare(`
  INSERT OR IGNORE INTO companies (code, name_en, name_ar, sector_en, sector_ar, source, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 'seed', ?, ?)
`);

/** Seeds the curated starter directory on first run. Existing rows are left untouched. */
export function seedCompanies() {
  const seed = JSON.parse(readFileSync(SEED_PATH, "utf-8"));
  const now = Date.now();
  let inserted = 0;
  for (const c of seed) {
    const result = insertSeedStmt.run(c.code, c.nameEn, c.nameAr, c.sectorEn, c.sectorAr, now, now);
    if (result.changes > 0) inserted += 1;
  }
  return { total: seed.length, inserted };
}

const getStmt = db.prepare(`SELECT * FROM companies WHERE code = ?`);
const listStmt = db.prepare(`SELECT * FROM companies ORDER BY name_en ASC`);
const insertDynamicStmt = db.prepare(`
  INSERT INTO companies (code, name_en, name_ar, sector_en, sector_ar, source, last_price, last_checked_at, created_at, updated_at)
  VALUES (?, ?, NULL, NULL, NULL, 'yahoo', ?, ?, ?, ?)
`);
const touchExistingStmt = db.prepare(`
  UPDATE companies SET last_price = ?, last_checked_at = ?, updated_at = ? WHERE code = ?
`);

function rowToCompany(row) {
  if (!row) return null;
  return {
    code: row.code,
    nameEn: row.name_en,
    nameAr: row.name_ar,
    sectorEn: row.sector_en,
    sectorAr: row.sector_ar,
    source: row.source,
    lastPrice: row.last_price,
    lastCheckedAt: row.last_checked_at,
  };
}

export function getCompany(code) {
  return rowToCompany(getStmt.get(code));
}

export function listCompanies() {
  return listStmt.all().map(rowToCompany);
}

/**
 * Called every time a quote is successfully fetched LIVE (never from the demo
 * fallback, so we never pollute the directory with a code that only "worked"
 * because it got synthetic placeholder data). Adds the company if it's new
 * (using the name Yahoo's chart metadata reports) and always refreshes its
 * last known price — this is what makes the directory grow and stay current
 * as people search real codes.
 */
export function touchCompanyFromLiveQuote(code, { displayName, price }) {
  const now = Date.now();
  const existing = getStmt.get(code);
  if (existing) {
    touchExistingStmt.run(price ?? null, now, now, code);
    return;
  }
  const name = displayName || code;
  insertDynamicStmt.run(code, name, price ?? null, now, now, now);
}
