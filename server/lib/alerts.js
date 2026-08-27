import { randomUUID } from "node:crypto";
import { db } from "./db.js";

const CODE_RE = /^\d{3,5}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ACTIVE_ALERTS_PER_EMAIL = 20;

const insertStmt = db.prepare(`
  INSERT INTO alerts (id, code, email, direction, target_price, lang, status, created_at)
  VALUES (?, ?, ?, ?, ?, ?, 'active', ?)
`);
const countActiveByEmailStmt = db.prepare(`SELECT COUNT(*) AS n FROM alerts WHERE email = ? AND status = 'active'`);
const listByEmailStmt = db.prepare(`SELECT * FROM alerts WHERE email = ? ORDER BY created_at DESC`);
const getStmt = db.prepare(`SELECT * FROM alerts WHERE id = ?`);
const cancelStmt = db.prepare(`UPDATE alerts SET status = 'cancelled' WHERE id = ? AND email = ? AND status = 'active'`);
const activeGroupedStmt = db.prepare(`SELECT DISTINCT code FROM alerts WHERE status = 'active'`);
const activeForCodeStmt = db.prepare(`SELECT * FROM alerts WHERE status = 'active' AND code = ?`);
const markTriggeredStmt = db.prepare(`
  UPDATE alerts SET status = 'triggered', triggered_at = ?, triggered_price = ?, last_checked_at = ? WHERE id = ?
`);
const touchCheckedStmt = db.prepare(`UPDATE alerts SET last_checked_at = ? WHERE id = ?`);

function rowToAlert(row) {
  if (!row) return null;
  return {
    id: row.id,
    code: row.code,
    email: row.email,
    direction: row.direction,
    targetPrice: row.target_price,
    lang: row.lang,
    status: row.status,
    createdAt: row.created_at,
    triggeredAt: row.triggered_at,
    triggeredPrice: row.triggered_price,
    lastCheckedAt: row.last_checked_at,
  };
}

export class ValidationError extends Error {}

export function createAlert({ code, email, direction, targetPrice, lang }) {
  const cleanCode = String(code || "").trim();
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanLang = lang === "en" ? "en" : "ar";

  if (!CODE_RE.test(cleanCode)) throw new ValidationError("Invalid TASI code.");
  if (!EMAIL_RE.test(cleanEmail)) throw new ValidationError("Invalid email address.");
  if (direction !== "buy" && direction !== "sell") throw new ValidationError("direction must be 'buy' or 'sell'.");
  const price = Number(targetPrice);
  if (!Number.isFinite(price) || price <= 0) throw new ValidationError("targetPrice must be a positive number.");

  const activeCount = countActiveByEmailStmt.get(cleanEmail).n;
  if (activeCount >= MAX_ACTIVE_ALERTS_PER_EMAIL) {
    throw new ValidationError(`Too many active alerts for this email (max ${MAX_ACTIVE_ALERTS_PER_EMAIL}).`);
  }

  const id = randomUUID();
  insertStmt.run(id, cleanCode, cleanEmail, direction, price, cleanLang, Date.now());
  return rowToAlert(getStmt.get(id));
}

export function listAlertsByEmail(email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  if (!EMAIL_RE.test(cleanEmail)) return [];
  return listByEmailStmt.all(cleanEmail).map(rowToAlert);
}

export function cancelAlert(id, email) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const result = cancelStmt.run(id, cleanEmail);
  return result.changes > 0;
}

/** Codes with at least one active alert — what the scheduler needs to price-check. */
export function listActiveAlertCodes() {
  return activeGroupedStmt.all().map((r) => r.code);
}

export function listActiveAlertsForCode(code) {
  return activeForCodeStmt.all(code).map(rowToAlert);
}

export function markAlertTriggered(id, price) {
  const now = Date.now();
  markTriggeredStmt.run(now, price, now, id);
}

export function touchAlertChecked(id) {
  touchCheckedStmt.run(Date.now(), id);
}
