import { fetchHistory } from "./priceProvider.js";
import { getCompany } from "./companies.js";
import { sendAlertEmail } from "./mailer.js";
import { isMarketOpen } from "./marketHours.js";
import { detectMarket } from "./markets.js";
import {
  listActiveAlertCodes,
  listActiveAlertsForCode,
  markAlertTriggered,
  touchAlertChecked,
  markEmailResult,
} from "./alerts.js";

/**
 * Checks every code with at least one active alert against its LIVE price
 * only — never the demo fallback used by /api/quote, since triggering a
 * real email off synthetic placeholder data would be actively misleading.
 * A code whose live fetch fails is just skipped for this round; its alerts
 * stay active and get picked up on a later successful check.
 *
 * TASI and US alerts keep different trading hours, so the "market closed"
 * skip is evaluated per code rather than gating the whole run — e.g. TASI
 * alerts can be checked while NASDAQ is still closed for the day, and vice versa.
 */
export async function checkAlertsOnce() {
  const codes = listActiveAlertCodes();
  if (codes.length === 0) return { checkedCodes: 0, triggered: 0 };

  let triggered = 0;
  let checkedCodes = 0;

  for (const code of codes) {
    if (!isMarketOpen(detectMarket(code))) continue;
    checkedCodes += 1;

    let history;
    try {
      // Daily data is enough to know the latest close; we don't need the
      // full 6mo analysis window here, just a real, current price.
      history = await fetchHistory(code, { range: "5d", interval: "1d" });
    } catch (err) {
      console.warn(`[alerts] skipping ${code} this round — live fetch failed: ${err.message}`);
      continue;
    }

    const price = history.regularMarketPrice;
    if (!Number.isFinite(price)) continue;

    const alerts = listActiveAlertsForCode(code);
    const company = getCompany(code);

    for (const alert of alerts) {
      const hit =
        (alert.direction === "buy" && price <= alert.targetPrice) ||
        (alert.direction === "sell" && price >= alert.targetPrice);

      if (!hit) {
        touchAlertChecked(alert.id);
        continue;
      }

      markAlertTriggered(alert.id, price);
      triggered += 1;

      // Awaited (not fire-and-forget) so the real send outcome — proof this
      // isn't a front-end-only feature — is always recorded on the alert.
      try {
        const result = await sendAlertEmail(alert, company, price);
        markEmailResult(alert.id, result.sent, result.sent ? null : result.reason);
      } catch (err) {
        console.error(`[alerts] unexpected email error for alert ${alert.id}:`, err);
        markEmailResult(alert.id, false, err.message);
      }
    }
  }

  return { checkedCodes, triggered };
}

export function startAlertScheduler(intervalMs) {
  const run = () => {
    checkAlertsOnce()
      .then(({ checkedCodes, triggered }) => {
        if (checkedCodes > 0) {
          console.log(`[alerts] checked ${checkedCodes} code(s), triggered ${triggered} alert(s)`);
        }
      })
      .catch((err) => console.error("[alerts] check cycle failed:", err));
  };
  run();
  return setInterval(run, intervalMs);
}
