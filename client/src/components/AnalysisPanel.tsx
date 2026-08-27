import { useLanguage } from "../i18n/LanguageContext";
import { formatCompactNumber, formatNumber, formatPercent, formatPrice } from "../lib/format";
import type { Analysis, Reason, Verdict } from "../types";

const VERDICT_STYLES: Record<Verdict, { ring: string; bg: string; text: string; bar: string }> = {
  strong_buy: { ring: "ring-brand-400/40", bg: "bg-brand-500/15", text: "text-brand-300", bar: "bg-brand-400" },
  buy: { ring: "ring-brand-500/30", bg: "bg-brand-600/15", text: "text-brand-400", bar: "bg-brand-500" },
  hold: { ring: "ring-gold-500/30", bg: "bg-gold-500/15", text: "text-gold-400", bar: "bg-gold-500" },
  sell: { ring: "ring-bear/30", bg: "bg-bear/15", text: "text-bear", bar: "bg-bear" },
  strong_sell: { ring: "ring-bear/40", bg: "bg-bear/20", text: "text-bear", bar: "bg-bear" },
};

function ReasonRow({ reason, lang }: { reason: Reason; lang: "en" | "ar" }) {
  const magnitude = Math.min(Math.abs(reason.signal), 1) * 100;
  const positive = reason.signal >= 0;
  return (
    <li className="flex gap-3 py-3">
      <div className="mt-1 h-2 w-14 shrink-0 overflow-hidden rounded-full bg-ink-700 sm:w-16">
        <div
          className={`h-full rounded-full ${positive ? "bg-brand-400" : "bg-bear"}`}
          style={{ width: `${Math.max(magnitude, 8)}%` }}
        />
      </div>
      <p className="text-sm leading-relaxed text-ink-100">{lang === "ar" ? reason.ar : reason.en}</p>
    </li>
  );
}

function TargetCard({
  label,
  price,
  pct,
  currency,
  lang,
}: {
  label: string;
  price: number;
  pct: number;
  currency: string;
  lang: "en" | "ar";
}) {
  const up = pct >= 0;
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3.5">
      <p className="text-[11px] uppercase tracking-wide text-ink-300">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-ink-100 sm:text-xl">{formatPrice(price, lang, currency)}</p>
      <p className={`mt-1 inline-flex items-center gap-1 text-xs font-semibold tabular-nums ${up ? "text-bull" : "text-bear"}`}>
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" className={up ? "" : "rotate-180"}>
          <path d="M12 19V5M6 11l6-6 6 6" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        {formatPercent(pct, lang)}
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850 px-3.5 py-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-300">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums text-ink-100">{value}</p>
    </div>
  );
}

