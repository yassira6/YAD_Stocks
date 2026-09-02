import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { getCompany } from "./companies.js";
import { isValidCode, normalizeCode } from "./markets.js";

export class ValidationError extends Error {}

const insertStmt = db.prepare(`
  INSERT INTO watchlist_items (id, user_id, code, alerts_enabled, created_at)
  VALUES (?, ?, ?, 0, ?)
  ON CONFLICT(user_id, code) DO NOTHING
`);
const deleteStmt = db.prepare(`DELETE FROM watchlist_items WHERE user_id = ? AND code = ?`);
const listForUserStmt = db.prepare(`SELECT * FROM watchlist_items WHERE user_id = ? ORDER BY created_at DESC`);
const getItemStmt = db.prepare(`SELECT * FROM watchlist_items WHERE user_id = ? AND code = ?`);
const setAlertsStmt = db.prepare(`UPDATE watchlist_items SET alerts_enabled = ? WHERE user_id = ? AND code = ?`);
const codesForUserStmt = db.prepare(`SELECT code FROM watchlist_items WHERE user_id = ?`);
const countForUserStmt = db.prepare(`SELECT COUNT(*) AS n FROM watchlist_items WHERE user_id = ?`);

// Used by the signal scanner: every user whose watchlist contains this code
// with alerts turned on for it (only meaningful for users whose signal
// subscription scope is 'watchlist' — the scanner filters that separately).
const alertSubscribersForCodeStmt = db.prepare(`SELECT user_id FROM watchlist_items WHERE code = ? AND alerts_enabled = 1`);

const MAX_ITEMS_PER_USER = 200;

function rowToItem(row) {
  const company = getCompany(row.code);
  return {
    code: row.code,
    nameEn: company?.nameEn ?? null,
    nameAr: company?.nameAr ?? null,
    market: company?.market ?? null,
    alertsEnabled: !!row.alerts_enabled,
    addedAt: row.created_at,
  };
}

export function addWatchlistItem(userId, code) {
  const cleanCode = normalizeCode(code);
  if (!isValidCode(cleanCode)) throw new ValidationError("Invalid company/ticker code.");

  const count = countForUserStmt.get(userId).n;
  if (count >= MAX_ITEMS_PER_USER) {
    throw new ValidationError(`Too many watchlist items (max ${MAX_ITEMS_PER_USER}).`);
  }

  insertStmt.run(randomUUID(), userId, cleanCode, Date.now());
  return rowToItem(getItemStmt.get(userId, cleanCode));
}

export function removeWatchlistItem(userId, code) {
  const result = deleteStmt.run(userId, normalizeCode(code));
  return result.changes > 0;
}

export function listWatchlistForUser(userId) {
  return listForUserStmt.all(userId).map(rowToItem);
}

export function setWatchlistItemAlerts(userId, code, enabled) {
  const cleanCode = normalizeCode(code);
  const result = setAlertsStmt.run(enabled ? 1 : 0, userId, cleanCode);
  if (result.changes === 0) throw new ValidationError("That stock is not in your watchlist.");
  return rowToItem(getItemStmt.get(userId, cleanCode));
}

export function listWatchlistCodesForUser(userId) {
  return codesForUserStmt.all(userId).map((r) => r.code);
}

/** Admin-only: same shape as listWatchlistForUser, exposed for the admin user-detail view. */
export function listWatchlistForUserAdmin(userId) {
  return listWatchlistForUser(userId);
}

/** Scanner-only: user ids whose watchlist has alerts on for this code. */
export function listWatchlistAlertUserIdsForCode(code) {
  return alertSubscribersForCodeStmt.all(code).map((r) => r.user_id);
}
