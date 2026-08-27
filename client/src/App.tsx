import { useCallback, useEffect, useRef, useState } from "react";
import { Header } from "./components/Header";
import { SearchBar } from "./components/SearchBar";
import { PriceHeader } from "./components/PriceHeader";
import { PriceChart } from "./components/PriceChart";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { DemoBanner } from "./components/DemoBanner";
import { AlertsPage } from "./components/AlertsPage";
import { LoginPage } from "./components/LoginPage";
import { AdminPage } from "./components/AdminPage";
import { useLanguage } from "./i18n/LanguageContext";
import { useCompanies } from "./lib/CompaniesContext";
import { fetchQuote } from "./lib/api";
import { parseHash, type View } from "./lib/hashRoute";
import type { QuoteResponse } from "./types";

// Matches the backend's quote cache TTL (server/index.js) — polling faster than
// this just re-serves the same cached numbers, so it's the fastest interval
// that actually buys fresher data instead of wasted requests.
const REFRESH_INTERVAL_MS = 60_000;

export default function App() {
  const { t } = useLanguage();
  const { companies, refresh: refreshCompanies } = useCompanies();
  const [view, setView] = useState<View>(() => parseHash().view);
  const [code, setCode] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const codeRef = useRef<string | null>(null);
  const knownCodesRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const onHashChange = () => setView(parseHash().view);
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    knownCodesRef.current = new Set(companies.map((c) => c.code));
  }, [companies]);

  const load = useCallback(
    async (c: string, opts?: { silent?: boolean }) => {
      if (opts?.silent) setRefreshing(true);
      else setLoading(true);
      if (!opts?.silent) setError(null);

      try {
        const data = await fetchQuote(c);
        // Ignore a stale response landing after the user already switched companies.
        if (codeRef.current !== c) return;
        setQuote(data);
        setLastUpdated(Date.now());
        setError(null);
        // A live lookup for a code outside our loaded directory means the
        // backend just added it — refresh so search/alerts see it this session.
        if (data.dataSource === "live" && !knownCodesRef.current.has(c)) {
          refreshCompanies();
        }
      } catch (err) {
        if (codeRef.current !== c) return;
        if (!opts?.silent) {
          setError(err instanceof Error ? err.message : String(err));
          setQuote(null);
        }
        // Silent background refresh failures keep showing the last good quote.
      } finally {
        if (codeRef.current !== c) return;
        if (opts?.silent) setRefreshing(false);
        else setLoading(false);
      }
    },
    [refreshCompanies]
  );

  useEffect(() => {
    codeRef.current = code;
    if (!code) return;
    load(code);

    const interval = setInterval(() => load(code, { silent: true }), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [code, load]);

  const company = code ? companies.find((c) => c.code === code) ?? null : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900">
      <Header view={view} />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
        {view === "login" ? (
          <LoginPage />
        ) : view === "alerts" ? (
          <AlertsPage />
        ) : view === "admin" ? (
          <AdminPage />
        ) : (
          <>
            <div className="mx-auto max-w-2xl">
              <SearchBar onSelect={setCode} />
            </div>

            <div className="mt-8">
              {!code && (
                <div className="flex flex-col items-center gap-2 rounded-3xl border border-dashed border-ink-700 py-20 text-center">
                  <img src="/icon.svg" alt="" className="h-14 w-14 rounded-2xl opacity-90" />
                  <p className="mt-3 text-lg font-semibold text-white">{t.selectPrompt}</p>
                  <p className="text-sm text-ink-300">{t.selectPromptSub}</p>
                </div>
              )}

              {code && loading && (
                <div className="flex flex-col items-center gap-3 py-24 text-ink-300">
                  <span className="h-9 w-9 animate-spin rounded-full border-2 border-ink-600 border-t-brand-400" />
                  <p className="text-sm">{t.loading}</p>
                </div>
              )}

              {code && !loading && error && (
                <div className="rounded-3xl border border-bear/30 bg-bear/10 p-6 text-center">
                  <p className="font-semibold text-bear">{t.errorTitle}</p>
                  <p className="mt-1 text-sm text-ink-200">{error}</p>
                  <button
                    type="button"
                    onClick={() => load(code)}
                    className="mt-4 rounded-full bg-bear/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-bear"
                  >
                    {t.retry}
                  </button>
                </div>
              )}

              {code && !loading && !error && quote && (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-5 lg:items-start">
                  <div className="space-y-5 lg:col-span-3">
                    {quote.dataSource === "demo" && <DemoBanner />}
                    <PriceHeader
                      quote={quote}
                      company={company}
                      refreshing={refreshing}
                      lastUpdated={lastUpdated}
                      onRefresh={() => load(code, { silent: true })}
                    />
                    <PriceChart series={quote.series} />
                  </div>
                  <div className="lg:col-span-2">
                    <AnalysisPanel analysis={quote.analysis} currency={quote.currency} />
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-ink-800 px-4 py-6 text-center text-xs text-ink-300 sm:px-6">
        {t.footer}
      </footer>
    </div>
  );
}
