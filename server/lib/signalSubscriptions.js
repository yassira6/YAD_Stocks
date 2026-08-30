import { randomUUID } from "node:crypto";
import { db } from "./db.js";

const getSubStmt = db.prepare(`SELECT * FROM signal_subscriptions WHERE user_id = ?`);
const upsertSubStmt = db.prepare(`
  INSERT INTO signal_subscriptions (user_id, email_enabled, push_enabled, lang, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(user_id) DO UPDATE SET email_enabled = excluded.email_enabled, push_enabled = excluded.push_enabled, lang = excluded.lang, updated_at = excluded.updated_at
`);

function rowToSubscription(row) {
  return {
    emailEnabled: row ? !!row.email_enabled : false,
    pushEnabled: row ? !!row.push_enabled : false,
    lang: row?.lang === "en" ? "en" : "ar",
  };
}

export function getSignalSubscription(userId) {
  return rowToSubscription(getSubStmt.get(userId));
}

export function setSignalSubscription(userId, { emailEnabled, pushEnabled, lang }) {
  const now = Date.now();
  const cleanLang = lang === "en" ? "en" : "ar";
  upsertSubStmt.run(userId, emailEnabled ? 1 : 0, pushEnabled ? 1 : 0, cleanLang, now, now);
  return getSignalSubscription(userId);
}

// --- Push subscription objects (per browser/device) -------------------------

const insertPushStmt = db.prepare(`
  INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, created_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(endpoint) DO UPDATE SET user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth
`);
const deletePushByEndpointStmt = db.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`);
const deletePushByUserStmt = db.prepare(`DELETE FROM push_subscriptions WHERE user_id = ?`);
const countPushForUserStmt = db.prepare(`SELECT COUNT(*) AS n FROM push_subscriptions WHERE user_id = ?`);
const listPushForUserStmt = db.prepare(`SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?`);

export function addPushSubscription(userId, { endpoint, p256dh, auth }) {
  insertPushStmt.run(randomUUID(), userId, endpoint, p256dh, auth, Date.now());
}

export function removePushSubscription(endpoint) {
  deletePushByEndpointStmt.run(endpoint);
}

export function removeAllPushSubscriptionsForUser(userId) {
  deletePushByUserStmt.run(userId);
}

export function hasPushRegistration(userId) {
  return countPushForUserStmt.get(userId).n > 0;
}

/**
 * Every device/browser a user has registered for push, regardless of which
 * feature (Signals, per-alert push, admin push) triggers the send — the
 * registration itself is shared, since a user only grants notification
 * permission once.
 */
export function listPushSubscriptionsForUser(userId) {
  return listPushForUserStmt.all(userId);
}

// --- Notification fan-out ----------------------------------------------------

const listEmailSubscribersStmt = db.prepare(`
  SELECT users.id AS user_id, users.email, users.name, signal_subscriptions.lang
  FROM signal_subscriptions
  JOIN users ON users.id = signal_subscriptions.user_id
  WHERE signal_subscriptions.email_enabled = 1
`);
/** Every user opted into email signal notifications, with their email/name/lang. */
export function listEmailSignalSubscribers() {
  return listEmailSubscribersStmt.all();
}

const listPushSubscriptionsStmt = db.prepare(`
  SELECT push_subscriptions.endpoint, push_subscriptions.p256dh, push_subscriptions.auth, push_subscriptions.user_id
  FROM push_subscriptions
  JOIN signal_subscriptions ON signal_subscriptions.user_id = push_subscriptions.user_id
  WHERE signal_subscriptions.push_enabled = 1
`);
/** Every push_subscriptions row belonging to a user opted into push signal notifications. */
export function listPushSignalSubscriptions() {
  return listPushSubscriptionsStmt.all();
}

/** Admin-only: counts for the dashboard. */
export function countSignalSubscribers() {
  const email = db.prepare(`SELECT COUNT(*) AS n FROM signal_subscriptions WHERE email_enabled = 1`).get().n;
  const push = db.prepare(`SELECT COUNT(DISTINCT user_id) AS n FROM signal_subscriptions WHERE push_enabled = 1`).get().n;
  return { email, push };
}
