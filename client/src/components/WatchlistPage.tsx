import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../lib/AuthContext";
import { useWatchlist } from "../lib/WatchlistContext";
import { LoginPage } from "./LoginPage";
import { SearchBar } from "./SearchBar";
import { Toggle } from "./Toggle";
import { navigateTo } from "../lib/hashRoute";
import { fetchQuote } from "../lib/api";
import { formatDateTime, formatPercent, formatPrice } from "../lib/format";
import type { QuoteResponse } from "../types";

type QuoteState = { status: "loading" } | { status: "error" } | { status: "ok"; quote: QuoteResponse };

function PriceCell({ state }: { state: QuoteState | undefined }) {
  const { t, lang } = useLanguage();

  if (!state || state.status === "loading") {
    return <span className="h-4 w-16 animate-pulse rounded bg-ink-700" />;
  }
  if (state.status === "error") {
    return <span className="text-xs text-ink-300">{t.errorTitle}</span>;
  }

  const { quote } = state;
  const change = quote.regularMarketPrice - quote.previousClose;
  const changePct = quote.previousClose ? change / quote.previousClose : 0;
  const isUp = change >= 0;

  return (
    <div className="text-end">
      <p className="text-sm font-bold tabular-nums text-ink-100">{formatPrice(quote.regularMarketPrice, lang, quote.currency)}</p>
      <p className={`text-xs font-semibold tabular-nums ${isUp ? "text-bull" : "text-bear"}`}>{formatPercent(changePct, lang)}</p>
      {!quote.marketOpen && <p className="text-[10px] text-ink-300/80">{t.marketClosedBadge}</p>}
    </div>
  );
}

export function WatchlistPage() {
  const { t, lang } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { items, loading, remove, setAlerts } = useWatchlist();
  const [quotes, setQuotes] = useState<Record<string, QuoteState>>({});
  const fetchedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    for (const item of items) {
      if (fetchedRef.current.has(item.code)) continue;
      fetchedRef.current.add(item.code);
      setQuotes((prev) => ({ ...prev, [item.code]: { status: "loading" } }));
      fetchQuote(item.code)
        .then((quote) => setQuotes((prev) => ({ ...prev, [item.code]: { status: "ok", quote } })))
        .catch(() => setQuotes((prev) => ({ ...prev, [item.code]: { status: "error" } })));
    }
    // Drop quotes for items removed from the watchlist so a re-add fetches fresh.
    const currentCodes = new Set(items.map((i) => i.code));
    for (const code of fetchedRef.current) {
      if (!currentCodes.has(code)) fetchedRef.current.delete(code);
    }
  }, [items]);

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-sm space-y-4 text-center">
        <p className="text-sm text-ink-300">{t.watchlistLoginRequired}</p>
        <LoginPage />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-100 sm:text-2xl">{t.watchlistTitle}</h2>
        <p className="mt-1 text-sm text-ink-300">{t.watchlistSubtitle}</p>
      </div>

      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
        <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-300">
          {t.watchlistAddLabel}
        </label>
        <SearchBar onSelect={() => {}} />
      </div>

      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
        <h3 className="text-base font-semibold text-ink-100">{t.watchlistMyTitle}</h3>

        {loading ? (
          <p className="mt-4 text-sm text-ink-300">{t.loading}</p>
        ) : items.length === 0 ? (
          <p className="mt-4 text-sm text-ink-300">{t.watchlistEmpty}</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-800">
            {items.map((item) => {
              const name = lang === "ar" ? item.nameAr || item.nameEn || item.code : item.nameEn || item.code;
              return (
                <li key={item.code} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                  <button
                    type="button"
                    onClick={() => navigateTo("stock", { code: item.code })}
                    className="min-w-0 text-start"
                  >
                    <p className="truncate text-sm font-medium text-ink-100 hover:text-brand-300">
                      {name} <span className="font-mono text-xs text-brand-300">({item.code})</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-300/80">
                      {t.watchlistAddedAt} {formatDateTime(item.addedAt, lang)}
                    </p>
                  </button>
                  <div className="flex items-center gap-4">
                    <PriceCell state={quotes[item.code]} />
                    <span className="flex items-center gap-1.5 text-xs text-ink-300">
                      {t.watchlistAlertsLabel}
                      <Toggle checked={item.alertsEnabled} onChange={() => setAlerts(item.code, !item.alertsEnabled)} />
                    </span>
                    <button
                      type="button"
                      onClick={() => remove(item.code)}
                      className="rounded-full border border-ink-600 px-2.5 py-1 text-xs font-medium text-ink-200 transition hover:border-bear hover:text-bear"
                    >
                      {t.watchlistRemove}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
