import crypto from "node:crypto";

// Used only to sign the short-lived, self-contained OAuth "state" JWT (see
// authRoutes.js) — never for sessions themselves, which are opaque random
// tokens looked up in the DB. Set SESSION_SECRET in production so an
// in-flight login (the few seconds between redirecting to Google/Apple and
// their callback) survives a server restart; without it a fresh random
// secret is generated per process, which just means logins started right
// before a restart/redeploy need to be retried.
let fallbackSecret = null;
let warned = false;

export function getAppSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (!warned) {
    console.warn(
      "[auth] SESSION_SECRET not set — using a random per-process secret. Set SESSION_SECRET in production."
    );
    warned = true;
  }
  if (!fallbackSecret) fallbackSecret = crypto.randomBytes(32).toString("hex");
  return fallbackSecret;
}
