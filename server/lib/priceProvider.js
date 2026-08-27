// Central place to pick where price/history data comes from. Every provider
// module must export an async fetchHistory(code, { range, interval }) that
// resolves to:
//   { symbol, code, currency, exchangeName, displayName, regularMarketPrice,
//     previousClose, regularMarketTime, series: [{date,time,open,high,low,close,volume}] }
// (see lib/yahooProxy.js for the reference implementation). Everything else
// in the app — /api/quote, the alert scheduler, the backtest script — calls
// fetchHistory() from *this* module, never a specific provider directly, so
// adding a new source is: write providers/<name>.js matching that shape,
// register it in PROVIDERS below, and set PRICE_SOURCE=<name>.
import * as yahoo from "./yahooProxy.js";

const PROVIDERS = {
  yahoo,
  // Add another source here once you have one, e.g.:
  // twelvedata: await import("./providers/twelvedata.js"),
};

const requested = (process.env.PRICE_SOURCE || "yahoo").trim().toLowerCase();

let ACTIVE_NAME = requested;
if (!PROVIDERS[requested]) {
  console.warn(
    `[priceProvider] PRICE_SOURCE="${requested}" is not implemented (available: ${Object.keys(PROVIDERS).join(", ")}) — falling back to "yahoo".`
  );
  ACTIVE_NAME = "yahoo";
}

const active = PROVIDERS[ACTIVE_NAME];

export function getPriceSourceName() {
  return ACTIVE_NAME;
}

export function fetchHistory(code, options) {
  return active.fetchHistory(code, options);
}
