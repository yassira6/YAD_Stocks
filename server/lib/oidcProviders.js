import * as client from "openid-client";
import jwt from "jsonwebtoken";

// Configuration is fetched lazily (on first login attempt, not at server
// startup) and cached, so a deployment without OAuth credentials configured
// -- or without network access to Google/Apple -- still starts up fine and
// only fails when someone actually tries that specific login button.

let googleConfigPromise = null;
let appleConfigPromise = null;

export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function isAppleConfigured() {
  return Boolean(
    process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY
  );
}

export async function getGoogleConfig() {
  if (!isGoogleConfigured()) return null;
  if (!googleConfigPromise) {
    googleConfigPromise = client.discovery(
      new URL("https://accounts.google.com"),
      process.env.GOOGLE_CLIENT_ID,
      { client_secret: process.env.GOOGLE_CLIENT_SECRET }
    );
  }
  return googleConfigPromise;
}

/**
 * Apple Sign In doesn't use a static client secret: it's a short-lived ES256
 * JWT you generate yourself, signed with the private key downloaded from
 * the Apple Developer portal for your "Sign in with Apple" key.
 * Claims per Apple's spec: iss=Team ID, sub=Services ID (client_id),
 * aud=https://appleid.apple.com. Regenerated fresh on every use (cheap,
 * avoids any caching/expiry bugs) rather than reused across requests.
 * https://developer.apple.com/documentation/sign_in_with_apple/generate_and_validate_tokens
 */
function generateAppleClientSecret() {
  const now = Math.floor(Date.now() / 1000);
  return jwt.sign(
    {
      iss: process.env.APPLE_TEAM_ID,
      iat: now,
      exp: now + 60 * 10, // only needs to live long enough for the token exchange
      aud: "https://appleid.apple.com",
      sub: process.env.APPLE_CLIENT_ID,
    },
    process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
    { algorithm: "ES256", keyid: process.env.APPLE_KEY_ID }
  );
}

export async function getAppleConfig() {
  if (!isAppleConfigured()) return null;
  // Apple's client secret expires, so re-discover (cheaply, from cache after
  // the first real network call) with a freshly-signed one each time rather
  // than reusing a Configuration that could outlive its secret.
  return client.discovery(
    new URL("https://appleid.apple.com"),
    process.env.APPLE_CLIENT_ID,
    { client_secret: generateAppleClientSecret() },
    client.ClientSecretPost(generateAppleClientSecret())
  );
}

if (!isGoogleConfigured()) {
  console.warn("[auth] GOOGLE_CLIENT_ID/GOOGLE_CLIENT_SECRET not set — Google sign-in disabled.");
}
if (!isAppleConfigured()) {
  console.warn(
    "[auth] APPLE_CLIENT_ID/APPLE_TEAM_ID/APPLE_KEY_ID/APPLE_PRIVATE_KEY not set — Apple sign-in disabled."
  );
}
