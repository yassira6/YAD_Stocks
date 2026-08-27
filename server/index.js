import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import NodeCache from "node-cache";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";
import { fetchHistory } from "./lib/priceProvider.js";
import { analyzeSeries } from "./lib/analysis.js";
import { generateDemoHistory } from "./lib/demoData.js";
import { seedCompanies, listCompanies, touchCompanyFromLiveQuote } from "./lib/companies.js";
import { createAlert, listAlertsByUser, cancelAlert, ValidationError } from "./lib/alerts.js";
import { startAlertScheduler } from "./lib/alertScheduler.js";
import { authRouter } from "./lib/authRoutes.js";
import { adminRouter } from "./lib/adminRoutes.js";
import { requireAuth, optionalAuth } from "./lib/auth.js";
import { getMarketStatus } from "./lib/marketHours.js";

const app = express();
const PORT = process.env.PORT || 5174;
const ALERT_CHECK_INTERVAL_MS = Number(process.env.ALERT_CHECK_INTERVAL_MS) || 5 * 60_000;

// Needed so req.protocol reflects "https" (not "http") behind Railway's
// reverse proxy — matters for building correct OAuth redirect_uri values
// and for the session cookie's `secure` flag.
app.set("trust proxy", 1);

// In production this server also hosts the built frontend, so the whole app
// deploys as one process/service (e.g. on Railway) instead of needing two.
const CLIENT_DIST = path.resolve(process.cwd(), "client/dist");
const SERVES_CLIENT = fs.existsSync(CLIENT_DIST);

// Quotes move slowly enough intraday that a short cache meaningfully cuts
// upstream calls without users noticing stale data.
const cache = new NodeCache({ stdTTL: 60, checkperiod: 30 });

// Written by scripts/generate-version.js as part of `npm run build` (root).
// Falls back to computing it directly for local `npm run dev`, where that
// build step doesn't run.
function loadVersionInfo() {
  const versionPath = path.resolve(process.cwd(), "server/version.json");
  try {
    return JSON.parse(fs.readFileSync(versionPath, "utf-8"));
  } catch {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), "package.json"), "utf-8"));
    const git = (cmd, fallback) => {
      try {
        return execSync(cmd, { stdio: ["ignore", "pipe", "ignore"] }).toString().trim();
      } catch {
        return fallback;
      }
    };
    return {
      version: pkg.version,
      buildNumber: Number(git("git rev-list --count HEAD", "0")) || 0,
      commit: git("git rev-parse --short HEAD", "dev"),
      builtAt: null,
    };
  }
}
const VERSION_INFO = loadVersionInfo();
console.log(`[version] v${VERSION_INFO.version} build ${VERSION_INFO.buildNumber} (${VERSION_INFO.commit})`);

const seedResult = seedCompanies();
console.log(`[companies] seeded ${seedResult.inserted}/${seedResult.total} new row(s) from starter directory`);

app.use(cors());
app.use(cookieParser());
app.use(express.json());

const CODE_RE = /^\d{3,5}$/;

app.get("/api/health", (_req, res) => res.json({ ok: true }));

app.get("/api/version", (_req, res) => res.json(VERSION_INFO));

app.get("/api/companies", (_req, res) => {
  res.json(listCompanies());
});

app.get("/api/quote/:code", async (req, res) => {
  const { code } = req.params;
  if (!CODE_RE.test(code)) {
    return res.status(400).json({ error: "Invalid TASI code. Expected 3-5 digits." });
  }

  const cacheKey = `quote:${code}`;
  const cached = cache.get(cacheKey);
  if (cached) return res.json(cached);

  let history;
  let dataSource = "live";
  let liveError = null;

  try {
    // 2y (not just the ~6mo the analysis needs) so the chart has real data
    // to reveal when the user zooms/scrolls out past the initial last-month view.
    history = await fetchHistory(code, { range: "2y", interval: "1d" });
    if (!history.series.length) throw new Error("Empty series returned");
    // Grow the searchable directory from real, confirmed-live lookups only —
    // never from the demo fallback below, which would otherwise let a typo'd
    // or fake code get "confirmed" into the directory via synthetic data.
    touchCompanyFromLiveQuote(code, { displayName: history.displayName, price: history.regularMarketPrice });
  } catch (err) {
    liveError = err.message;
    console.error(`live quote fetch failed for ${code}, falling back to demo data:`, err.message);
    history = generateDemoHistory(code, { days: 500 });
    dataSource = "demo";
  }

  const analysis = analyzeSeries(history.series);
  const market = getMarketStatus();
  const payload = { ...history, analysis, dataSource, liveError, marketOpen: market.open, marketCloseReason: market.reason };
  // While the market's closed, nothing here can change — cache much longer
  // so auto-refreshes (and other visitors looking at the same code) don't
  // re-hit the upstream provider for no reason.
  cache.set(cacheKey, payload, market.open ? 60 : 1800);
  res.json(payload);
});

// --- Auth -------------------------------------------------------------------
// express.urlencoded is scoped to /auth because Apple's callback arrives as
// an x-www-form-urlencoded POST (response_mode=form_post); Google's is a
// plain GET with a query string and doesn't need it, but applying it here is
// harmless either way.
app.use("/auth", express.urlencoded({ extended: false }), authRouter);

app.get("/api/me", optionalAuth, (req, res) => {
  res.json(req.user);
});

app.use("/api/admin", adminRouter);

// --- Alerts -------------------------------------------------------------------
// Every route below requires a signed-in session; email is always the
// authenticated user's own, never a client-supplied field.

// Very small in-memory limiter: protects the alert-creation endpoint (which
// sends email) from being hammered. Not meant as a security boundary, just
// abuse friction — good enough for a single-instance deployment.
const rateBuckets = new Map();
function rateLimit({ max, windowMs }) {
  return (req, res, next) => {
    const key = req.ip || "unknown";
    const now = Date.now();
    const hits = (rateBuckets.get(key) || []).filter((t) => now - t < windowMs);
    if (hits.length >= max) {
      return res.status(429).json({ error: "Too many requests, please try again later." });
    }
    hits.push(now);
    rateBuckets.set(key, hits);
    next();
  };
}

app.post("/api/alerts", requireAuth, rateLimit({ max: 20, windowMs: 10 * 60_000 }), (req, res) => {
  try {
    const alert = createAlert({ ...req.body, userId: req.user.id, email: req.user.email });
    res.status(201).json(alert);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error("[alerts] create failed:", err);
    res.status(500).json({ error: "Could not create alert." });
  }
});

app.get("/api/alerts", requireAuth, (req, res) => {
  res.json(listAlertsByUser(req.user.id));
});

app.delete("/api/alerts/:id", requireAuth, (req, res) => {
  const ok = cancelAlert(req.params.id, req.user.id);
  if (!ok) return res.status(404).json({ error: "Alert not found." });
  res.json({ ok: true });
});

if (SERVES_CLIENT) {
  app.use(express.static(CLIENT_DIST));
  // SPA fallback for any non-API GET (the app is single-page today, and this
  // keeps direct/refresh navigation working if client-side routes are added later).
  app.get(/^(?!\/api\/|\/auth\/).*/, (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
} else {
  console.warn(`client/dist not found at ${CLIENT_DIST} — API-only mode (run "npm run build" in client/ first for a single-service deploy).`);
}

startAlertScheduler(ALERT_CHECK_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`MyShare listening on http://localhost:${PORT}${SERVES_CLIENT ? " (serving API + client)" : " (API only)"}`);
});
