import express from "express";
import jwt from "jsonwebtoken";
import * as client from "openid-client";
import { getGoogleConfig, getAppleConfig, isGoogleConfigured, isAppleConfigured } from "./oidcProviders.js";
import { getAppSecret } from "./appSecret.js";
import { upsertUserFromClaims, createSession, destroySession, cookieOptions, SESSION_COOKIE } from "./auth.js";

export const authRouter = express.Router();

function baseUrl(req) {
  return process.env.APP_URL?.replace(/\/$/, "") || `${req.protocol}://${req.get("host")}`;
}

// The OAuth "state" round-trip is a signed, self-contained JWT (not a
// server-side session or cookie) carrying the PKCE verifier + nonce. This
// sidesteps a real gotcha with Apple's flow: it POSTs back cross-site
// (response_mode=form_post), and a cookie set with SameSite=Lax right before
// redirecting to Apple would NOT be sent back on that cross-site POST, which
// would otherwise break the CSRF-state check specifically for Apple.
function signTxn(payload) {
  return jwt.sign(payload, getAppSecret(), { expiresIn: "10m" });
}

function verifyTxn(token, expectedProvider) {
  const payload = jwt.verify(token, getAppSecret());
  if (payload.provider !== expectedProvider) throw new Error("Provider mismatch in OAuth state.");
  return payload;
}

async function startLogin(req, res, provider) {
  const config = provider === "google" ? await getGoogleConfig() : await getAppleConfig();
  if (!config) {
    return res.redirect(`/#/login?error=${provider}_not_configured`);
  }

  const codeVerifier = client.randomPKCECodeVerifier();
  const codeChallenge = await client.calculatePKCECodeChallenge(codeVerifier);
  const nonce = client.randomNonce();
  const state = signTxn({ provider, codeVerifier, nonce });

  const params = {
    redirect_uri: `${baseUrl(req)}/auth/${provider}/callback`,
    scope: provider === "google" ? "openid email profile" : "openid email name",
    state,
    nonce,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  };
  if (provider === "apple") params.response_mode = "form_post";

  const url = client.buildAuthorizationUrl(config, params);
  res.redirect(url.href);
}

async function finishLogin(req, res, provider, currentUrl, stateValue) {
  try {
    const config = provider === "google" ? await getGoogleConfig() : await getAppleConfig();
    if (!config) return res.redirect(`/#/login?error=${provider}_not_configured`);

    const txn = verifyTxn(stateValue, provider);
    const tokens = await client.authorizationCodeGrant(config, currentUrl, {
      pkceCodeVerifier: txn.codeVerifier,
      expectedNonce: txn.nonce,
      expectedState: stateValue,
    });
    const claims = tokens.claims();
    if (!claims?.email) {
      throw new Error("Provider did not return an email address.");
    }

    // Apple only sends the user's name on their very first authorization,
    // as a JSON blob in the form_post body -- never again after that.
    let name = claims.name || null;
    if (provider === "apple" && req.body?.user) {
      try {
        const parsed = JSON.parse(req.body.user);
        name = [parsed?.name?.firstName, parsed?.name?.lastName].filter(Boolean).join(" ") || name;
      } catch {
        // ignore malformed/absent user blob
      }
    }

    const user = upsertUserFromClaims({
      email: claims.email,
      name,
      picture: claims.picture || null,
      provider,
      providerUserId: claims.sub,
    });

    const session = createSession(user.id);
    res.cookie(SESSION_COOKIE, session.id, cookieOptions());
    res.redirect("/#/alerts");
  } catch (err) {
    console.error(`[auth] ${provider} login failed:`, err);
    res.redirect(`/#/login?error=${provider}_failed`);
  }
}

authRouter.get("/google", (req, res) => startLogin(req, res, "google"));
authRouter.get("/apple", (req, res) => startLogin(req, res, "apple"));

authRouter.get("/google/callback", (req, res) => {
  const currentUrl = new URL(req.originalUrl, baseUrl(req));
  finishLogin(req, res, "google", currentUrl, req.query.state);
});

// Apple uses response_mode=form_post, so the callback arrives as a POST with
// an x-www-form-urlencoded body (parsed by express.urlencoded, mounted just
// on this route in index.js) rather than a query string.
authRouter.post("/apple/callback", (req, res) => {
  const url = new URL(req.originalUrl, baseUrl(req));
  const currentRequest = new Request(url, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(req.body).toString(),
  });
  finishLogin(req, res, "apple", currentRequest, req.body.state);
});

authRouter.post("/logout", (req, res) => {
  const sid = req.cookies?.[SESSION_COOKIE];
  if (sid) destroySession(sid);
  res.clearCookie(SESSION_COOKIE, { path: "/" });
  res.json({ ok: true });
});

authRouter.get("/status", (_req, res) => {
  res.json({ google: isGoogleConfigured(), apple: isAppleConfigured() });
});
