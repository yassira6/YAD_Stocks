// Trading-hours detection for every market this app supports. Deterministic
// weekday/hours checks only — I could not verify exact session times or the
// official current-year holiday calendars for either exchange against a live
// source from this environment, so treat the cutoffs as "likely correct,
// worth double-checking against saudiexchange.sa / nasdaq.com" rather than
// guaranteed, and use the *_MARKET_HOLIDAYS env vars below for anything this
// misses (moving religious/national holidays can't be hardcoded reliably
// without a live calendar source either).
const MARKETS = {
  // Saudi Exchange (Tadawul) main continuous session: Sunday-Thursday, 10:00-15:00 Asia/Riyadh (no DST).
  TASI: {
    openMinutes: 10 * 60,
    closeMinutes: 15 * 60,
    weekdays: new Set([0, 1, 2, 3, 4]), // Sun=0 .. Thu=4 in this formatter's numbering
    timeZone: "Asia/Riyadh",
    holidaysEnv: "MARKET_HOLIDAYS",
  },
  // NYSE/NASDAQ regular session: Monday-Friday, 9:30-16:00 America/New_York (handles DST automatically).
  US: {
    openMinutes: 9 * 60 + 30,
    closeMinutes: 16 * 60,
    weekdays: new Set([1, 2, 3, 4, 5]),
    timeZone: "America/New_York",
    holidaysEnv: "US_MARKET_HOLIDAYS",
  },
};

// e.g. MARKET_HOLIDAYS="2026-03-20,2026-09-23" (local calendar dates for that market, comma-separated)
function getHolidaySet(envVar) {
  return new Set(
    (process.env[envVar] || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function localParts(date, timeZone) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = Object.fromEntries(fmt.formatToParts(date).map((p) => [p.type, p.value]));
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    weekday: weekdayMap[parts.weekday],
    isoDate: `${parts.year}-${parts.month}-${parts.day}`,
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

function marketConfig(market) {
  return MARKETS[market] || MARKETS.TASI;
}

/** Is the given market's regular session open right now (or at the given date)? */
export function isMarketOpen(market = "TASI", date = new Date()) {
  const cfg = marketConfig(market);
  const { weekday, isoDate, hour, minute } = localParts(date, cfg.timeZone);
  if (!cfg.weekdays.has(weekday)) return false;
  if (getHolidaySet(cfg.holidaysEnv).has(isoDate)) return false;
  const minutesNow = hour * 60 + minute;
  return minutesNow >= cfg.openMinutes && minutesNow < cfg.closeMinutes;
}

export function getMarketStatus(market = "TASI", date = new Date()) {
  const cfg = marketConfig(market);
  const { weekday, isoDate } = localParts(date, cfg.timeZone);
  const open = isMarketOpen(market, date);
  let reason = null;
  if (!open) {
    if (getHolidaySet(cfg.holidaysEnv).has(isoDate)) reason = "holiday";
    else if (!cfg.weekdays.has(weekday)) reason = "weekend";
    else reason = "after_hours";
  }
  return { open, reason, checkedAt: date.toISOString() };
}
