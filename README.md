# MyShare — TASI Search, Charts, Money-Flow Analysis & Price Alerts

A bilingual (Arabic-default/English) web app for the Saudi Exchange (Tadawul /
TASI): search companies by code or name as you type, view the latest price
and a one-month candlestick chart, get a technical + money-flow buy/sell/hold
analysis with price targets, and set email alerts for a buy/sell price you
want to hit.

## Project layout

- `client/` — React + TypeScript + Tailwind frontend (Vite), charts via
  `lightweight-charts`.
- `server/` — Express API that proxies Yahoo Finance for Tadawul tickers
  (`CODE.SR`), runs the technical/money-flow analysis engine, and owns a
  SQLite database (`server/lib/db.js`, Node's built-in `node:sqlite`) for the
  dynamic company directory and price alerts.

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

The same score also scales a **price-targets** block: a fair-value estimate
(blended SMA20/SMA50, shown as context) plus buy/sell targets anchored on the
*current* price, whose distance grows with how strong the signal is — a
Strong Buy gets a proportionally larger upside/sell target above the current
price, a Strong Sell a proportionally larger discount buy/re-entry target
below it, so the targets can't contradict the verdict next to them (an
earlier version derived targets from fair value alone, which could put a
"Strong Buy" stock's sell target barely above its current price since price
runs above its own moving averages in a strong uptrend).

**This is not investment advice.** It's a rules-based technical read on
historical price/volume data, shown as such in the app itself.

## Data source, the dynamic company directory & known limitations

- Prices come from Yahoo Finance's public chart endpoint using the `.SR`
  suffix Yahoo uses for Tadawul tickers (e.g. `2222.SR` for Saudi Aramco).
- The directory starts from a curated seed (`server/data/companies.json`,
  ~86 well-known TASI names, compiled from general knowledge rather than a
  scraped live source — treat it as "likely correct, verify before trading")
  loaded into the `companies` table on first run. **It grows on its own**:
  every time `/api/quote/:code` gets a real (non-demo) response from Yahoo,
  that company is added or refreshed in the database — new row if the code
  wasn't known yet (named from Yahoo's own `longName`/`shortName`, which has
  no Arabic translation, so `nameAr` is `null` until someone corrects it),
  updated `last_price`/`last_checked_at` either way. A code is **only** ever
  written to the directory from a confirmed-live lookup, never from the demo
  fallback below — otherwise a typo'd or fake code could get "confirmed" into
  search results via synthetic data. Searching by a raw 3-5 digit code always
  works for fetching a quote even before it's in the directory.
- If the backend can't reach Yahoo Finance (e.g. blocked network, rate
  limiting), it automatically falls back to clearly-labeled **demo data**
  (a synthetic price series) so the UI stays usable for preview — every
  screen shows a prominent "Demo data — not live prices" banner in that
  case, and the API response carries `dataSource: "demo"`.

## Price alerts & email

Anyone can create an alert (Alerts tab) for a company + a buy or sell target
price + an email address — no account needed, just that email. A background
job (`server/lib/alertScheduler.js`, every `ALERT_CHECK_INTERVAL_MS` ms,
default 5 minutes) fetches the **live** price for every code with an active
alert and emails + marks it `triggered` once the condition is met (price at
or below target for a buy alert, at or above for a sell alert). A code whose
live fetch fails that round is skipped, not evaluated against demo data —
same reasoning as the directory: an alert email should never fire off a
synthetic price.

Emailing needs SMTP credentials via environment variables — without them the
app still works fully (alerts are created, checked, and marked triggered),
it just logs instead of sending:

| Variable | Required | Notes |
| --- | --- | --- |
| `SMTP_HOST` | for email | e.g. `smtp.sendgrid.net`, `smtp.mailgun.org`, `smtp.gmail.com` |
| `SMTP_PORT` | optional | default `587` |
| `SMTP_SECURE` | optional | `"true"` for implicit TLS (port 465) |
| `SMTP_USER` / `SMTP_PASS` | for email | provider credentials (Gmail needs an App Password, not your login password) |
| `MAIL_FROM` | optional | defaults to `SMTP_USER` |
| `APP_URL` | optional | included as a link back to the app in alert emails, e.g. `https://myshare-production.up.railway.app` |
| `ALERT_CHECK_INTERVAL_MS` | optional | default `300000` (5 min) |

Basic abuse protection only (this is not a multi-tenant SaaS with verified
accounts): alert creation is rate-limited per IP, and capped at 20 active
alerts per email. There's no email verification step, so treat it as
appropriate for personal/trusted use rather than a public sign-up product
without adding one.

## Persistence (important for Railway)

The SQLite file (`server/data/myshare.db` by default, override with
`DB_PATH`) lives on the container's local disk. **Railway's filesystem is
ephemeral across redeploys** unless you attach a
[Volume](https://docs.railway.com/reference/volumes) — without one, the
directory's dynamic growth and every alert reset to just the seed data on
the next deploy. To persist: add a Volume to the service, mount it at e.g.
`/data`, and set `DB_PATH=/data/myshare.db`.

## Deploying (Railway, or any single-service Node host)

The app deploys as **one service**: the Express server also serves the built
frontend (`client/dist`) as static files, so there's no separate frontend
service or root-directory juggling needed.

- Root `package.json` defines `build` (installs + builds `client/`, installs
  `server/`) and `start` (`node server/index.js`), and `railway.json` points
  Railway's Nixpacks builder at those explicitly.
- In the Railway dashboard, the service's **Root Directory should be the
  repo root** (not `client/` or `server/`) — if it was previously set to
  `client/`, that's what causes Railway to fall back to its built-in static
  file server (the `fileserver.(*FileServer).notFound` 404s), since it never
  sees a backend to run. Clear/reset it to the repo root and redeploy.
- Railway sets `PORT` automatically; `server/index.js` already reads
  `process.env.PORT`.
- Everything runs with zero configuration beyond that — Yahoo Finance needs
  no API key. For alert emails and for the directory/alerts to survive a
  redeploy, see "Price alerts & email" and "Persistence" above.

## Icon

`client/public/icon.svg` — green gradient (Saudi-market association) with
candlesticks forming an uptrend and an arrow, source-of-truth for the
favicon, `apple-touch-icon.png`, and PWA manifest icons (regenerate the PNGs
with any SVG rasterizer if you edit the source SVG).
