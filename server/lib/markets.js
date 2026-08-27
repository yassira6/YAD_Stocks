// Central place for "what kind of code is this" — every other module (quote
// endpoint, alerts, companies directory, market hours, mailer) asks this
// instead of re-deriving its own pattern, so TASI vs. US classification
// can't drift between them.
//
// TASI (Tadawul) codes are 3-5 digit numbers, e.g. "2222" (Aramco).
// US tickers are 1-5 letters, optionally with a share-class suffix like
// "BRK.B" or "BF.B".
const TASI_CODE_RE = /^\d{3,5}$/;
const US_CODE_RE = /^[A-Z]{1,5}(\.[A-Z]{1,2})?$/;

export function normalizeCode(code) {
  return String(code ?? "").trim().toUpperCase();
}

/** Returns "TASI", "US", or null if the code matches neither shape. */
export function detectMarket(code) {
  const c = normalizeCode(code);
  if (TASI_CODE_RE.test(c)) return "TASI";
  if (US_CODE_RE.test(c)) return "US";
  return null;
}

export function isValidCode(code) {
  return detectMarket(code) !== null;
}

export function defaultCurrency(market) {
  return market === "US" ? "USD" : "SAR";
}

export function defaultExchangeName(market) {
  return market === "US" ? "NASDAQ/NYSE" : "Saudi Exchange";
}
