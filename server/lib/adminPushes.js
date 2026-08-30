import { randomUUID } from "node:crypto";
import { db } from "./db.js";

const insertStmt = db.prepare(`
  INSERT INTO admin_pushes (id, user_id, sent_by, title, body, sent, error, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const listForUserStmt = db.prepare(`SELECT * FROM admin_pushes WHERE user_id = ? ORDER BY created_at DESC`);

function rowToRecord(row) {
  return {
    id: row.id,
    userId: row.user_id,
    sentBy: row.sent_by,
    title: row.title,
    body: row.body,
    sent: row.sent == null ? null : !!row.sent,
    error: row.error,
    createdAt: row.created_at,
  };
}

export function recordAdminPush({ userId, sentBy, title, body, sent, error }) {
  const id = randomUUID();
  insertStmt.run(id, userId, sentBy, title, body, sent ? 1 : 0, error || null, Date.now());
  return id;
}

export function listAdminPushesForUser(userId) {
  return listForUserStmt.all(userId).map(rowToRecord);
}
