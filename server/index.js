import express from "express";
import cors from "cors";
import NodeCache from "node-cache";
import path from "node:path";
import fs from "node:fs";
import { fetchHistory } from "./lib/yahooProxy.js";
import { analyzeSeries } from "./lib/analysis.js";
import { generateDemoHistory } from "./lib/demoData.js";

const app = express();
const PORT = process.env.PORT || 5174;

// In production this server also hosts the built frontend, so the whole app
// deploys as one process/service (e.g. on Railway) instead of needing two.
const CLIENT_DIST = path.resolve(process.cwd(), "client/dist");
const SERVES_CLIENT = fs.existsSync(CLIENT_DIST);

// Quotes move slowly enough intraday that a short cache meaningfully cuts
// upstream calls without users noticing stale data.
const cache = new NodeCache({ stdTTL: 60, checkperiod: 30 });

app.use(cors());

const CODE_RE = /^\d{3,5}$/;

app.get("/api/health", (_req, res) => res.json({ ok: true }));

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

app.listen(PORT, () => {
  console.log(`YAD Stocks listening on http://localhost:${PORT}${SERVES_CLIENT ? " (serving API + client)" : " (API only)"}`);
});
