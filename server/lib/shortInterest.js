// Short interest (% of float, short ratio / days-to-cover) for the
// "Long-Term Trading" panel's entry/exit context. This is a genuinely
// different beast from the price data the rest of the app uses:
//
// - It comes from a different Yahoo endpoint (quoteSummary, not the chart
//   API lib/yahooProxy.js already uses) — a module this app didn't
//   previously call.
// - It's US-market-only: short-interest reporting (FINRA-style bi-monthly
//   disclosure) is a US regulatory thing Yahoo surfaces for NYSE/NASDAQ
//   tickers. Tadawul has no equivalent public feed via Yahoo, so this is
//   never attempted for TASI codes — no silent wrong-market guess.
// - It updates on a settlement lag (roughly twice a month in practice),
//   never "live" the way a price is — shown with its own as-of date rather
//   than implied to be current.
// - This sandbox's network access to Yahoo is blocked, so unlike the price
//   endpoint (which has an established, tested live/demo fallback), this
//   specific integration could not be exercised against a real response
//   here — only shaped from the documented/known field layout. It fails
//   closed (returns null, panel section just doesn't render) on anything
//   unexpected rather than risk showing a wrong number.
import NodeCache from "node-cache";
import { detectMarket, normalizeCode } from "./markets.js";

const QUOTE_SUMMARY_BASE = "https://query2.finance.yahoo.com/v10/finance/quoteSummary";
// Changes at most a couple of times a month — no reason to refetch more than daily.
const cache = new NodeCache({ stdTTL: 24 * 60 * 60, checkperiod: 3600 });

function unwrapRaw(field) {
  if (field == null) return null;
  if (typeof field === "object" && "raw" in field) return field.raw ?? null;
  return typeof field === "number" ? field : null;
}

export async function fetchShortInterest(code) {
  const normalized = normalizeCode(code);
  if (detectMarket(normalized) !== "US") return null;

  const cached = cache.get(normalized);
  if (cached !== undefined) return cached;

  let result = null;
  try {
    const url = `${QUOTE_SUMMARY_BASE}/${encodeURIComponent(normalized)}?modules=defaultKeyStatistics`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(6000),
    });
    if (res.ok) {
      const json = await res.json();
      const stats = json?.quoteSummary?.result?.[0]?.defaultKeyStatistics;
      const shortPercentOfFloat = unwrapRaw(stats?.shortPercentOfFloat);
      const shortRatio = unwrapRaw(stats?.shortRatio);
      const sharesShort = unwrapRaw(stats?.sharesShort);
      const floatShares = unwrapRaw(stats?.floatShares);
      const sharesShortDate = unwrapRaw(stats?.sharesShortPreviousMonthDate ?? stats?.dateShortInterest);
      if (shortPercentOfFloat != null || shortRatio != null) {
        result = {
          shortPercentOfFloat,
          shortRatio,
          sharesShort,
          floatShares,
          asOf: sharesShortDate ? sharesShortDate * 1000 : null,
        };
      }
    }
  } catch {
    // Network/parse failure — fail closed, no short-interest section shown for this quote.
    result = null;
  }

  cache.set(normalized, result);
  return result;
}
