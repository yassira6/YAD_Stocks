import { randomUUID } from "node:crypto";
import { db } from "./db.js";
import { isValidCode, normalizeCode } from "./markets.js";

const MAX_ACTIVE_ALERTS_PER_USER = 20;

const insertStmt = db.prepare(`
  INSERT INTO alerts (id, code, email, direction, target_price, lang, status, created_at, user_id)
  VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)
`);
const countActiveByUserStmt = db.prepare(`SELECT COUNT(*) AS n FROM alerts WHERE user_id = ? AND status = 'active'`);
const listByUserStmt = db.prepare(`SELECT * FROM alerts WHERE user_id = ? ORDER BY created_at DESC`);
const getStmt = db.prepare(`SELECT * FROM alerts WHERE id = ?`);
const cancelStmt = db.prepare(`UPDATE alerts SET status = 'cancelled' WHERE id = ? AND user_id = ? AND status = 'active'`);
const activeGroupedStmt = db.prepare(`SELECT DISTINCT code FROM alerts WHERE status = 'active'`);
const activeForCodeStmt = db.prepare(`SELECT * FROM alerts WHERE status = 'active' AND code = ?`);
const markTriggeredStmt = db.prepare(`
  UPDATE alerts SET status = 'triggered', triggered_at = ?, triggered_price = ?, last_checked_at = ? WHERE id = ?
`);
const touchCheckedStmt = db.prepare(`UPDATE alerts SET last_checked_at = ? WHERE id = ?`);
const markEmailResultStmt = db.prepare(`UPDATE alerts SET email_sent = ?, email_error = ? WHERE id = ?`);

const listAllStmt = db.prepare(`
  SELECT alerts.*, users.email AS user_email, users.name AS user_name
  FROM alerts JOIN users ON users.id = alerts.user_id
  ORDER BY alerts.created_at DESC
`);

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
    emailSent: row.email_sent == null ? null : !!row.email_sent,
    emailError: row.email_error ?? null,
    ...(row.user_email ? { userEmail: row.user_email, userName: row.user_name } : {}),
  };
}

export class ValidationError extends Error {}

/** userId/email always come from the authenticated session — never client-supplied. */
export function createAlert({ userId, email, code, direction, targetPrice, lang }) {
  const cleanCode = normalizeCode(code);
  const cleanLang = lang === "en" ? "en" : "ar";

  if (!isValidCode(cleanCode)) throw new ValidationError("Invalid company/ticker code.");
  if (direction !== "buy" && direction !== "sell") throw new ValidationError("direction must be 'buy' or 'sell'.");
  const price = Number(targetPrice);
  if (!Number.isFinite(price) || price <= 0) throw new ValidationError("targetPrice must be a positive number.");

  const activeCount = countActiveByUserStmt.get(userId).n;
  if (activeCount >= MAX_ACTIVE_ALERTS_PER_USER) {
    throw new ValidationError(`Too many active alerts (max ${MAX_ACTIVE_ALERTS_PER_USER}).`);
  }

  const id = randomUUID();
  insertStmt.run(id, cleanCode, email, direction, price, cleanLang, Date.now(), userId);
  return rowToAlert(getStmt.get(id));
}

export function listAlertsByUser(userId) {
  return listByUserStmt.all(userId).map(rowToAlert);
}

export function cancelAlert(id, userId) {
  const result = cancelStmt.run(id, userId);
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

/** Records whether the real email send actually succeeded — visible in the UI as proof this isn't front-end-only. */
export function markEmailResult(id, sent, error) {
  markEmailResultStmt.run(sent ? 1 : 0, error || null, id);
}

/** Admin-only: every alert across every user, for the admin dashboard. */
export function listAllAlerts() {
  return listAllStmt.all().map(rowToAlert);
}
