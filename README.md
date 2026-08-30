# MyShare — TASI Search, Charts, Money-Flow Analysis & Price Alerts

A bilingual (Arabic-default/English) web app for the Saudi Exchange (Tadawul /
TASI): search companies by code or name as you type, view the latest price
and a one-month candlestick chart, get a technical + money-flow buy/sell/hold
analysis with price targets, and — once signed in with Google or Apple — set
email alerts for a buy/sell price you want to hit. The account that signs in
with the configured admin email gets an Admin page listing every user and
every alert in the system.

## Project layout

- `client/` — React + TypeScript + Tailwind frontend (Vite), charts via
  `lightweight-charts`.
- `server/` — Express API that proxies Yahoo Finance for Tadawul tickers
  (`CODE.SR`), runs the technical/money-flow analysis engine, owns a SQLite
  database (`server/lib/db.js`, Node's built-in `node:sqlite`) for the
  dynamic company directory/alerts/users, and handles Google/Apple sign-in
  (`server/lib/authRoutes.js`, OpenID Connect via `openid-client`).

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

- Prices come from Yahoo Finance's public chart endpoint. **TASI** (Tadawul)
  codes use the `.SR` suffix Yahoo expects (e.g. `2222.SR` for Saudi Aramco);
  **US** tickers (NASDAQ/NYSE — see "US stocks" below) are passed through
  as-is (e.g. `AAPL`). `server/lib/markets.js` is what decides which is
  which: a 3-5 digit number is TASI, 1-5 letters (optionally with a
  share-class suffix like `BRK.B`) is US.
- The directory starts from two curated seeds — `server/data/companies.json`
  (~86 well-known TASI names) and `server/data/companies_us.json` (~100
  well-known NASDAQ/S&P 500 names) — both compiled from general knowledge
  rather than a scraped live source, so treat them as "likely correct,
  verify before trading" and **not** the complete current index membership.
  They're loaded into the `companies` table (tagged `market: "TASI" | "US"`)
  on first run. **The directory grows on its own** either way: every time
  `/api/quote/:code` gets a real (non-demo) response from Yahoo, that company
  is added or refreshed in the database — new row if the code wasn't known
  yet (named from Yahoo's own `longName`/`shortName`, which has no Arabic
  translation, so `nameAr` is `null` until someone corrects it), updated
  `last_price`/`last_checked_at` either way. A code is **only** ever written
  to the directory from a confirmed-live lookup, never from the demo fallback
  below — otherwise a typo'd or fake code could get "confirmed" into search
  results via synthetic data. Searching by a raw code/ticker always works for
  fetching a quote even before it's in the directory — the seed lists just
  make it show up by *name* search before anyone has looked it up.
- If the backend can't reach Yahoo Finance (e.g. blocked network, rate
  limiting), it automatically falls back to clearly-labeled **demo data**
  (a synthetic price series, in the right currency for the detected market)
  so the UI stays usable for preview — every screen shows a prominent "Demo
  data — not live prices" banner in that case, and the API response carries
  `dataSource: "demo"`.

## US stocks (NASDAQ / S&P 500)

Search and analysis work the same way for US-listed tickers as for TASI —
same chart, same technical + money-flow scoring, same buy/sell price
targets, same alerts, just in USD instead of SAR (`quote.currency` /
`quote.market` drive this throughout the UI and in alert emails, so nothing
is hardcoded to SAR). A few things worth knowing:

- The seed list (`server/data/companies_us.json`) is a curated ~100-name
  starter set spanning major sectors (mega-cap tech, financials, health
  care, energy, etc.) — **not** the literal current S&P 500 or NASDAQ
  membership list, which changes over time and isn't something I could
  verify live from this environment. Any valid ticker not in the list still
  works via direct lookup (type it exactly, e.g. `PLTR`); it gets added to
  the directory automatically the first time it's looked up live.
- Market hours use the NYSE/NASDAQ regular session — Monday-Friday,
  9:30-16:00 `America/New_York` (DST-aware via `Intl`) — completely
  independent from TASI's Sunday-Thursday Riyadh-time session. See "Market
  hours" below; `US_MARKET_HOLIDAYS` is the US equivalent of
  `MARKET_HOLIDAYS`.
