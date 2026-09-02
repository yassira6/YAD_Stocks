// "Long-Term Trading" — a separate section from the short/medium-term
// composite score in analysis.js, aimed at position-trading entries/exits:
// SMA(50/100/200) trend + golden/death cross, RSI(14) and MACD (same math
// as the composite score, imported so both stay consistent), and
// algorithmic support/resistance from clustered swing highs/lows. Short
// interest (% of float, short ratio) is fetched separately — see
// lib/shortInterest.js — and merged in by the caller, not computed here.
import { sma, rsi, macd } from "./analysis.js";

const MIN_BARS = 60; // below this, even a 50-day MA + swing detection isn't meaningful
const SWING_WINDOW = 5; // bars on each side a pivot must beat to count as a swing high/low
const SWING_LOOKBACK = 300; // ~14 months of daily bars — long enough for "long-term" levels, not so long they're ancient
const CLUSTER_TOLERANCE_PCT = 0.015; // swing points within 1.5% of each other count as the same level
const MAX_LEVEL_DISTANCE_PCT = 0.4; // ignore levels more than 40% away from current price — not actionable
const LEVELS_PER_SIDE = 3;

function findSwingPoints(bars) {
  const highs = [];
  const lows = [];
  for (let i = SWING_WINDOW; i < bars.length - SWING_WINDOW; i++) {
    const windowBars = bars.slice(i - SWING_WINDOW, i + SWING_WINDOW + 1);
    if (windowBars.every((b) => bars[i].high >= b.high)) highs.push({ price: bars[i].high, index: i });
    if (windowBars.every((b) => bars[i].low <= b.low)) lows.push({ price: bars[i].low, index: i });
  }
  return { highs, lows };
}

/** Groups nearby swing points into levels, scored by touch count + recency. */
function clusterLevels(points, totalBars) {
  const sorted = [...points].sort((a, b) => a.price - b.price);
  const clusters = [];
  for (const p of sorted) {
    const last = clusters[clusters.length - 1];
    if (last && Math.abs(p.price - last.avgPrice) / last.avgPrice <= CLUSTER_TOLERANCE_PCT) {
      last.points.push(p);
      last.avgPrice = last.points.reduce((s, x) => s + x.price, 0) / last.points.length;
    } else {
      clusters.push({ avgPrice: p.price, points: [p] });
    }
  }
  return clusters.map((c) => ({
    price: c.avgPrice,
    touches: c.points.length,
    // Recency-weighted: a level touched recently counts more than a stale one, on top of raw touch count.
    strength: c.points.length + c.points.reduce((s, p) => s + p.index / totalBars, 0),
  }));
}

function pickLevels(clusters, price, direction) {
  const candidates = clusters.filter((c) => {
    const inDirection = direction === "support" ? c.price < price : c.price > price;
    const distancePct = Math.abs(c.price - price) / price;
    return inDirection && distancePct <= MAX_LEVEL_DISTANCE_PCT;
  });
  return candidates
    .sort((a, b) => b.strength - a.strength)
    .slice(0, LEVELS_PER_SIDE)
    .sort((a, b) => (direction === "support" ? b.price - a.price : a.price - b.price)) // nearest to price first
    .map((c) => ({ price: c.price, touches: c.touches, distancePct: (c.price - price) / price }));
}

