import { randomUUID } from "node:crypto";
import { db } from "./db.js";

const insertStmt = db.prepare(`
  INSERT INTO admin_emails (id, user_id, sent_by, subject, body, sent, error, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const listForUserStmt = db.prepare(`SELECT * FROM admin_emails WHERE user_id = ? ORDER BY created_at DESC`);

function rowToRecord(row) {
  return {
    id: row.id,
    userId: row.user_id,
    sentBy: row.sent_by,
    subject: row.subject,
    body: row.body,
    sent: row.sent == null ? null : !!row.sent,
    error: row.error,
    createdAt: row.created_at,
  };
}

export function recordAdminEmail({ userId, sentBy, subject, body, sent, error }) {
  const id = randomUUID();
  insertStmt.run(id, userId, sentBy, subject, body, sent ? 1 : 0, error || null, Date.now());
  return id;
}

export function listAdminEmailsForUser(userId) {
  return listForUserStmt.all(userId).map(rowToRecord);
}