- Alerts and the alert-checking scheduler work identically for US tickers;
  the scheduler now evaluates each alert's own market hours independently,
  so TASI alerts can be checked while NASDAQ is closed and vice versa.

## Sign-in (Google & Apple) and the admin account

The Alerts and Admin pages require signing in — no passwords, only "Continue
with Google" / "Continue with Apple" (server-side OAuth 2.0 / OIDC code flow
+ PKCE via `openid-client`; session is an opaque random token in an httpOnly
cookie, looked up against the `sessions` table, not a JWT). **Whichever
provider isn't configured just shows a "not configured" message on the login
button** — the app runs fine with zero, one, or both set up.

The account that signs in with the email in `ADMIN_EMAIL` (default
`yassira6@gmail.com`, case-insensitive, checked on every login regardless of
which provider they used) gets `is_admin` and the Admin nav tab —
`/api/admin/*` rejects everyone else with 403.

| Variable | Required | Notes |
| --- | --- | --- |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | for Google sign-in | From a Google Cloud Console OAuth 2.0 Client ID (Web application). Authorized redirect URI: `{APP_URL}/auth/google/callback`. |
| `APPLE_CLIENT_ID` | for Apple sign-in | Your Apple **Services ID** (not the App ID), e.g. `com.yourteam.myshare.web`. |
| `APPLE_TEAM_ID` | for Apple sign-in | Your Apple Developer Team ID. |
| `APPLE_KEY_ID` | for Apple sign-in | The Key ID of a "Sign in with Apple" key you create in the Apple Developer portal. |
| `APPLE_PRIVATE_KEY` | for Apple sign-in | The full contents of the `.p8` private key downloaded when creating that key (`\n`-escaped is fine if set via a single-line env var UI). Used to sign a fresh ES256 client-secret JWT on every login — Apple doesn't accept a static client secret. |
| `SESSION_SECRET` | recommended | Signs the short-lived (10 min) OAuth "state" token used during the login redirect round-trip. Without it a random one is generated per process, so a login started right before a restart/redeploy just needs a retry — not a real problem, but set it to avoid even that. |
| `ADMIN_EMAIL` | optional | Defaults to `yassira6@gmail.com`. |

Apple's requirements are the real setup cost here, independent of this
code: a **paid Apple Developer Program membership**, a registered Services
ID with "Sign in with Apple" enabled and your domain + the callback URL
verified, and a generated signing key. Google is free and takes a few
minutes in Cloud Console. **I could not test either flow end-to-end** — this
sandbox has no network access to `accounts.google.com` / `appleid.apple.com`
and no real credentials — so start with Google, confirm it end-to-end, and
treat Apple as the harder follow-up.

## Price alerts & email

Signed-in users create an alert (Alerts tab) for a company + a buy or sell
target price; the email is always their account's own email, never a
free-text field. A background job (`server/lib/alertScheduler.js`, every
`ALERT_CHECK_INTERVAL_MS` ms, default 5 minutes) fetches the **live** price
for every code with an active alert and emails + marks it `triggered` once
the condition is met (price at or below target for a buy alert, at or above
for a sell alert). A code whose live fetch fails that round is skipped, not
evaluated against demo data — same reasoning as the directory: an alert
email should never fire off a synthetic price.

**Emails are sent from the backend, not the frontend** — nodemailer over
real SMTP, awaited (not fire-and-forget) inside the scheduler, with the
actual outcome (`email_sent` / `email_error`) written back onto the alert
row so it's visible in the UI, not just assumed: the triggered alert on the
user's own Alerts page shows "Sent"/"Failed", and the Admin page shows it
for every alert in the system, which is exactly the proof that this is a
real backend delivery path and not a front-end-only feature. Without SMTP
credentials the app still works fully end-to-end (create/check/trigger),
it just logs instead of sending and marks `email_sent: false`:

