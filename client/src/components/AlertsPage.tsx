import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useCompanies } from "../lib/CompaniesContext";
import { useAuth } from "../lib/AuthContext";
import { SearchBar } from "./SearchBar";
import { LoginPage } from "./LoginPage";
import { fetchQuote, createAlert, fetchMyAlerts, cancelAlert as cancelAlertApi } from "../lib/api";
import { formatDateTime, formatPrice } from "../lib/format";
import type { AlertDirection, PriceAlert, QuoteResponse } from "../types";

const STATUS_STYLES: Record<PriceAlert["status"], string> = {
  active: "bg-brand-500/15 text-brand-300 ring-1 ring-inset ring-brand-500/30",
  triggered: "bg-gold-500/15 text-gold-400 ring-1 ring-inset ring-gold-500/30",
  cancelled: "bg-ink-700 text-ink-300 ring-1 ring-inset ring-ink-600",
};

export function AlertsPage() {
  const { t, lang } = useLanguage();
  const { companies } = useCompanies();
  const { user, loading: authLoading } = useAuth();

  const [code, setCode] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [direction, setDirection] = useState<AlertDirection>("buy");
  const [targetPrice, setTargetPrice] = useState("");
  const [targetEdited, setTargetEdited] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  const [myAlerts, setMyAlerts] = useState<PriceAlert[]>([]);
  const [alertsLoading, setAlertsLoading] = useState(false);

  const company = code ? companies.find((c) => c.code === code) ?? null : null;

  useEffect(() => {
    if (!code) return;
    let cancelled = false;
    setQuoteLoading(true);
    setQuote(null);
    fetchQuote(code)
      .then((data) => {
        if (cancelled) return;
        setQuote(data);
      })
      .catch(() => {
        /* silent — the form still works without a suggested target */
      })
      .finally(() => {
        if (!cancelled) setQuoteLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [code]);

  useEffect(() => {
    if (!quote || targetEdited) return;
    const targets = quote.analysis.priceTargets;
    const suggested = direction === "buy" ? targets?.targetBuy : targets?.targetSell;
    if (suggested != null) setTargetPrice(suggested.toFixed(2));
  }, [quote, direction, targetEdited]);

  function loadMyAlerts() {
    if (!user) return;
    setAlertsLoading(true);
    fetchMyAlerts()
      .then(setMyAlerts)
      .catch(() => setMyAlerts([]))
      .finally(() => setAlertsLoading(false));
  }

  useEffect(() => {
    loadMyAlerts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!code) return;
    setSubmitting(true);
    setSubmitError(null);
    setSubmitSuccess(false);
    try {
      await createAlert({ code, direction, targetPrice: Number(targetPrice), lang });
      setSubmitSuccess(true);
      setCode(null);
      setQuote(null);
      setTargetPrice("");
      setTargetEdited(false);
      loadMyAlerts();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  async function onCancel(id: string) {
    try {
      await cancelAlertApi(id);
      loadMyAlerts();
    } catch {
      // best-effort; the list refresh on next poll will reconcile
    }
  }

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-sm space-y-4 text-center">
        <p className="text-sm text-ink-300">{t.alertsLoginRequired}</p>
        <LoginPage />
      </div>
    );
  }

  const canSubmit = !!code && Number(targetPrice) > 0 && !submitting;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-100 sm:text-2xl">{t.alertsTitle}</h2>
        <p className="mt-1 text-sm text-ink-300">{t.alertsSubtitle}</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-5 rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6"
      >
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-ink-100">{t.alertsFormTitle}</h3>
          <p className="text-xs text-ink-300">
            {t.signedInAs} <span className="text-ink-100">{user.email}</span>
          </p>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-300">
            {t.alertsCompanyLabel}
          </label>
          <SearchBar onSelect={setCode} />
        </div>

        {code && (
          <div className="rounded-2xl border border-ink-700 bg-ink-850 p-3.5 text-sm">
            {quoteLoading ? (
              <p className="text-ink-300">{t.loading}</p>
            ) : quote ? (
              <p className="text-ink-100">
                {company ? (lang === "ar" ? company.nameAr || company.nameEn : company.nameEn) : code}
                <span className="mx-2 text-ink-300">·</span>
                {t.alertsCurrentPrice}: <span className="font-semibold text-ink-100">{formatPrice(quote.regularMarketPrice, lang, quote.currency)}</span>
              </p>
            ) : null}
          </div>
        )}

        <div>
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-ink-300">
            {t.alertsDirectionLabel}
          </label>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setDirection("buy")}
              className={`rounded-2xl border px-4 py-3 text-start text-sm font-medium transition ${
                direction === "buy"
                  ? "border-brand-500 bg-brand-500/10 text-brand-300"
                  : "border-ink-700 bg-ink-850 text-ink-200 hover:border-ink-500"
              }`}
            >
              {t.alertsBuyOption}
            </button>
            <button
              type="button"
              onClick={() => setDirection("sell")}
              className={`rounded-2xl border px-4 py-3 text-start text-sm font-medium transition ${
                direction === "sell"
                  ? "border-bear bg-bear/10 text-bear"
                  : "border-ink-700 bg-ink-850 text-ink-200 hover:border-ink-500"
              }`}
            >
              {t.alertsSellOption}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-ink-300">
            {t.alertsTargetLabel}
          </label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={targetPrice}
            onChange={(e) => {
              setTargetPrice(e.target.value);
              setTargetEdited(true);
            }}
            disabled={!code}
            placeholder={!code ? t.alertsSelectFirst : undefined}
            className="w-full rounded-2xl border border-ink-600 bg-ink-800/80 px-4 py-3 text-ink-100 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 disabled:opacity-50"
          />
          {code && <p className="mt-1.5 text-xs text-ink-300">{t.alertsTargetHint}</p>}
        </div>

        {submitError && <p className="text-sm font-medium text-bear">{submitError}</p>}
        {submitSuccess && <p className="text-sm font-medium text-brand-300">{t.alertsCreated}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full rounded-2xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? t.alertsSubmitting : t.alertsSubmit}
        </button>
      </form>

      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-ink-100">{t.alertsMyTitle}</h3>
          <button
            type="button"
            onClick={loadMyAlerts}
            className="rounded-full border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-200 transition hover:border-brand-500 hover:text-brand-300"
          >
            {t.alertsRefresh}
          </button>
        </div>

        {alertsLoading ? (
          <p className="mt-4 text-sm text-ink-300">{t.loading}</p>
        ) : myAlerts.length === 0 ? (
          <p className="mt-4 text-sm text-ink-300">{t.alertsEmpty}</p>
        ) : (
          <ul className="mt-4 divide-y divide-ink-800">
            {myAlerts.map((a) => {
              const c = companies.find((x) => x.code === a.code);
              const name = c ? (lang === "ar" ? c.nameAr || c.nameEn : c.nameEn) : a.code;
              return (
                <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3.5">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink-100">
                      {name} <span className="font-mono text-xs text-brand-300">({a.code})</span>
                    </p>
                    <p className="mt-0.5 text-xs text-ink-300">
                      {a.direction === "buy" ? t.alertsBuyOption : t.alertsSellOption}{" "}
                      <span className="font-semibold text-ink-100">{formatPrice(a.targetPrice, lang, "SAR")}</span>
                    </p>
                    <p className="mt-0.5 text-[11px] text-ink-300/80">
                      {a.status === "triggered" && a.triggeredAt
                        ? `${t.alertsTriggeredAt} ${formatDateTime(a.triggeredAt, lang)}`
                        : `${t.alertsCreatedAt} ${formatDateTime(a.createdAt, lang)}`}
                      {a.status === "triggered" && (
                        <>
                          {" · "}
                          {t.emailDeliveryLabel}:{" "}
                          {a.emailSent ? (
                            <span className="text-brand-300">{t.emailSentYes}</span>
                          ) : (
                            <span className="text-bear">{t.emailSentNo}</span>
                          )}
                        </>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${STATUS_STYLES[a.status]}`}>
                      {a.status === "active" ? t.alertsStatusActive : a.status === "triggered" ? t.alertsStatusTriggered : t.alertsStatusCancelled}
                    </span>
                    {a.status === "active" && (
                      <button
                        type="button"
                        onClick={() => onCancel(a.id)}
                        className="rounded-full border border-ink-600 px-2.5 py-1 text-xs font-medium text-ink-200 transition hover:border-bear hover:text-bear"
                      >
                        {t.alertsCancel}
                      </button>
                    )}
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
