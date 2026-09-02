import { fetchHistory } from "./priceProvider.js";
import { analyzeSeries } from "./analysis.js";
import { listCompanies } from "./companies.js";
import { isMarketOpen } from "./marketHours.js";
import { detectMarket } from "./markets.js";
import { recordCompanySignal } from "./companySignals.js";
import { sendSignalEmail } from "./mailer.js";
import { sendPush } from "./pushNotifications.js";
import {
  listEmailSignalSubscribers,
  listPushSignalSubscriptions,
  removePushSubscription,
} from "./signalSubscriptions.js";

/**
 * Notifies every opted-in subscriber that `code` just turned strong_buy or
 * strong_sell. Email and push are independent — a subscriber only gets what
 * they opted into. A dead/expired push subscription (410/404) is deleted so
 * it stops being retried on future signals.
 */
async function notifySubscribers(signal) {
  const emailSubscribers = listEmailSignalSubscribers(signal.code);
  for (const sub of emailSubscribers) {
    try {
      await sendSignalEmail(sub.email, sub.lang, signal);
    } catch (err) {
      console.error(`[signals] email notify failed for ${sub.email}:`, err.message);
    }
  }

  const pushSubscriptions = listPushSignalSubscriptions(signal.code);
  const payload = {
    title: signal.verdict === "strong_buy" ? "🚀 Strong Buy signal" : "⚠️ Strong Sell signal",
    body: `${signal.nameEn || signal.code} (${signal.code}) — score ${signal.score > 0 ? "+" : ""}${signal.score}`,
    url: `/?code=${signal.code}`,
  };
  for (const sub of pushSubscriptions) {
    const result = await sendPush(sub, payload);
    if (result.expired) removePushSubscription(sub.endpoint);
  }
}

/**
 * Scans every company in the directory whose market is currently open,
 * computes its technical analysis, and notifies subscribers about any
 * *newly* strong_buy/strong_sell verdict (see companySignals.js for what
 * counts as "new" — a signal that stays strong doesn't renotify on every
 * scan). Uses the same live-only-never-demo rule as the price-alert
 * scheduler: a code whose fetch fails is just skipped this round.
 *
 * Note: this walks the whole tracked directory (TASI + US, potentially a
 * few hundred companies) sequentially, one live fetch per company, every
 * SIGNAL_SCAN_INTERVAL_MS — real upstream API load. Tune the interval (or
 * restrict which companies get scanned) if that becomes a rate-limiting
 * concern in production.
 */
export async function scanForSignalsOnce() {
  const companies = listCompanies();
  let scanned = 0;
  let newSignals = 0;

  for (const company of companies) {
    const market = detectMarket(company.code);
    if (!isMarketOpen(market)) continue;

    let history;
    try {
      history = await fetchHistory(company.code, { range: "6mo", interval: "1d" });
    } catch (err) {
      console.warn(`[signals] skipping ${company.code} this round — live fetch failed: ${err.message}`);
      continue;
    }

    if (!history.series.length) continue;
    scanned += 1;

    const analysis = analyzeSeries(history.series);
    if (analysis.insufficientData) continue;

    const isNewSignal = recordCompanySignal(company.code, analysis.verdict, analysis.score);
    if (!isNewSignal) continue;
    if (analysis.verdict !== "strong_buy" && analysis.verdict !== "strong_sell") continue;

    newSignals += 1;
    await notifySubscribers({
      code: company.code,
      nameEn: company.nameEn,
      nameAr: company.nameAr,
      verdict: analysis.verdict,
      score: analysis.score,
      price: history.regularMarketPrice,
    });
  }

  return { scanned, newSignals };
}

export function startSignalScanner(intervalMs) {
  const run = () => {
    scanForSignalsOnce()
      .then(({ scanned, newSignals }) => {
        if (scanned > 0) {
          console.log(`[signals] scanned ${scanned} compan${scanned === 1 ? "y" : "ies"}, ${newSignals} new signal(s)`);
        }
      })
      .catch((err) => console.error("[signals] scan cycle failed:", err));
  };
  run();
  return setInterval(run, intervalMs);
}
