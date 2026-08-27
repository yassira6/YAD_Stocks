import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { db } from "./db.js";
import { detectMarket, normalizeCode } from "./markets.js";

const DATA_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "data");
// Each seed file is a curated starter list (compiled from general knowledge,
// not a scraped live source — treat it as "likely correct, verify before
// trading", same caveat as the original TASI seed). It is NOT the complete
// current S&P 500 or NASDAQ listing — searching by any valid raw ticker
// still works even if it's not in this list (see the "direct lookup"
// fallback in touchCompanyFromLiveQuote below), this just seeds what shows
// up by name before a company has ever been looked up.
const SEED_FILES = [
  { path: path.join(DATA_DIR, "companies.json"), market: "TASI" },
  { path: path.join(DATA_DIR, "companies_us.json"), market: "US" },
];

const insertSeedStmt = db.prepare(`
  INSERT OR IGNORE INTO companies (code, name_en, name_ar, sector_en, sector_ar, market, source, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, 'seed', ?, ?)
`);

/** Seeds the curated starter directories (TASI + US) on first run. Existing rows are left untouched. */
export function seedCompanies() {
  const now = Date.now();
  let inserted = 0;
  let total = 0;
  for (const { path: seedPath, market } of SEED_FILES) {
    const seed = JSON.parse(readFileSync(seedPath, "utf-8"));
    total += seed.length;
    for (const c of seed) {
      const result = insertSeedStmt.run(c.code, c.nameEn, c.nameAr, c.sectorEn, c.sectorAr, market, now, now);
      if (result.changes > 0) inserted += 1;
    }
  }
  return { total, inserted };
}

const getStmt = db.prepare(`SELECT * FROM companies WHERE code = ?`);
const listStmt = db.prepare(`SELECT * FROM companies ORDER BY name_en ASC`);
const insertDynamicStmt = db.prepare(`
  INSERT INTO companies (code, name_en, name_ar, sector_en, sector_ar, market, source, last_price, last_checked_at, created_at, updated_at)
  VALUES (?, ?, NULL, NULL, NULL, ?, 'yahoo', ?, ?, ?, ?)
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
    market: row.market || "TASI",
    source: row.source,
    lastPrice: row.last_price,
    lastCheckedAt: row.last_checked_at,
  };
}

export function getCompany(code) {
  return rowToCompany(getStmt.get(normalizeCode(code)));
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
 * as people search real codes, TASI or US.
 */
export function touchCompanyFromLiveQuote(code, { displayName, price }) {
  const normalized = normalizeCode(code);
  const now = Date.now();
  const existing = getStmt.get(normalized);
  if (existing) {
    touchExistingStmt.run(price ?? null, now, now, normalized);
    return;
  }
  const name = displayName || normalized;
  const market = detectMarket(normalized) || "TASI";
  insertDynamicStmt.run(normalized, name, market, price ?? null, now, now, now);
}
