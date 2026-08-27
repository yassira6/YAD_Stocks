// Technical + money-flow analysis engine.
// Combines classic trend/momentum indicators with volume-based "smart money" flow
// indicators (OBV, Chaikin Money Flow, Money Flow Index, volume-spike footprint)
// into one weighted composite recommendation. Every contributing signal is returned
// with a bilingual (en/ar) explanation so the UI can show its reasoning, not just a verdict.

function sma(values, period) {
  const out = new Array(values.length).fill(null);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

function ema(values, period) {
  const out = new Array(values.length).fill(null);
  const k = 2 / (period + 1);
  let prev = null;
  for (let i = 0; i < values.length; i++) {
    if (values[i] == null) continue;
    if (prev === null) {
      // seed with SMA of first `period` points once available
      if (i >= period - 1) {
        const seed = values.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period;
        prev = seed;
        out[i] = prev;
      }
    } else {
      prev = values[i] * k + prev * (1 - k);
      out[i] = prev;
    }
  }
  return out;
}

function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);
    if (i <= period) {
      avgGain += gain;
      avgLoss += loss;
      if (i === period) {
        avgGain /= period;
        avgLoss /= period;
        out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
      }
    } else {
      avgGain = (avgGain * (period - 1) + gain) / period;
      avgLoss = (avgLoss * (period - 1) + loss) / period;
      out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
    }
  }
  return out;
}

function macd(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = ema(closes, fast);
  const emaSlow = ema(closes, slow);
  const macdLine = closes.map((_, i) =>
    emaFast[i] != null && emaSlow[i] != null ? emaFast[i] - emaSlow[i] : null
  );
  const signalLine = ema(
    macdLine.map((v) => (v == null ? null : v)),
    signalPeriod
  );
  const histogram = closes.map((_, i) =>
    macdLine[i] != null && signalLine[i] != null ? macdLine[i] - signalLine[i] : null
  );
  return { macdLine, signalLine, histogram };
}

function bollinger(closes, period = 20, mult = 2) {
  const mid = sma(closes, period);
  const upper = new Array(closes.length).fill(null);
  const lower = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const window = closes.slice(i - period + 1, i + 1);
    const mean = mid[i];
    const variance = window.reduce((acc, v) => acc + (v - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    upper[i] = mean + mult * sd;
    lower[i] = mean - mult * sd;
  }
  return { mid, upper, lower };
}

function obv(closes, volumes) {
  const out = new Array(closes.length).fill(0);
  for (let i = 1; i < closes.length; i++) {
    if (closes[i] > closes[i - 1]) out[i] = out[i - 1] + volumes[i];
    else if (closes[i] < closes[i - 1]) out[i] = out[i - 1] - volumes[i];
    else out[i] = out[i - 1];
  }
  return out;
}

function moneyFlowClv(high, low, close) {
  if (high === low) return 0;
  return (close - low - (high - close)) / (high - low);
}

function chaikinMoneyFlow(bars, period = 20) {
  const out = new Array(bars.length).fill(null);
  for (let i = period - 1; i < bars.length; i++) {
    let mfVolSum = 0;
    let volSum = 0;
    for (let j = i - period + 1; j <= i; j++) {
      const b = bars[j];
      mfVolSum += moneyFlowClv(b.high, b.low, b.close) * b.volume;
      volSum += b.volume;
    }
    out[i] = volSum === 0 ? 0 : mfVolSum / volSum;
  }
  return out;
}

function moneyFlowIndex(bars, period = 14) {
  const typicalPrices = bars.map((b) => (b.high + b.low + b.close) / 3);
  const rawFlow = typicalPrices.map((tp, i) => tp * bars[i].volume);
  const out = new Array(bars.length).fill(null);
  for (let i = period; i < bars.length; i++) {
    let posFlow = 0;
    let negFlow = 0;
    for (let j = i - period + 1; j <= i; j++) {
      if (typicalPrices[j] > typicalPrices[j - 1]) posFlow += rawFlow[j];
      else if (typicalPrices[j] < typicalPrices[j - 1]) negFlow += rawFlow[j];
    }
    if (negFlow === 0) out[i] = 100;
    else {
      const ratio = posFlow / negFlow;
      out[i] = 100 - 100 / (1 + ratio);
    }
  }
  return out;
}

function accumulationDistributionLine(bars) {
  const out = new Array(bars.length).fill(0);
  let running = 0;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    running += moneyFlowClv(b.high, b.low, b.close) * b.volume;
    out[i] = running;
  }
  return out;
}

