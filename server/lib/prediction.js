// "7 Days Future Movement" — a transparent, separate feature from the
// composite recommendation in analysis.js, not a replacement for it. Where
// analyzeSeries() scores WHERE the stock stands right now against several
// weighted indicators, this projects WHERE the price trend points over the
// next 7 trading days using a single, inspectable method: linear regression
// on recent closes for the direction, extrapolated forward, with a
// volatility band (from recent daily returns, scaled by sqrt(time) the
// standard way a random walk's uncertainty grows) around that projection.
//
// This is NOT a machine-learning model and carries no claim of predictive
// accuracy — it is a straight-line extrapolation of recent momentum, which
// by construction will miss news, earnings, market-wide moves, and any
// genuine trend reversal. It is offered as one more transparent, mechanical
// read alongside the composite score, with the same "not investment advice"
// framing.

const HORIZON_DAYS = 7;
const LOOKBACK_DAYS = 20; // trend-fit window
const RETURN_WINDOW_DAYS = 30; // volatility-estimate window
const MIN_BARS = 20; // below this, a 20-day trend fit isn't meaningful

function linearRegression(values) {
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  const intercept = yMean - slope * xMean;
  return { slope, intercept };
}

function stdev(values) {
  const n = values.length;
  if (n < 2) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / (n - 1);
  return Math.sqrt(variance);
}

const CALL_LABELS = {
  buy: { en: "Buy", ar: "شراء" },
  sell: { en: "Sell", ar: "بيع" },
  keep: { en: "Keep", ar: "احتفاظ" },
};

/**
 * bars: ascending-by-date OHLCV array (same shape analyzeSeries takes).
 * Returns null if there isn't enough history for a meaningful trend fit.
 */
export function predictSevenDayMovement(bars) {
  if (bars.length < MIN_BARS) return null;

  const closes = bars.map((b) => b.close);
  const currentPrice = closes[closes.length - 1];

  const trendWindow = closes.slice(-Math.min(LOOKBACK_DAYS, closes.length));
  const { slope, intercept } = linearRegression(trendWindow);
  const n = trendWindow.length;
  const projectedPrice = intercept + slope * (n - 1 + HORIZON_DAYS);

  const returnWindow = closes.slice(-Math.min(RETURN_WINDOW_DAYS, closes.length));
  const dailyReturns = [];
  for (let i = 1; i < returnWindow.length; i++) {
    if (returnWindow[i - 1]) dailyReturns.push((returnWindow[i] - returnWindow[i - 1]) / returnWindow[i - 1]);
  }
  const dailyVolatilityPct = stdev(dailyReturns);
  // Random-walk-style scaling: uncertainty over N days grows with sqrt(N), not N.
  const horizonVolatilityPct = dailyVolatilityPct * Math.sqrt(HORIZON_DAYS);

  const buyPrice = projectedPrice * (1 - horizonVolatilityPct);
  const sellPrice = projectedPrice * (1 + horizonVolatilityPct);
  const projectedChangePct = currentPrice ? (projectedPrice - currentPrice) / currentPrice : 0;

  // A move has to clear the estimated noise band to count as a real call —
  // otherwise a nearly-flat, choppy stock would flip buy/sell on rounding.
  const threshold = Math.max(0.015, horizonVolatilityPct * 0.5);
  let call;
  if (projectedChangePct >= threshold) call = "buy";
  else if (projectedChangePct <= -threshold) call = "sell";
  else call = "keep";

  return {
    horizonDays: HORIZON_DAYS,
    call,
    callLabel: CALL_LABELS[call],
    currentPrice,
    projectedPrice,
    projectedChangePct,
    buyPrice,
    sellPrice,
    dailyVolatilityPct,
    note: {
      en: `Straight-line extrapolation of the last ${n} closes' trend, with a range from recent daily volatility. This is a mechanical trend projection, not a prediction model — it cannot foresee news, earnings, or a genuine trend reversal.`,
      ar: `امتداد خطي لاتجاه آخر ${n} إغلاقاً، مع نطاق مبني على التقلب اليومي الأخير. هذا امتداد آلي للاتجاه وليس نموذج تنبؤ — لا يمكنه توقع الأخبار أو الأرباح أو انعكاس اتجاه حقيقي.`,
    },
  };
}
