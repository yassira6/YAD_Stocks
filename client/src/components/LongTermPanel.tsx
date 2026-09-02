import { useLanguage } from "../i18n/LanguageContext";
import { formatDate, formatNumber, formatPercent, formatPrice } from "../lib/format";
import type { LongTermAnalysis, LongTermTrend, PriceLevel } from "../types";

const TREND_STYLES: Record<LongTermTrend, { bg: string; text: string; ring: string }> = {
  uptrend: { bg: "bg-brand-500/15", text: "text-brand-300", ring: "ring-brand-400/40" },
  downtrend: { bg: "bg-bear/15", text: "text-bear", ring: "ring-bear/40" },
  neutral: { bg: "bg-gold-500/15", text: "text-gold-400", ring: "ring-gold-500/30" },
};

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-850 px-3.5 py-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-300">{label}</p>
      <p className="mt-1 text-base font-semibold tabular-nums text-ink-100">{value}</p>
    </div>
  );
}

function LevelRow({ level, currency, lang }: { level: PriceLevel; currency: string; lang: "en" | "ar" }) {
  const up = level.distancePct >= 0;
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <span className="font-semibold tabular-nums text-ink-100">{formatPrice(level.price, lang, currency)}</span>
      <span className={`text-xs font-semibold tabular-nums ${up ? "text-bull" : "text-bear"}`}>{formatPercent(level.distancePct, lang)}</span>
    </li>
  );
}

export function LongTermPanel({ longTerm, currency }: { longTerm: LongTermAnalysis | null; currency: string }) {
  const { t, lang } = useLanguage();

  if (!longTerm) return null;

  const trendStyle = TREND_STYLES[longTerm.trend];
  const si = longTerm.shortInterest;

  return (
    <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-ink-100">{t.longTermTitle}</h3>
          <p className="mt-1 text-sm text-ink-300">{t.longTermSubtitle}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {longTerm.goldenCross && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-500/15 px-3 py-1.5 text-xs font-bold text-brand-300 ring-1 ring-inset ring-brand-400/40">
              {t.goldenCross}
            </span>
          )}
          {longTerm.deathCross && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-bear/15 px-3 py-1.5 text-xs font-bold text-bear ring-1 ring-inset ring-bear/40">
              {t.deathCross}
            </span>
          )}
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-bold ring-1 ring-inset ${trendStyle.bg} ${trendStyle.text} ${trendStyle.ring}`}>
            {t.longTermTrend[longTerm.trend]}
          </span>
        </div>
      </div>

      {/* Moving averages + momentum */}
      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label={t.sma50Label} value={formatPrice(longTerm.sma50, lang, currency)} />
        <StatCard label={t.sma100Label} value={longTerm.sma100 != null ? formatPrice(longTerm.sma100, lang, currency) : t.notAvailable} />
        <StatCard label={t.sma200Label} value={longTerm.sma200 != null ? formatPrice(longTerm.sma200, lang, currency) : t.notAvailable} />
        <StatCard label={t.rsi14} value={longTerm.rsi14 != null ? formatNumber(longTerm.rsi14, lang, 1) : t.notAvailable} />
        <StatCard label={t.macd} value={longTerm.macd.macdLine != null ? formatNumber(longTerm.macd.macdLine, lang, 3) : t.notAvailable} />
        <StatCard label={t.macdSignal} value={longTerm.macd.signalLine != null ? formatNumber(longTerm.macd.signalLine, lang, 3) : t.notAvailable} />
      </div>

      {/* Support / Resistance */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3.5">
          <p className="text-[11px] uppercase tracking-wide text-ink-300">{t.supportLabel}</p>
          {longTerm.support.length === 0 ? (
            <p className="mt-2 text-sm text-ink-300">{t.notAvailable}</p>
          ) : (
            <ul className="mt-1 divide-y divide-ink-800">
              {longTerm.support.map((s, i) => (
                <LevelRow key={i} level={s} currency={currency} lang={lang} />
              ))}
            </ul>
          )}
        </div>
        <div className="rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3.5">
          <p className="text-[11px] uppercase tracking-wide text-ink-300">{t.resistanceLabel}</p>
          {longTerm.resistance.length === 0 ? (
            <p className="mt-2 text-sm text-ink-300">{t.notAvailable}</p>
          ) : (
            <ul className="mt-1 divide-y divide-ink-800">
              {longTerm.resistance.map((r, i) => (
                <LevelRow key={i} level={r} currency={currency} lang={lang} />
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Entry / exit */}
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {longTerm.entry && (
          <div className="rounded-2xl bg-brand-500/10 p-3.5 ring-1 ring-inset ring-brand-400/30">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-300">{t.entryLabel}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink-100">{formatPrice(longTerm.entry.price, lang, currency)}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-300">{lang === "ar" ? longTerm.entry.note.ar : longTerm.entry.note.en}</p>
          </div>
        )}
        {longTerm.exit && (
          <div className="rounded-2xl bg-bear/10 p-3.5 ring-1 ring-inset ring-bear/30">
            <p className="text-xs font-bold uppercase tracking-wide text-bear">{t.exitLabel}</p>
            <p className="mt-1 text-lg font-bold tabular-nums text-ink-100">{formatPrice(longTerm.exit.price, lang, currency)}</p>
            <p className="mt-1.5 text-xs leading-relaxed text-ink-300">{lang === "ar" ? longTerm.exit.note.ar : longTerm.exit.note.en}</p>
          </div>
        )}
      </div>

      {/* Short interest */}
      <div className="mt-5 rounded-2xl border border-ink-700 bg-ink-850 px-4 py-3.5">
        <p className="text-[11px] uppercase tracking-wide text-ink-300">{t.shortInterestLabel}</p>
        {si ? (
          <>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <StatCard
                label={t.shortPercentFloat}
                value={si.shortPercentOfFloat != null ? `${formatNumber(si.shortPercentOfFloat * 100, lang, 2)}%` : t.notAvailable}
              />
              <StatCard label={t.shortRatioLabel} value={si.shortRatio != null ? formatNumber(si.shortRatio, lang, 1) : t.notAvailable} />
              {si.asOf != null && <StatCard label={t.asOfLabel} value={formatDate(new Date(si.asOf).toISOString(), lang)} />}
            </div>
            <p className="mt-2.5 text-xs leading-relaxed text-ink-400">{t.shortInterestNote}</p>
          </>
        ) : (
          <p className="mt-1.5 text-sm text-ink-300">{t.shortInterestUnavailable}</p>
        )}
      </div>

      <p className="mt-4 text-xs leading-relaxed text-ink-400">{lang === "ar" ? longTerm.note.ar : longTerm.note.en}</p>
    </div>
  );
}
