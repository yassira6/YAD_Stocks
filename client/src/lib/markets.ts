// Mirrors server/lib/markets.js — kept in sync by hand since client and
// server are separate bundles. Used where the UI needs to guess a market
// from a bare code without waiting on a quote response (e.g. formatting an
// alert's target price in its own currency in a list of alerts).
const TASI_CODE_RE = /^\d{3,5}$/;
const US_CODE_RE = /^[A-Z]{1,5}(\.[A-Z]{1,2})?$/;

export type Market = "TASI" | "US";

export function detectMarket(code: string): Market {
  const c = code.trim().toUpperCase();
  return TASI_CODE_RE.test(c) ? "TASI" : "US";
}

export function isValidCode(code: string): boolean {
  const c = code.trim().toUpperCase();
  return TASI_CODE_RE.test(c) || US_CODE_RE.test(c);
}

export function defaultCurrency(market: Market): string {
  return market === "US" ? "USD" : "SAR";
}