function linregSlope(values) {
  const n = values.length;
  if (n < 2) return 0;
  const xs = values.map((_, i) => i);
  const xMean = xs.reduce((a, b) => a + b, 0) / n;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let den = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i] - xMean) * (values[i] - yMean);
    den += (xs[i] - xMean) ** 2;
  }
  if (den === 0) return 0;
  const slope = num / den;
  // normalize by average magnitude so slope is comparable across symbols/scales
  const scale = Math.max(Math.abs(yMean), 1e-9);
  return slope / scale;
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function verdictFromScore(score) {
  if (score >= 55) return "strong_buy";
  if (score >= 18) return "buy";
  if (score <= -55) return "strong_sell";
  if (score <= -18) return "sell";
  return "hold";
}

const VERDICT_LABELS = {
  strong_buy: { en: "Strong Buy", ar: "شراء قوي" },
  buy: { en: "Buy", ar: "شراء" },
  hold: { en: "Hold", ar: "احتفاظ" },
  sell: { en: "Sell", ar: "بيع" },
  strong_sell: { en: "Strong Sell", ar: "بيع قوي" },
};

const fmt = (n, d = 2) => (n == null || Number.isNaN(n) ? "—" : Number(n).toFixed(d));

/**
 * Runs full analysis on an ascending-by-date OHLCV series and returns a
 * composite recommendation with a transparent, weighted reasoning breakdown.
 */
