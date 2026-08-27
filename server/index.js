import express from "express";
import cors from "cors";
import NodeCache from "node-cache";
import path from "node:path";
import fs from "node:fs";
import { fetchHistory } from "./lib/yahooProxy.js";
import { analyzeSeries } from "./lib/analysis.js";
import { generateDemoHistory } from "./lib/demoData.js";
import { seedCompanies, listCompanies, touchCompanyFromLiveQuote } from "./lib/companies.js";
import { createAlert, listAlertsByEmail, cancelAlert, ValidationError } from "./lib/alerts.js";
import { startAlertScheduler } from "./lib/alertScheduler.js";

const app = express();
const PORT = process.env.PORT || 5174;
const ALERT_CHECK_INTERVAL_MS = Number(process.env.ALERT_CHECK_INTERVAL_MS) || 5 * 60_000;

// In production this server also hosts the built frontend, so the whole app
// deploys as one process/service (e.g. on Railway) instead of needing two.
const CLIENT_DIST = path.resolve(process.cwd(), "client/dist");
const SERVES_CLIENT = fs.existsSync(CLIENT_DIST);

// Quotes move slowly enough intraday that a short cache meaningfully cuts
// upstream calls without users noticing stale data.
const cache = new NodeCache({ stdTTL: 60, checkperiod: 30 });

const seedResult = seedCompanies();
console.log(`[companies] seeded ${seedResult.inserted}/${seedResult.total} new row(s) from starter directory`);

app.use(cors());
app.use(express.json());

const CODE_RE = /^\d{3,5}$/;

app.get("/api/health", (_req, res) => res.json({ ok: true }));

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
    history = await fetchHistory(code, { range: "6mo", interval: "1d" });
    if (!history.series.length) throw new Error("Empty series returned");
    // Grow the searchable directory from real, confirmed-live lookups only —
    // never from the demo fallback below, which would otherwise let a typo'd
    // or fake code get "confirmed" into the directory via synthetic data.
    touchCompanyFromLiveQuote(code, { displayName: history.displayName, price: history.regularMarketPrice });
  } catch (err) {
    liveError = err.message;
    console.error(`live quote fetch failed for ${code}, falling back to demo data:`, err.message);
    history = generateDemoHistory(code);
    dataSource = "demo";
  }

  const analysis = analyzeSeries(history.series);
  const payload = { ...history, analysis, dataSource, liveError };
  cache.set(cacheKey, payload);
  res.json(payload);
});

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

app.post("/api/alerts", rateLimit({ max: 20, windowMs: 10 * 60_000 }), (req, res) => {
  try {
    const alert = createAlert(req.body || {});
    res.status(201).json(alert);
  } catch (err) {
    if (err instanceof ValidationError) {
      return res.status(400).json({ error: err.message });
    }
    console.error("[alerts] create failed:", err);
    res.status(500).json({ error: "Could not create alert." });
  }
});

app.get("/api/alerts", (req, res) => {
  const email = String(req.query.email || "");
  res.json(listAlertsByEmail(email));
});

app.delete("/api/alerts/:id", (req, res) => {
  const email = String(req.query.email || "");
  const ok = cancelAlert(req.params.id, email);
  if (!ok) return res.status(404).json({ error: "Alert not found for this email." });
  res.json({ ok: true });
});

if (SERVES_CLIENT) {
  app.use(express.static(CLIENT_DIST));
  // SPA fallback for any non-API GET (the app is single-page today, and this
  // keeps direct/refresh navigation working if client-side routes are added later).
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(CLIENT_DIST, "index.html"));
  });
} else {
  console.warn(`client/dist not found at ${CLIENT_DIST} — API-only mode (run "npm run build" in client/ first for a single-service deploy).`);
}

startAlertScheduler(ALERT_CHECK_INTERVAL_MS);

app.listen(PORT, () => {
  console.log(`MyShare listening on http://localhost:${PORT}${SERVES_CLIENT ? " (serving API + client)" : " (API only)"}`);
});