| Variable | Required | Notes |
| --- | --- | --- |
| `SMTP_HOST` | for email | e.g. `smtp.sendgrid.net`, `smtp.mailgun.org`, `smtp.gmail.com` |
| `SMTP_PORT` | optional | default `587` |
| `SMTP_SECURE` | optional | `"true"` for implicit TLS (port 465) |
| `SMTP_USER` / `SMTP_PASS` | for email | provider credentials (Gmail needs an App Password, not your login password) |
| `MAIL_FROM` | optional | defaults to `SMTP_USER` |
| `APP_URL` | optional | included as a link back to the app in alert emails, e.g. `https://myshare-production.up.railway.app`; also used to build the OAuth callback URL if set (otherwise inferred from the request) |
| `ALERT_CHECK_INTERVAL_MS` | optional | default `300000` (5 min) |

Basic abuse protection only (this is not a hardened multi-tenant SaaS):
alert creation is rate-limited per IP, and capped at 20 active alerts per
account.

### Testing SMTP delivery

The quickest way to confirm SMTP is actually working, once you've set
`SMTP_HOST`/`SMTP_USER`/`SMTP_PASS` (etc.) in Railway: sign in as the admin,
open the **Admin** page, find your own row in the Users table, click **Send
email**, and send yourself a test message (see "Admin: emailing a user
directly" below) — a real message through the same `sendMail()` path alert
emails use. `smtpConfigured` on the Admin status card also just reflects
whether those env vars are set, not whether a send has actually succeeded.

### Admin: emailing a user directly

From the Admin page, each row in the Users table has a **Send email**
button that opens a free-text subject + message composer and sends a real
email to that user's account address via the same SMTP configuration as
alert emails (`server/lib/mailer.js`'s `sendMail()`). Every attempt —
success or failure, with the error if it failed — is written to an
`admin_emails` audit table (`server/lib/adminEmails.js`) so there's a record
of what was sent to whom. Without SMTP configured, the send fails with
`smtp_not_configured` and that failure is still logged, same as alert
emails.

## Strong buy/sell signal subscriptions (email + push)

A separate opt-in from the per-stock price alerts above: from the **Signals**
nav tab, a signed-in user can subscribe to be notified — by email and/or
browser push — the moment **any** company in the tracked directory (TASI or
US) newly turns Strong Buy or Strong Sell, without having to watch it
themselves. "Real-time" here means periodic scanning, not a literal live
feed — see the mechanics below.

- **How a signal fires**: `server/lib/signalScanner.js` runs every
  `SIGNAL_SCAN_INTERVAL_MS` (default 30 min), walks every company in the
  directory whose market is currently open, fetches its live price/history
  (same live-only rule as price alerts — never the demo fallback), and runs
  it through the same `analyzeSeries()` used for the stock detail page.
  `server/lib/companySignals.js` tracks each company's last verdict so a
  signal only notifies once when it *newly* becomes strong — not on every
  scan while it stays strong, but a fresh notification if it later drops out
  and comes back, or flips directly from Strong Buy to Strong Sell.
- **Email** goes through the same `sendMail()`/SMTP setup as alert and admin
  emails — nothing extra to configure beyond what "Price alerts & email"
  above already covers.
- **Push** uses the [Web Push](https://web.dev/push-notifications-overview/)
  standard (`web-push` npm package, VAPID auth, `client/public/sw.js` as the
  service worker) — it works even when the MyShare tab isn't open, as long
  as the browser/OS notification permission is granted. Requires a VAPID key
  pair:

  | Variable | Required | Notes |
  | --- | --- | --- |
  | `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | for push | An ECDSA key pair identifying this server to push services (FCM, Mozilla's push service, etc.) — not a login credential for anything, just proves notifications came from you. Generate a fresh pair with `node -e "console.log(require('web-push').generateVAPIDKeys())"` from `server/`, or use `npx web-push generate-vapid-keys`. Treat the private key like any other secret (Railway Variables, never committed). |
  | `VAPID_SUBJECT` | optional | A `mailto:` or `https:` URL identifying the sender, e.g. `mailto:yassira6@gmail.com`. Defaults to a placeholder if unset — push services may rate-limit or reject sends from an unidentified sender, so set this in production. |
  | `SIGNAL_SCAN_INTERVAL_MS` | optional | Default `1800000` (30 min). This walks the **entire** company directory (TASI + US — a few hundred names) with one live fetch each, every interval — meaningfully more upstream load than the price-alert scheduler's per-alert checks. Widen this (or the app will need a scoped-scan option added later) if it becomes a rate-limiting concern. |

  Without `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` set, the Push toggle on the
  Signals page is shown disabled with an explanation, and email notifications
  keep working normally — push is additive, not required.
- **Admin visibility**: the Admin page's status card shows email/push
  subscriber counts and whether push is configured, and a new **Active
  strong signals** table lists every company currently flagged, with a
  **Scan now** button to trigger a scan on demand (useful right after
  setting up SMTP/VAPID, instead of waiting for the next interval).

## Price source configuration

Prices are fetched through a small provider registry
(`server/lib/priceProvider.js`) rather than every caller importing Yahoo
Finance directly, so a different source can be added later without
touching `server/index.js`, the alert scheduler, or the backtester.

| Variable | Required | Notes |
| --- | --- | --- |
| `PRICE_SOURCE` | optional | Defaults to `yahoo`, currently the only implemented provider. An unrecognized value logs a warning at startup and falls back to `yahoo` rather than failing to boot. |

Adding a real second provider means implementing a module with the same
`fetchHistory(code, options)` shape as `server/lib/yahooProxy.js`,
registering it in the `PROVIDERS` map in `priceProvider.js`, and providing
whatever credentials that source needs — tell me which provider and I can
wire it in. The current Admin page shows which source is active
(`priceSource` on `/api/admin/status`).

## Market hours (TASI & US) & the "Market Closed" state

`server/lib/marketHours.js` tracks two independent sessions (using
`Intl.DateTimeFormat` with an explicit `timeZone` — no external date
library, no network call, and each is DST-aware for its own timezone):

- **TASI** (Saudi Exchange): Sunday–Thursday, roughly 10:00–15:00
  `Asia/Riyadh`.
- **US** (NYSE/NASDAQ): Monday–Friday, 9:30–16:00 `America/New_York`.

Which session applies is decided per-code (a numeric code → TASI, a ticker
→ US — see "US stocks" above). Outside a code's own session:

- Its quote response carries `marketOpen: false` and a `marketCloseReason`
  (`weekend` / `after_hours` / `holiday`), and the price header shows a
  **"Market Closed"** badge instead of the live/demo badge, so a closing
  price is never presented as if it were live.
- The frontend stops polling every 60 seconds and switches to a slow
  15-minute check (just enough to notice the market reopening) — see
  `REFRESH_INTERVAL_MS` / `CLOSED_REFRESH_INTERVAL_MS` in `client/src/App.tsx`.
- The backend's quote cache TTL extends from 60 seconds to 30 minutes while
  that code's market is closed.
- The alert-checking scheduler (`alertScheduler.js`) evaluates each active
  alert's code against its own market's hours and skips only that code for
  the round — a closed TASI session doesn't pause checks on open US alerts,
  and vice versa.

The Admin page's status card shows both sessions separately ("Market
(TASI)" / "Market (US)").

Saudi/Islamic and US holidays are **not** hardcoded (Hijri-calendar dates
shift yearly, and I couldn't verify either calendar live from this
environment) — set them manually instead:

| Variable | Required | Notes |
| --- | --- | --- |
| `MARKET_HOLIDAYS` | optional | TASI holidays. Comma-separated `YYYY-MM-DD` dates (Riyadh calendar day) treated as closed even during normal trading hours/weekdays, e.g. `2026-03-20,2026-03-21,2026-03-22`. |
| `US_MARKET_HOLIDAYS` | optional | NYSE/NASDAQ holidays. Same format, `America/New_York` calendar day, e.g. `2026-01-01,2026-12-25`. |

## Chart: viewing more history

The chart now fetches and loads up to **2 years** of daily bars (previously
6 months), but still opens on the last ~30 days by default for a readable
initial view (`client/src/components/PriceChart.tsx`, via
`chart.timeScale().setVisibleRange(...)` rather than filtering the dataset).
Scrolling or zooming out on the chart reveals the rest of the already-loaded
history instead of an empty canvas.

## Persistence (important for Railway)

The SQLite file (`server/data/myshare.db` by default, override with
`DB_PATH`) lives on the container's local disk. **Railway's filesystem is
ephemeral across redeploys** unless you attach a
[Volume](https://docs.railway.com/reference/volumes) — without one, the
company directory's growth, every alert, and **every signed-in user account
and session** all reset on the next deploy (everyone would need to sign in
again). To persist: add a Volume to the service, mount it at e.g. `/data`,
and set `DB_PATH=/data/myshare.db`. If `DB_PATH` isn't set, the server now
prints a loud warning banner in the deploy logs on startup as a reminder —
this is a Railway dashboard configuration step, not something the code can
force on its own.

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

## Backtesting the price-targets algorithm

`server/scripts/backtest.js` walk-forward tests `analyzeSeries()`: for every
trading day in a company's history (after a warmup window), it re-runs the
exact analysis the live app would have shown "as of" that day, then checks
up to `--horizon` trading days forward to see whether price actually reached
that day's `targetSell`/`targetBuy`, and how long it took. Results are
pooled by verdict bucket (strong_buy/buy/hold/sell/strong_sell) with a
hit-rate and average/median days-to-hit for each target.

```bash
node server/scripts/backtest.js                       # default: 8 well-known codes, 1y, 40-day horizon
node server/scripts/backtest.js --horizon=20 2222 1120 1180
```

**Read the caveat the script itself prints before trusting the numbers**:
this was built and run in a sandboxed environment with no network access to
Yahoo Finance, so it fell back to the same synthetic random-walk generator
the live app uses when Yahoo is unreachable. That's fine for what it's
actually good for here — proving the mechanism works end-to-end over a full
year of data without crashing, and that targets/verdicts stay internally
consistent (buy-side verdicts skew toward higher sell-target hit rates than
sell-side ones, counts are roughly balanced between buy and sell days, which
is what you'd want from a non-biased scorer) — but a random walk has no real
support/resistance or crowd behavior, so hit-rates measured against it are
**not evidence of real predictive edge on TASI prices**. The script already
prefers live data automatically whenever `fetchHistory()` succeeds, so
running it from a machine with normal internet access (or from a Railway
shell) against real tickers is what would actually validate or refine the
algorithm against a real year of TASI history — that's the run this
environment couldn't do.

## Theme (light/dark)

The toggle in the header (sun/moon icon) switches between light and dark;
the choice is remembered per-browser (`localStorage`), and a first-time
visitor gets whatever their OS is set to (`prefers-color-scheme`) with no
flash of the wrong theme (a small inline script in `client/index.html` sets
the `data-theme` attribute before first paint). Every color in
`client/src/index.css`'s `@theme` block is a semantic role (page background,
card background, border, muted text, primary text, ...), not a fixed
swatch — `:root[data-theme="light"]` redefines the same CSS variables to
light-appropriate values, so the whole app re-themes without touching
component markup. The one exception is the price chart
(`client/src/components/PriceChart.tsx`): `lightweight-charts` draws to a
`<canvas>`, which can't resolve a CSS variable, so it keeps a small
hand-written light/dark palette in sync with the same tokens.

## Version footer

The footer shows `vX.Y.Z · build N · <commit>`. `N` is the total git commit
count on the branch (`git rev-list --count HEAD`), so it increments by
exactly 1 on every commit/deploy automatically — nothing to remember to bump
by hand. `scripts/generate-version.js` writes this to `server/version.json`
as part of `npm run build` (root `package.json`), and `GET /api/version`
serves it to the footer. Running the server without that build step (e.g.
`npm run dev` inside `server/`) falls back to computing the same thing from
git directly at startup, so local dev still shows a real build number.

## Icon

`client/public/icon.svg` — green gradient (Saudi-market association) with
candlesticks forming an uptrend and an arrow, source-of-truth for the
favicon, `apple-touch-icon.png`, and PWA manifest icons (regenerate the PNGs
with any SVG rasterizer if you edit the source SVG).
