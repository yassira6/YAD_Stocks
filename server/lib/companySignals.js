import { db } from "./db.js";

const getStmt = db.prepare(`SELECT * FROM company_signals WHERE code = ?`);
const upsertStmt = db.prepare(`
  INSERT INTO company_signals (code, last_verdict, last_score, last_notified_verdict, last_notified_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?)
  ON CONFLICT(code) DO UPDATE SET
    last_verdict = excluded.last_verdict,
    last_score = excluded.last_score,
    last_notified_verdict = excluded.last_notified_verdict,
    last_notified_at = excluded.last_notified_at,
    updated_at = excluded.updated_at
`);
const listActiveStmt = db.prepare(`
  SELECT * FROM company_signals WHERE last_verdict IN ('strong_buy', 'strong_sell') ORDER BY updated_at DESC
`);

function rowToSignal(row) {
  if (!row) return null;
  return {
    code: row.code,
    lastVerdict: row.last_verdict,
    lastScore: row.last_score,
    lastNotifiedVerdict: row.last_notified_verdict,
    lastNotifiedAt: row.last_notified_at,
    updatedAt: row.updated_at,
  };
}

export function getCompanySignal(code) {
  return rowToSignal(getStmt.get(code));
}

/**
 * Records the latest verdict for a code and reports whether it's a *new*
 * strong signal worth notifying subscribers about — i.e. the verdict is
 * strong_buy/strong_sell now, and it wasn't the last verdict we already
 * notified people about (so a signal that stays "Strong Buy" for a week
 * fires once, not on every scan; but if it flips strong_buy -> hold ->
 * strong_buy again later, that's treated as a fresh signal).
 */
export function recordCompanySignal(code, verdict, score) {
  const prev = getStmt.get(code);
  const isStrong = verdict === "strong_buy" || verdict === "strong_sell";
  const alreadyNotifiedThisVerdict = isStrong && prev?.last_notified_verdict === verdict;
  const isNewSignal = isStrong && !alreadyNotifiedThisVerdict;

  const now = Date.now();
  // The "already notified" marker only means something while the verdict is
  // still strong — once it drifts back to hold/buy/sell, clear it so a later
  // return to strong_buy/strong_sell is treated as a fresh signal rather than
  // silently suppressed forever.
  const nextNotifiedVerdict = isStrong ? (isNewSignal ? verdict : prev?.last_notified_verdict ?? null) : null;
  const nextNotifiedAt = isStrong ? (isNewSignal ? now : prev?.last_notified_at ?? null) : null;

  upsertStmt.run(code, verdict, score ?? null, nextNotifiedVerdict, nextNotifiedAt, now);

  return isNewSignal;
}

/** Admin-only: every company currently showing a strong buy/sell verdict. */
export function listActiveSignals() {
  return listActiveStmt.all().map(rowToSignal);
}
