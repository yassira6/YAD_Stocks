// Saudi Exchange (Tadawul) main continuous trading session: Sunday-Thursday,
// 10:00-15:00 Asia/Riyadh (no DST). This is a deterministic weekday/hours
// check only — I could not verify the exact current session times or the
// official 2026 Tadawul holiday calendar against a live source from this
// environment (see README), so treat the exact cutoff times as "likely
// correct, worth double-checking against saudiexchange.sa" rather than
// guaranteed, and use MARKET_HOLIDAYS below for anything this misses
// (Eid, National Day, etc. — the Hijri-calendar ones move every year, so
// they can't be hardcoded reliably without a live calendar source either).
const OPEN_HOUR = 10;
const CLOSE_HOUR = 15;
const TRADING_WEEKDAYS = new Set([0, 1, 2, 3, 4]); // Sun=0 .. Thu=4 in this formatter's numbering

// MARKET_HOLIDAYS="2026-03-20,2026-09-23" (Riyadh-local calendar dates, comma-separated)
function getHolidaySet() {
  return new Set(
    (process.env.MARKET_HOLIDAYS || "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
}

function riyadhParts(date) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Riyadh",
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

/** Is the TASI main session open right now (or at the given date)? */
export function isMarketOpen(date = new Date()) {
  const { weekday, isoDate, hour, minute } = riyadhParts(date);
  if (!TRADING_WEEKDAYS.has(weekday)) return false;
  if (getHolidaySet().has(isoDate)) return false;
  const minutesNow = hour * 60 + minute;
  return minutesNow >= OPEN_HOUR * 60 && minutesNow < CLOSE_HOUR * 60;
}

export function getMarketStatus(date = new Date()) {
  const { weekday, isoDate } = riyadhParts(date);
  const open = isMarketOpen(date);
  let reason = null;
  if (!open) {
    if (getHolidaySet().has(isoDate)) reason = "holiday";
    else if (!TRADING_WEEKDAYS.has(weekday)) reason = "weekend";
    else reason = "after_hours";
  }
  return { open, reason, checkedAt: date.toISOString() };
}
