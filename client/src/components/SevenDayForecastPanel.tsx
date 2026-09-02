import { useLanguage } from "../i18n/LanguageContext";
import { formatPercent, formatPrice } from "../lib/format";
import type { SevenDayCall, SevenDayForecast } from "../types";

const CALL_STYLES: Record<SevenDayCall, { bg: string; text: string; ring: string }> = {
  buy: { bg: "bg-brand-500/15", text: "text-brand-300", ring: "ring-brand-400/40" },
  sell: { bg: "bg-bear/15", text: "text-bear", ring: "ring-bear/40" },
  keep: { bg: "bg-gold-500/15", text: "text-gold-400", ring: "ring-gold-500/30" },
};

function PriceCard({ label, price, currency, lang }: { label: string; price: number; currency: string; lang: "en" | "ar" }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-wide text-ink-300">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-ink-100 sm:text-xl">{formatPrice(price, lang, currency)}</p>
    </div>
  );
}

export function SevenDayForecastPanel({ forecast, currency }: { forecast: SevenDayForecast | null; currency: string }) {
  const { t, lang } = useLanguage();

  if (!forecast) return null;

  const callLabel = lang === "ar" ? forecast.callLabel.ar : forecast.callLabel.en;
  const callStyle = CALL_STYLES[forecast.call];
  const up = forecast.projectedChangePct >= 0;

  return (
    <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink-100">{t.sevenDayTitle}</h3>
          <p className="mt-1 text-sm text-ink-300">{t.sevenDaySubtitle}</p>
        </div>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ring-inset ${callStyle.bg} ${callStyle.text} ${callStyle.ring}`}>
          {callLabel}
        </span>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <PriceCard label={t.sevenDayProjected} price={forecast.projectedPrice} currency={currency} lang={lang} />
        <PriceCard label={t.sevenDayBuyPrice} price={forecast.buyPrice} currency={currency} lang={lang} />
        <PriceCard label={t.sevenDaySellPrice} price={forecast.sellPrice} currency={currency} lang={lang} />
      </div>

      <p className={`mt-3 inline-flex items-center gap-1 text-sm font-semibold tabular-nums ${up ? "text-bull" : "text-bear"}`}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" className={up ? "" : "rotate-180"}>
          <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {formatPercent(forecast.projectedChangePct, lang)} {t.sevenDayVsCurrent}
      </p>

      <p className="mt-3 text-xs leading-relaxed text-ink-400">{lang === "ar" ? forecast.note.ar : forecast.note.en}</p>
    </div>
  );
}
