// Deterministic synthetic OHLCV generator, used ONLY as a fallback when the
// live Yahoo Finance feed cannot be reached (e.g. restrictive network policy).
// It must never be mistaken for real data — every response using it is tagged
// dataSource:"demo" so the UI can render an unmissable banner.

function hashSeed(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateDemoHistory(code, { days = 126 } = {}) {
  const seed = hashSeed(String(code));
  const rand = mulberry32(seed);
  const basePrice = 8 + (seed % 180); // plausible SAR range
  let price = basePrice;
  let trendBias = (rand() - 0.5) * 0.15; // slow drift, differs per company

  const series = [];
  const now = new Date();
  let d = new Date(now);
  d.setDate(d.getDate() - Math.floor(days * 1.45)); // walk back further to skip weekends

  let count = 0;
  while (count < days) {
    const day = d.getDay();
    if (day !== 5 && day !== 6) {
      // occasionally nudge the drift so the walk isn't a straight line
      if (count % 15 === 0) trendBias += (rand() - 0.5) * 0.1;

      const volatility = 0.012 + rand() * 0.01;
      const change = trendBias * 0.01 + (rand() - 0.5) * volatility;
      const open = price;
      price = Math.max(1, price * (1 + change));
      const high = Math.max(open, price) * (1 + rand() * 0.006);
      const low = Math.min(open, price) * (1 - rand() * 0.006);
      const baseVolume = 400000 + (seed % 900000);
      const volumeSpike = rand() > 0.85 ? 1.8 + rand() : 1;
      const volume = Math.round(baseVolume * (0.6 + rand() * 0.8) * volumeSpike);

      series.push({
        date: d.toISOString().slice(0, 10),
        time: Math.floor(d.getTime() / 1000),
        open: Number(open.toFixed(2)),
        high: Number(high.toFixed(2)),
        low: Number(low.toFixed(2)),
        close: Number(price.toFixed(2)),
        volume,
      });
      count += 1;
    }
    d.setDate(d.getDate() + 1);
  }

  const last = series.at(-1);
  const prev = series.at(-2);

  return {
    symbol: `${code}.SR`,
    code: String(code).trim().toUpperCase(),
    currency: "SAR",
    exchangeName: "Saudi Exchange (Demo)",
    regularMarketPrice: last.close,
    previousClose: prev.close,
    regularMarketTime: Date.now(),
    series,
  };
}
