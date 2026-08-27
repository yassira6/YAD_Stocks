# YAD Stocks — TASI Search, Charts & Money-Flow Analysis

A bilingual (Arabic/English) web app for the Saudi Exchange (Tadawul / TASI):
search companies by code or name as you type, view the latest price and a
one-month candlestick chart, and get a technical + money-flow buy/sell/hold
analysis.

## Project layout

- `client/` — React + TypeScript + Tailwind frontend (Vite), charts via
  `lightweight-charts`.
- `server/` — Express API that proxies Yahoo Finance for Tadawul tickers
  (`CODE.SR`) and runs the technical/money-flow analysis engine.

## Running locally

```bash
# 1) backend
cd server
npm install
npm run dev        # http://localhost:5174

# 2) frontend (separate terminal)
cd client
npm install
npm run dev         # http://localhost:5173, proxies /api to the backend
```

Open http://localhost:5173. Search for a company (e.g. "Aramco", "أرامكو",
"الراجحي", or a raw code like `1120`) to see its price, last-month chart and
recommendation.

## How the recommendation works

`server/lib/analysis.js` computes, over ~6 months of daily data (fetched for
statistical soundness even though the chart itself only *displays* the last
month, per the requested view):

- **Trend**: price vs SMA20/SMA50 alignment
- **Momentum**: RSI(14), MACD(12,26,9)
- **Volatility**: Bollinger Bands(20, 2)
- **Money flow / "smart money" footprint**:
  - On-Balance Volume (OBV) trend, including bullish/bearish divergence vs price
  - Chaikin Money Flow (20d) — buying vs selling pressure
  - Money Flow Index (14d) — volume-weighted RSI
  - High-volume "accumulation vs distribution day" footprint over the last
    10 sessions (large volume spikes on up days vs down days)

Each signal is weighted and combined into a single **-100…+100 composite
score**, mapped to Strong Sell → Sell → Hold → Buy → Strong Buy. Every
contributing signal is returned with a bilingual, human-readable explanation
so the "Why this call" section is fully transparent, not a black box.

**This is not investment advice.** It's a rules-based technical read on
historical price/volume data, shown as such in the app itself.

## Data source & known limitations

- Prices come from Yahoo Finance's public chart endpoint using the `.SR`
  suffix Yahoo uses for Tadawul tickers (e.g. `2222.SR` for Saudi Aramco).
- The searchable company directory (`client/src/data/companies.json`) was
  compiled from general knowledge of TASI's main market, not scraped from a
  live source — this development sandbox's network is locked to an
  allowlist that does not include Tadawul/Yahoo/Wikipedia, so it could not be
  cross-checked against a live listing during development. Treat codes as
  "likely correct, verify before trading" and feel free to correct/extend
  the JSON file. **Searching by a raw 4-digit code always works** even for
  companies missing from the directory — it's looked up directly.
- If the backend can't reach Yahoo Finance (e.g. blocked network, rate
  limiting), it automatically falls back to clearly-labeled **demo data**
  (a synthetic price series) so the UI stays usable for preview — every
  screen shows a prominent "Demo data — not live prices" banner in that
  case, and the API response carries `dataSource: "demo"`.

## Icon

`client/public/icon.svg` — green gradient (Saudi-market association) with
candlesticks forming an uptrend and an arrow, source-of-truth for the
favicon, `apple-touch-icon.png`, and PWA manifest icons (regenerate the PNGs
with any SVG rasterizer if you edit the source SVG).