export function analyzeSeries(series) {
  const bars = series.filter(
    (b) => b.open != null && b.high != null && b.low != null && b.close != null && b.volume != null
  );

  const MIN_BARS = 30;
  if (bars.length < MIN_BARS) {
    return {
      insufficientData: true,
      barsAvailable: bars.length,
    };
  }

  const closes = bars.map((b) => b.close);
  const volumes = bars.map((b) => b.volume);

  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, Math.min(50, bars.length - 1));
  const rsi14 = rsi(closes, 14);
  const { macdLine, signalLine, histogram } = macd(closes);
  const bb = bollinger(closes, 20, 2);
  const obvSeries = obv(closes, volumes);
  const cmf20 = chaikinMoneyFlow(bars, 20);
  const mfi14 = moneyFlowIndex(bars, 14);
  const adLine = accumulationDistributionLine(bars);

  const last = bars.length - 1;
  const price = closes[last];
  const reasons = [];
  let score = 0;

  // ---- Trend: price vs moving averages + moving-average alignment (weight 20) ----
  {
    const s20 = sma20[last];
    const s50 = sma50[last];
    let signal = 0;
    if (s20 != null && s50 != null) {
      if (price > s20 && s20 > s50) signal = 1;
      else if (price > s20 && s20 <= s50) signal = 0.4;
      else if (price < s20 && s20 < s50) signal = -1;
      else signal = -0.4;
      reasons.push({
        signal,
        weight: 20,
        en: `Price ${fmt(price)} is ${price > s20 ? "above" : "below"} its 20-day average (${fmt(
          s20
        )}), and the 20-day average is ${s20 > s50 ? "above" : "below"} the 50-day average (${fmt(
          s50
        )}) — a ${signal > 0 ? "bullish" : "bearish"} trend alignment.`,
        ar: `السعر ${fmt(price)} ${price > s20 ? "أعلى" : "أدنى"} من متوسطه لـ20 يوم (${fmt(
          s20
        )})، والمتوسط 20 يوم ${s20 > s50 ? "أعلى" : "أدنى"} من متوسط 50 يوم (${fmt(
          s50
        )}) — ما يعكس اتجاهاً ${signal > 0 ? "صاعداً" : "هابطاً"}.`,
      });
    }
    score += signal * 20;
  }

  // ---- Momentum: RSI (weight 15) ----
  {
    const r = rsi14[last];
    let signal = 0;
    let note = { en: "", ar: "" };
    if (r != null) {
      if (r >= 70) {
        signal = -0.7;
        note = {
          en: `RSI(14) is ${fmt(r, 1)} — overbought territory, raising the odds of a pullback.`,
          ar: `مؤشر القوة النسبية RSI(14) عند ${fmt(r, 1)} — منطقة تشبع شرائي، ما يرفع احتمال التصحيح.`,
        };
      } else if (r <= 30) {
        signal = 0.7;
        note = {
          en: `RSI(14) is ${fmt(r, 1)} — oversold territory, often a setup for a bounce.`,
          ar: `مؤشر القوة النسبية RSI(14) عند ${fmt(r, 1)} — منطقة تشبع بيعي، وغالباً ما يسبق ارتداداً.`,
        };
      } else {
        signal = (r - 50) / 50; // gentle continuous tilt
        note = {
          en: `RSI(14) is ${fmt(r, 1)} — neutral momentum, ${r >= 50 ? "leaning bullish" : "leaning bearish"}.`,
          ar: `مؤشر القوة النسبية RSI(14) عند ${fmt(r, 1)} — زخم محايد يميل إلى ${
            r >= 50 ? "الإيجابية" : "السلبية"
          }.`,
        };
      }
      reasons.push({ signal, weight: 15, ...note });
    }
    score += signal * 15;
  }

  // ---- MACD (weight 15) ----
  {
    const m = macdLine[last];
    const s = signalLine[last];
    const h = histogram[last];
    const hPrev = histogram[last - 1];
    let signal = 0;
    if (m != null && s != null) {
      const crossUp = hPrev != null && hPrev <= 0 && h > 0;
      const crossDown = hPrev != null && hPrev >= 0 && h < 0;
      if (crossUp) signal = 1;
      else if (crossDown) signal = -1;
      else signal = clamp(h / Math.max(Math.abs(m), 0.01) , -1, 1);
      reasons.push({
        signal,
        weight: 15,
        en: `MACD line is ${m > s ? "above" : "below"} its signal line${
          crossUp ? " with a fresh bullish crossover" : crossDown ? " with a fresh bearish crossover" : ""
        } (histogram ${fmt(h, 3)}).`,
        ar: `خط MACD ${m > s ? "أعلى" : "أدنى"} من خط الإشارة${
          crossUp ? " مع تقاطع صعودي جديد" : crossDown ? " مع تقاطع هبوطي جديد" : ""
        } (الهيستوجرام ${fmt(h, 3)}).`,
      });
    }
    score += signal * 15;
  }

  // ---- Bollinger Bands position (weight 10) ----
  {
    const upper = bb.upper[last];
    const lower = bb.lower[last];
    const mid = bb.mid[last];
    let signal = 0;
    if (upper != null && lower != null) {
      const width = upper - lower || 1;
      const posPct = (price - lower) / width; // 0 = lower band, 1 = upper band
      if (posPct >= 1) signal = -0.8;
      else if (posPct <= 0) signal = 0.8;
      else signal = (posPct - 0.5) * -0.6; // mild fade toward the band price is closer to
      reasons.push({
        signal,
        weight: 10,
        en: `Price sits at ${fmt(posPct * 100, 0)}% of the Bollinger Band range (band ${fmt(
          lower
        )}–${fmt(upper)}, mid ${fmt(mid)}).`,
        ar: `يقع السعر عند ${fmt(posPct * 100, 0)}% من نطاق بولينجر (النطاق ${fmt(lower)}–${fmt(
          upper
        )}، الوسط ${fmt(mid)}).`,
      });
    }
    score += signal * 10;
  }

  // ---- OBV trend: is smart money accumulating or distributing? (weight 15) ----
  {
    const window = Math.min(20, obvSeries.length - 1);
    const recentObv = obvSeries.slice(last - window, last + 1);
    const slope = linregSlope(recentObv);
    const priceSlope = linregSlope(closes.slice(last - window, last + 1));
    let signal = clamp(slope * 25, -1, 1);
    let divergenceNote = { en: "", ar: "" };
    if (slope > 0 && priceSlope <= 0) {
      signal = Math.max(signal, 0.6);
      divergenceNote = {
        en: " Volume is flowing in while price lags — a bullish divergence often seen before accumulation shows up in price.",
        ar: " التدفقات النقدية تتجه للداخل رغم تراجع السعر — تباعد إيجابي غالباً ما يسبق ظهور التجميع في السعر.",
      };
    } else if (slope < 0 && priceSlope >= 0) {
      signal = Math.min(signal, -0.6);
      divergenceNote = {
        en: " Volume is flowing out while price still rises — a bearish divergence that can signal distribution into strength.",
        ar: " التدفقات النقدية تخرج رغم ارتفاع السعر — تباعد سلبي قد يشير إلى توزيع خلال القوة السعرية.",
      };
    }
    reasons.push({
      signal,
      weight: 15,
      en: `On-Balance Volume is trending ${slope > 0 ? "up" : slope < 0 ? "down" : "flat"} over the last ${window} sessions, suggesting ${
        slope > 0 ? "net buying" : slope < 0 ? "net selling" : "balanced"
      } volume pressure.${divergenceNote.en}`,
      ar: `مؤشر التوازن الحجمي OBV يتجه ${
        slope > 0 ? "صعوداً" : slope < 0 ? "هبوطاً" : "بثبات"
      } خلال آخر ${window} جلسة، ما يشير إلى ضغط ${
        slope > 0 ? "شرائي صافٍ" : slope < 0 ? "بيعي صافٍ" : "متوازن"
      } على حجم التداول.${divergenceNote.ar}`,
    });
    score += signal * 15;
  }

  // ---- Chaikin Money Flow: buying vs selling pressure from big players (weight 15) ----
  {
    const c = cmf20[last];
    let signal = 0;
    if (c != null) {
      signal = clamp(c * 4, -1, 1); // CMF typically ranges -0.3..0.3 in practice
      reasons.push({
        signal,
        weight: 15,
        en: `Chaikin Money Flow (20d) is ${fmt(c, 3)} — ${
          c > 0.05
            ? "sustained buying pressure, consistent with institutional accumulation"
            : c < -0.05
            ? "sustained selling pressure, consistent with institutional distribution"
            : "roughly balanced buying/selling pressure"
        }.`,
        ar: `مؤشر تدفق الأموال (Chaikin) لـ20 يوم عند ${fmt(c, 3)} — ${
          c > 0.05
            ? "ضغط شرائي مستمر يتماشى مع تجميع مؤسسي"
            : c < -0.05
            ? "ضغط بيعي مستمر يتماشى مع توزيع مؤسسي"
            : "توازن نسبي بين الشراء والبيع"
        }.`,
      });
    }
    score += signal * 15;
  }

  // ---- Money Flow Index: volume-weighted RSI (weight 10) ----
  {
    const mfi = mfi14[last];
    let signal = 0;
    if (mfi != null) {
      if (mfi >= 80) signal = -0.7;
      else if (mfi <= 20) signal = 0.7;
      else signal = (mfi - 50) / 50;
      reasons.push({
        signal,
        weight: 10,
        en: `Money Flow Index is ${fmt(mfi, 1)} — ${
          mfi >= 80 ? "overbought on a volume-weighted basis" : mfi <= 20 ? "oversold on a volume-weighted basis" : "neutral money-flow reading"
        }.`,
        ar: `مؤشر تدفق الأموال MFI عند ${fmt(mfi, 1)} — ${
          mfi >= 80 ? "تشبع شرائي على أساس مرجّح بالحجم" : mfi <= 20 ? "تشبع بيعي على أساس مرجّح بالحجم" : "قراءة محايدة لتدفق الأموال"
        }.`,
      });
    }
    score += signal * 10;
  }

  // ---- Big-player footprint: high-volume "accumulation/distribution days" (informational, weight 0 in score, folded into moneyFlow section) ----
  const avgVol20 = sma(volumes, 20)[last];
  let spikeAccum = 0;
  let spikeDist = 0;
  const spikeWindow = bars.slice(Math.max(0, last - 9), last + 1);
  for (const b of spikeWindow) {
    if (avgVol20 && b.volume > 1.5 * avgVol20) {
      if (b.close >= b.open) spikeAccum += 1;
      else spikeDist += 1;
    }
  }

  const roundedScore = Math.round(clamp(score, -100, 100));
  const verdict = verdictFromScore(roundedScore);

  // ---- Price targets: fair value + buy/sell zones from trend & volatility ----
  // Not a fundamental valuation (no earnings/cash-flow model) — a statistical
  // read: "fair value" is the blended short/medium trend (SMA20 & SMA50), and
  // the buy/sell targets sit one Bollinger standard deviation below/above it,
  // i.e. the same volatility band already used for the Bollinger signal above.
  let priceTargets = null;
  {
    const s20 = sma20[last];
    const s50 = sma50[last];
    const upper = bb.upper[last];
    const mid = bb.mid[last];
    const sd20 = upper != null && mid != null ? upper - mid : null;
    if (s20 != null && s50 != null && sd20 != null) {
      const fairValue = (s20 + s50) / 2;
      const targetBuy = fairValue - sd20;
      const targetSell = fairValue + sd20;
      const pct = (target) => (target - price) / price;
      priceTargets = {
        fairValue,
        targetBuy,
        targetSell,
        fairValuePct: pct(fairValue),
        targetBuyPct: pct(targetBuy),
        targetSellPct: pct(targetSell),
      };
    }
  }

  return {
    insufficientData: false,
    score: roundedScore,
    verdict,
    verdictLabel: VERDICT_LABELS[verdict],
    price,
    priceTargets,
    reasons: reasons.sort((a, b) => Math.abs(b.signal * b.weight) - Math.abs(a.signal * a.weight)),
    latest: {
      sma20: sma20[last],
      sma50: sma50[last],
      rsi14: rsi14[last],
      macd: macdLine[last],
      macdSignal: signalLine[last],
      macdHistogram: histogram[last],
      bollingerUpper: bb.upper[last],
      bollingerLower: bb.lower[last],
      bollingerMid: bb.mid[last],
      obv: obvSeries[last],
      cmf20: cmf20[last],
      mfi14: mfi14[last],
      adLine: adLine[last],
    },
    moneyFlow: {
      cmf20: cmf20[last],
      mfi14: mfi14[last],
      obvTrendUp: linregSlope(obvSeries.slice(Math.max(0, last - 20), last + 1)) > 0,
      accumulationDays: spikeAccum,
      distributionDays: spikeDist,
      avgVolume20: avgVol20,
      lastVolume: volumes[last],
      note:
        spikeAccum > spikeDist
          ? {
              en: `${spikeAccum} high-volume accumulation day(s) vs ${spikeDist} distribution day(s) in the last 10 sessions — footprints consistent with larger players building positions.`,
              ar: `${spikeAccum} يوم/أيام تجميع بحجم مرتفع مقابل ${spikeDist} يوم/أيام توزيع خلال آخر 10 جلسات — ما يتوافق مع بناء مراكز من قبل كبار المتداولين.`,
            }
          : spikeDist > spikeAccum
          ? {
              en: `${spikeDist} high-volume distribution day(s) vs ${spikeAccum} accumulation day(s) in the last 10 sessions — footprints consistent with larger players reducing positions.`,
              ar: `${spikeDist} يوم/أيام توزيع بحجم مرتفع مقابل ${spikeAccum} يوم/أيام تجميع خلال آخر 10 جلسات — ما يتوافق مع تخفيف مراكز من قبل كبار المتداولين.`,
            }
          : {
              en: `No clear high-volume accumulation/distribution imbalance in the last 10 sessions.`,
              ar: `لا يوجد اختلال واضح بين أيام التجميع والتوزيع ذات الحجم المرتفع خلال آخر 10 جلسات.`,
            },
    },
  };
}