export function analyzeLongTerm(bars) {
  const clean = bars.filter(
    (b) => b.open != null && b.high != null && b.low != null && b.close != null && b.volume != null
  );
  if (clean.length < MIN_BARS) return null;

  const closes = clean.map((b) => b.close);
  const last = clean.length - 1;
  const price = closes[last];

  const sma50Series = sma(closes, Math.min(50, clean.length - 1));
  const sma100Series = clean.length >= 100 ? sma(closes, 100) : null;
  const sma200Series = clean.length >= 200 ? sma(closes, 200) : null;
  const sma50 = sma50Series[last];
  const sma100 = sma100Series ? sma100Series[last] : null;
  const sma200 = sma200Series ? sma200Series[last] : null;

  const rsi14 = rsi(closes, 14)[last];
  const { macdLine, signalLine, histogram } = macd(closes);

  // Golden/death cross: did SMA50 change which side of SMA200 it's on within the last ~10 sessions?
  let goldenCross = false;
  let deathCross = false;
  if (sma50Series && sma200Series) {
    const crossWindow = Math.min(10, last);
    const prevIdx = last - crossWindow;
    if (sma50Series[prevIdx] != null && sma200Series[prevIdx] != null) {
      const wasAbove = sma50Series[prevIdx] > sma200Series[prevIdx];
      const isAbove = sma50 > sma200;
      goldenCross = !wasAbove && isAbove;
      deathCross = wasAbove && !isAbove;
    }
  }

  let trend = "neutral";
  if (sma100 != null) {
    if (price > sma50 && sma50 > sma100) trend = "uptrend";
    else if (price < sma50 && sma50 < sma100) trend = "downtrend";
  } else {
    if (price > sma50) trend = "uptrend";
    else if (price < sma50) trend = "downtrend";
  }

  const lookbackBars = clean.slice(-Math.min(SWING_LOOKBACK, clean.length));
  const { highs, lows } = findSwingPoints(lookbackBars);
  const resistanceClusters = clusterLevels(highs, lookbackBars.length);
  const supportClusters = clusterLevels(lows, lookbackBars.length);
  const support = pickLevels(supportClusters, price, "support");
  const resistance = pickLevels(resistanceClusters, price, "resistance");

  const nearestSupport = support[0] || null;
  const nearestResistance = resistance[0] || null;

  return {
    price,
    sma50,
    sma100,
    sma200,
    trend,
    goldenCross,
    deathCross,
    rsi14,
    macd: { macdLine: macdLine[last], signalLine: signalLine[last], histogram: histogram[last] },
    support,
    resistance,
    entry: nearestSupport
      ? {
          price: nearestSupport.price,
          note: {
            en: `Nearest support at ${nearestSupport.price.toFixed(2)} (${Math.abs(nearestSupport.distancePct * 100).toFixed(1)}% below, touched ${nearestSupport.touches}x) — a pullback into this zone, with trend/momentum still intact, is the kind of level long-term entries are often scaled into.`,
            ar: `أقرب دعم عند ${nearestSupport.price.toFixed(2)} (أدنى بنسبة ${Math.abs(nearestSupport.distancePct * 100).toFixed(1)}%، تم اختباره ${nearestSupport.touches} مرة) — تراجع نحو هذه المنطقة، مع بقاء الاتجاه والزخم سليمين، هو نوع المستوى الذي غالباً ما يُستخدم للدخول التدريجي على المدى الطويل.`,
          },
        }
      : null,
    exit: nearestResistance
      ? {
          price: nearestResistance.price,
          note: {
            en: `Nearest resistance at ${nearestResistance.price.toFixed(2)} (${(nearestResistance.distancePct * 100).toFixed(1)}% above, touched ${nearestResistance.touches}x) — a common zone to trim/take profit or tighten a stop.`,
            ar: `أقرب مقاومة عند ${nearestResistance.price.toFixed(2)} (أعلى بنسبة ${(nearestResistance.distancePct * 100).toFixed(1)}%، تم اختباره ${nearestResistance.touches} مرة) — منطقة شائعة لجني بعض الأرباح أو تشديد وقف الخسارة.`,
          },
        }
      : null,
    note: {
      en: "Support/resistance are algorithmically detected from clustered swing highs/lows over roughly the last 14 months, not analyst-drawn levels. Golden/death cross and SMA alignment describe the long-term trend only — none of this accounts for fundamentals, news, or upcoming events.",
      ar: "مستويات الدعم/المقاومة مكتشفة آلياً من تجمّع القمم والقيعان خلال نحو آخر ١٤ شهراً، وليست مستويات مرسومة من محلل. التقاطع الذهبي/الميت ومحاذاة المتوسطات تصف الاتجاه طويل المدى فقط — لا شيء من هذا يأخذ الأساسيات أو الأخبار أو الأحداث القادمة بعين الاعتبار.",
    },
  };
}
