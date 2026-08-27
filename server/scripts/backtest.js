#!/usr/bin/env node
// Walk-forward backtest of the price-targets algorithm (server/lib/analysis.js).
//
// For every trading day in a company's history (after a warmup window), it
// re-runs the exact same analysis the live app would have run "as of" that
// day, then looks forward up to --horizon trading days to see whether price
// actually reached the targetSell (upside) or targetBuy (downside) level the
// algorithm produced that day, and if so, how many days it took. Results are
// aggregated by verdict bucket (strong_buy/buy/hold/sell/strong_sell).
//
// Usage:
//   node server/scripts/backtest.js [--horizon=40] [--range=1y] [CODE...]
//   node server/scripts/backtest.js 2222 1120 1180 2010
//
// IMPORTANT — read before trusting the numbers:
// This was built and run in a sandboxed dev environment with no network
// access to Yahoo Finance (see README "Data source" section), so it falls
// back to the SAME synthetic random-walk generator the app uses when Yahoo
// is unreachable (server/lib/demoData.js). A synthetic random walk has no
// real market structure (no actual support/resistance, no real crowd
// behavior), so hit-rates/timing measured against it validate the
// MECHANISM (the code runs correctly, targets are internally consistent,
// nothing crashes on a year of data) — they are NOT evidence the algorithm
// has predictive edge on real TASI prices. Re-run this exact script with a
// working Yahoo connection (i.e. from a normal machine, not this sandbox)
// for numbers that actually mean something; the script already prefers
// live data automatically whenever fetchHistory() succeeds.

import { fetchHistory } from "../lib/yahooProxy.js";
import { generateDemoHistory } from "../lib/demoData.js";
import { analyzeSeries } from "../lib/analysis.js";

const DEFAULT_CODES = ["2222", "2010", "1120", "1180", "1211", "2280", "7010", "8010"];

function parseArgs(argv) {
  const codes = [];
  let horizon = 40;
  let range = "1y";
  for (const arg of argv) {
    if (arg.startsWith("--horizon=")) horizon = Number(arg.split("=")[1]);
    else if (arg.startsWith("--range=")) range = arg.split("=")[1];
    else codes.push(arg);
  }
  return { codes: codes.length ? codes : DEFAULT_CODES, horizon, range };
}

async function getYearOfBars(code, range) {
  try {
    const history = await fetchHistory(code, { range, interval: "1d" });
    if (history.series.length >= 150) {
      return { bars: history.series, source: "live" };
    }
    throw new Error("live series too short");
  } catch (err) {
    // Matches the app's own days-per-range mapping closely enough for a backtest.
    const days = range === "1y" ? 260 : range === "6mo" ? 130 : 260;
    return { bars: generateDemoHistory(code, { days }).series, source: "demo" };
  }
}

function newBucket() {
  return { count: 0, sellHits: 0, sellDays: [], buyHits: 0, buyDays: [] };
}

function median(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function mean(arr) {
  return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
}

async function backtestCode(code, { horizon, range }) {
  const { bars, source } = await getYearOfBars(code, range);
  const WARMUP = 130;
  const buckets = {};
  let testedDays = 0;

  for (let i = WARMUP; i < bars.length - 1; i++) {
    const window = bars.slice(0, i + 1);
    const analysis = analyzeSeries(window);
    if (analysis.insufficientData || !analysis.priceTargets) continue;

    const { verdict, priceTargets } = analysis;
    const bucket = (buckets[verdict] ??= newBucket());
    bucket.count += 1;
    testedDays += 1;

    const end = Math.min(i + horizon, bars.length - 1);
    let sellHitDay = null;
    let buyHitDay = null;
    for (let j = i + 1; j <= end; j++) {
      if (sellHitDay === null && bars[j].high >= priceTargets.targetSell) sellHitDay = j - i;
      if (buyHitDay === null && bars[j].low <= priceTargets.targetBuy) buyHitDay = j - i;
      if (sellHitDay !== null && buyHitDay !== null) break;
    }
    if (sellHitDay !== null) {
      bucket.sellHits += 1;
      bucket.sellDays.push(sellHitDay);
    }
    if (buyHitDay !== null) {
      bucket.buyHits += 1;
      bucket.buyDays.push(buyHitDay);
    }
  }

  return { code, source, testedDays, buckets };
}

function mergeBuckets(target, source) {
  for (const [verdict, b] of Object.entries(source)) {
    const t = (target[verdict] ??= newBucket());
    t.count += b.count;
    t.sellHits += b.sellHits;
    t.sellDays.push(...b.sellDays);
    t.buyHits += b.buyHits;
    t.buyDays.push(...b.buyDays);
  }
}

function pct(n, d) {
  return d ? `${((n / d) * 100).toFixed(0)}%` : "—";
}

function fmtDays(arr) {
  const m = mean(arr);
  const med = median(arr);
  return m == null ? "—" : `avg ${m.toFixed(1)}d / median ${med.toFixed(0)}d`;
}

async function main() {
  const { codes, horizon, range } = parseArgs(process.argv.slice(2));
  console.log(`Backtesting ${codes.length} code(s), horizon=${horizon} trading days, range=${range}\n`);

  const pooled = {};
  let anyLive = false;

  for (const code of codes) {
    const result = await backtestCode(code, { horizon, range });
    console.log(
      `${code}: ${result.testedDays} test day(s) [source: ${result.source}${result.source === "demo" ? " — synthetic, see header comment" : ""}]`
    );
    if (result.source === "live") anyLive = true;
    mergeBuckets(pooled, result.buckets);
  }

  console.log("\n=== Pooled results by verdict ===\n");
  const verdictOrder = ["strong_sell", "sell", "hold", "buy", "strong_buy"];
  const header = ["verdict", "n", "sell-target hit%", "sell-target timing", "buy-target hit%", "buy-target timing"];
  const rows = [header];
  for (const verdict of verdictOrder) {
    const b = pooled[verdict];
    if (!b || b.count === 0) continue;
    rows.push([
      verdict,
      String(b.count),
      pct(b.sellHits, b.count),
      fmtDays(b.sellDays),
      pct(b.buyHits, b.count),
      fmtDays(b.buyDays),
    ]);
  }
  const widths = header.map((_, col) => Math.max(...rows.map((r) => r[col].length)));
  for (const row of rows) {
    console.log(row.map((cell, i) => cell.padEnd(widths[i])).join("  "));
  }

  console.log(
    anyLive
      ? "\nNote: mix of live and/or synthetic data — see per-code source above."
      : "\nAll series above are SYNTHETIC (no live network access in this environment) — mechanism check only, not a real-market validation. See the header comment in this script."
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
