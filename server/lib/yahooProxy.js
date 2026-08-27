const CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const CHART_BASE_FALLBACK = "https://query2.finance.yahoo.com/v8/finance/chart";

// Saudi Exchange (Tadawul) tickers on Yahoo Finance use the ".SR" suffix, e.g. 2222.SR for Aramco.
export function toYahooSymbol(code) {
  const trimmed = String(code).trim().toUpperCase();
  return trimmed.endsWith(".SR") ? trimmed : `${trimmed}.SR`;
}

async function fetchChartFrom(base, symbol, range, interval) {
  const url = `${base}/${encodeURIComponent(symbol)}?range=${range}&interval=${interval}&includePrePost=false`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`Upstream responded with ${res.status}`);
  }

  const json = await res.json();
  const result = json?.chart?.result?.[0];
  const error = json?.chart?.error;

  if (error || !result) {
    throw new Error(error?.description || "No data returned for this symbol");
  }

  return result;
}

/**
 * Fetches OHLCV history for a Tadawul company code.
 * range/interval follow Yahoo Finance chart API conventions.
 */
export async function fetchHistory(code, { range = "6mo", interval = "1d" } = {}) {
  const symbol = toYahooSymbol(code);
  let result;
  try {
    result = await fetchChartFrom(CHART_BASE, symbol, range, interval);
  } catch (primaryErr) {
    result = await fetchChartFrom(CHART_BASE_FALLBACK, symbol, range, interval);
  }

  const timestamps = result.timestamp || [];
  const quote = result.indicators?.quote?.[0] || {};
  const meta = result.meta || {};

  const series = timestamps
    .map((t, i) => ({
      date: new Date(t * 1000).toISOString().slice(0, 10),
      time: t,
      open: quote.open?.[i] ?? null,
      high: quote.high?.[i] ?? null,
      low: quote.low?.[i] ?? null,
      close: quote.close?.[i] ?? null,
      volume: quote.volume?.[i] ?? null,
    }))
    .filter((bar) => bar.open !== null && bar.close !== null && bar.volume !== null);

  return {
    symbol,
    code: String(code).trim().toUpperCase(),
    currency: meta.currency || "SAR",
    exchangeName: meta.exchangeName || "Saudi Exchange",
    regularMarketPrice: meta.regularMarketPrice ?? series.at(-1)?.close ?? null,
    previousClose: meta.chartPreviousClose ?? meta.previousClose ?? series.at(-2)?.close ?? null,
    regularMarketTime: meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now(),
    series,
  };
}