export function AnalysisPanel({ analysis, currency }: { analysis: Analysis; currency: string }) {
  const { t, lang } = useLanguage();

  if (analysis.insufficientData || !analysis.verdict) {
    return (
      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-6 text-sm text-ink-300">
        {t.errorTitle}
      </div>
    );
  }

  const verdict = analysis.verdict!;
  const style = VERDICT_STYLES[verdict];
  const score = analysis.score ?? 0;
  const gaugePct = ((score + 100) / 200) * 100;
  const latest = analysis.latest!;
  const mf = analysis.moneyFlow!;

  return (
    <div className="space-y-5">
      {/* Verdict card */}
      <div className={`rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6`}>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-ink-300">{t.recommendation}</p>
            <div
              className={`mt-2 inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-xl font-extrabold ring-1 ring-inset ${style.bg} ${style.text} ${style.ring}`}
            >
              {t.verdict[verdict]}
            </div>
          </div>
          <div className="text-end">
            <p className="text-xs uppercase tracking-wide text-ink-300">{t.compositeScore}</p>
            <p className={`text-3xl font-extrabold tabular-nums ${style.text}`}>
              {score > 0 ? "+" : ""}
              {formatNumber(score, lang, 0)}
            </p>
          </div>
        </div>

        <div className="mt-5">
          <div className="relative h-2.5 rounded-full bg-gradient-to-r from-bear via-ink-600 to-brand-400">
            <div
              className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full border-2 border-black/15 bg-white shadow"
              style={{ insetInlineStart: `calc(${gaugePct}% - 8px)` }}
            />
          </div>
          <p className="mt-2 text-xs text-ink-300">{t.scoreHint}</p>
        </div>
      </div>

      {/* Price targets */}
      {analysis.priceTargets && (
        <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
          <h3 className="text-base font-semibold text-ink-100">{t.priceTargetsTitle}</h3>
          <p className="mt-1 text-sm text-ink-300">{t.priceTargetsSubtitle}</p>
          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <TargetCard
              label={t.fairValue}
              price={analysis.priceTargets.fairValue}
              pct={analysis.priceTargets.fairValuePct}
              currency={currency}
              lang={lang}
            />
            <TargetCard
              label={t.targetBuyPrice}
              price={analysis.priceTargets.targetBuy}
              pct={analysis.priceTargets.targetBuyPct}
              currency={currency}
              lang={lang}
            />
            <TargetCard
              label={t.targetSellPrice}
              price={analysis.priceTargets.targetSell}
              pct={analysis.priceTargets.targetSellPct}
              currency={currency}
              lang={lang}
            />
          </div>
          <p className="mt-3 text-xs text-ink-300">{t.vsCurrent}</p>
        </div>
      )}

      {/* Why this call */}
      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
        <h3 className="text-base font-semibold text-ink-100">{t.whyThisCall}</h3>
        <ul className="mt-1 divide-y divide-ink-800">
          {analysis.reasons?.map((r, i) => (
            <ReasonRow key={i} reason={r} lang={lang} />
          ))}
        </ul>
      </div>

      {/* Money flow / big players */}
      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
        <h3 className="text-base font-semibold text-ink-100">{t.moneyFlowTitle}</h3>
        <p className="mt-1 text-sm text-ink-300">{t.moneyFlowSubtitle}</p>

        <p className="mt-4 rounded-2xl bg-ink-850 p-3.5 text-sm leading-relaxed text-ink-100 ring-1 ring-inset ring-ink-700">
          {lang === "ar" ? mf.note.ar : mf.note.en}
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={t.cmfLabel} value={formatNumber(mf.cmf20, lang, 3)} />
          <StatCard label={t.mfiLabel} value={formatNumber(mf.mfi14, lang, 1)} />
          <StatCard label={t.accumulationDays} value={formatNumber(mf.accumulationDays, lang, 0)} />
          <StatCard label={t.distributionDays} value={formatNumber(mf.distributionDays, lang, 0)} />
        </div>

        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-ink-300">{t.obvTrend}:</span>
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              mf.obvTrendUp ? "bg-brand-500/15 text-brand-300" : "bg-bear/15 text-bear"
            }`}
          >
            {mf.obvTrendUp ? t.obvUp : t.obvDown}
          </span>
        </div>
      </div>

      {/* Key indicators */}
      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
        <h3 className="text-base font-semibold text-ink-100">{t.indicatorsTitle}</h3>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <StatCard label={t.sma20} value={formatPrice(latest.sma20, lang, currency)} />
          <StatCard label={t.sma50} value={formatPrice(latest.sma50, lang, currency)} />
          <StatCard label={t.rsi14} value={formatNumber(latest.rsi14, lang, 1)} />
          <StatCard label={t.macd} value={formatNumber(latest.macd, lang, 3)} />
          <StatCard label={t.macdSignal} value={formatNumber(latest.macdSignal, lang, 3)} />
          <StatCard
            label={t.bollinger}
            value={`${formatNumber(latest.bollingerLower, lang, 1)} – ${formatNumber(latest.bollingerUpper, lang, 1)}`}
          />
        </div>
        <p className="mt-3 text-xs text-ink-300">
          {t.volume}: {formatCompactNumber(mf.lastVolume, lang)}
        </p>
      </div>

      {/* Disclaimer */}
      <div className="rounded-3xl border border-ink-700 bg-ink-850/60 p-5 text-sm text-ink-300">
        <p className="font-semibold text-ink-100">{t.disclaimerTitle}</p>
        <p className="mt-1.5 leading-relaxed">{t.disclaimerBody}</p>
      </div>
    </div>
  );
}
