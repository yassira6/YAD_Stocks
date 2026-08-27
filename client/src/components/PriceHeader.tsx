import { useLanguage } from "../i18n/LanguageContext";
import { formatDateTime, formatPercent, formatPrice } from "../lib/format";
import type { Company, QuoteResponse } from "../types";

interface Props {
  quote: QuoteResponse;
  company: Company | null;
  refreshing?: boolean;
  lastUpdated?: number | null;
  onRefresh?: () => void;
}

export function PriceHeader({ quote, company, refreshing, onRefresh }: Props) {
  const { t, lang } = useLanguage();
  const change = quote.regularMarketPrice - quote.previousClose;
  const changePct = quote.previousClose ? change / quote.previousClose : 0;
  const isUp = change >= 0;

  const name = company ? (lang === "ar" ? company.nameAr || company.nameEn : company.nameEn) : quote.code;
  const sector = company ? (lang === "ar" ? company.sectorAr : company.sectorEn) : null;

  return (
    <div className="rounded-3xl border border-ink-700 bg-gradient-to-br from-ink-850 to-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-ink-100 sm:text-2xl">{name}</h2>
            <span className="rounded-lg bg-ink-700 px-2 py-0.5 font-mono text-xs font-semibold text-brand-300">
              {quote.code}
            </span>
          </div>
          {sector && <p className="mt-1 text-sm text-ink-300">{sector}</p>}
        </div>

        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
            quote.dataSource === "live"
              ? "bg-brand-500/15 text-brand-300 ring-1 ring-inset ring-brand-500/30"
              : "bg-gold-500/15 text-gold-400 ring-1 ring-inset ring-gold-500/30"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${quote.dataSource === "live" ? "bg-brand-400" : "bg-gold-400"}`} />
          {quote.dataSource === "live" ? t.liveBadge : t.demoBannerTitle}
        </span>
      </div>

      <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wide text-ink-300">{t.latestPrice}</p>
          <p className="mt-1 text-4xl font-extrabold tabular-nums text-ink-100 sm:text-5xl">
            {formatPrice(quote.regularMarketPrice, lang, quote.currency)}
          </p>
        </div>

        <div
          className={`flex items-center gap-1.5 rounded-2xl px-3 py-2 text-sm font-semibold tabular-nums ${
            isUp ? "bg-bull/10 text-bull" : "bg-bear/10 text-bear"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" className={isUp ? "" : "rotate-180"}>
            <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <span>
            {isUp ? "+" : ""}
            {formatPrice(change, lang, quote.currency)}
          </span>
          <span className="opacity-80">({formatPercent(changePct, lang)})</span>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-300">
          {t.asOf} {formatDateTime(quote.regularMarketTime, lang)} · {quote.exchangeName}
        </p>

        <div className="flex items-center gap-2 text-xs text-ink-300">
          <span className="inline-flex items-center gap-1">
            <span className={`h-1.5 w-1.5 rounded-full bg-brand-400 ${refreshing ? "animate-pulse" : ""}`} />
            {refreshing ? t.refreshing : t.autoRefreshNote}
          </span>
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              disabled={refreshing}
              aria-label={t.refreshNow}
              title={t.refreshNow}
              className="rounded-full border border-ink-600 p-1.5 text-ink-200 transition hover:border-brand-500 hover:text-brand-300 disabled:opacity-50"
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                className={refreshing ? "animate-spin" : ""}
              >
                <path
                  d="M4 12a8 8 0 0 1 14.5-4.5M20 12a8 8 0 0 1-14.5 4.5M4 4v5h5M20 20v-5h-5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
