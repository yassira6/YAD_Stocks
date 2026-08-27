import { randomUUID } from "node:crypto";
import { db } from "./db.js";

export const SESSION_COOKIE = "myshare_session";
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "yassira6@gmail.com").trim().toLowerCase();

const findByEmailStmt = db.prepare(`SELECT * FROM users WHERE email = ?`);
const insertUserStmt = db.prepare(`
  INSERT INTO users (id, email, name, picture, provider, provider_user_id, is_admin, created_at, last_login_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);
const touchUserStmt = db.prepare(`
  UPDATE users SET name = ?, picture = ?, provider = ?, provider_user_id = ?, is_admin = ?, last_login_at = ?
  WHERE id = ?
`);
const getUserStmt = db.prepare(`SELECT * FROM users WHERE id = ?`);
const listUsersStmt = db.prepare(`SELECT * FROM users ORDER BY last_login_at DESC`);

const insertSessionStmt = db.prepare(`INSERT INTO sessions (id, user_id, created_at, expires_at) VALUES (?, ?, ?, ?)`);
const getSessionStmt = db.prepare(`SELECT * FROM sessions WHERE id = ?`);
const deleteSessionStmt = db.prepare(`DELETE FROM sessions WHERE id = ?`);

function rowToUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    picture: row.picture,
    provider: row.provider,
    isAdmin: !!row.is_admin,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
  };
}

/** Creates the user on first login, or updates profile info + admin flag on every subsequent one. */
export function upsertUserFromClaims({ email, name, picture, provider, providerUserId }) {
  const cleanEmail = String(email).trim().toLowerCase();
  const isAdmin = cleanEmail === ADMIN_EMAIL ? 1 : 0;
  const now = Date.now();

  const existing = findByEmailStmt.get(cleanEmail);
  if (existing) {
    touchUserStmt.run(name || existing.name, picture || existing.picture, provider, providerUserId, isAdmin, now, existing.id);
    return rowToUser(getUserStmt.get(existing.id));
  }

  const id = randomUUID();
  insertUserStmt.run(id, cleanEmail, name || null, picture || null, provider, providerUserId, isAdmin, now, now);
  return rowToUser(getUserStmt.get(id));
}

export function createSession(userId) {
  const id = randomUUID();
  const now = Date.now();
  insertSessionStmt.run(id, userId, now, now + SESSION_TTL_MS);
  return { id, expiresAt: now + SESSION_TTL_MS };
}

export function destroySession(sessionId) {
  deleteSessionStmt.run(sessionId);
}

export function getUserForSession(sessionId) {
  if (!sessionId) return null;
  const session = getSessionStmt.get(sessionId);
  if (!session) return null;
  if (session.expires_at < Date.now()) {
    deleteSessionStmt.run(sessionId);
    return null;
  }
  return rowToUser(getUserStmt.get(session.user_id));
}

export function listAllUsers() {
  return listUsersStmt.all().map(rowToUser);
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_MS,
    path: "/",
  };
}

/** Attaches req.user if a valid session cookie is present; never blocks the request. */
export function optionalAuth(req, _res, next) {
  req.user = getUserForSession(req.cookies?.[SESSION_COOKIE]);
  next();
}

export function requireAuth(req, res, next) {
  const user = getUserForSession(req.cookies?.[SESSION_COOKIE]);
  if (!user) return res.status(401).json({ error: "Sign in required." });
  req.user = user;
  next();
}

export function requireAdmin(req, res, next) {
  requireAuth(req, res, () => {
    if (!req.user.isAdmin) return res.status(403).json({ error: "Admin access required." });
    next();
  });
}
