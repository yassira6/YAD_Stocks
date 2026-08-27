import { useCallback, useEffect, useState } from "react";
import { Header } from "./components/Header";
import { SearchBar } from "./components/SearchBar";
import { PriceHeader } from "./components/PriceHeader";
import { PriceChart } from "./components/PriceChart";
import { AnalysisPanel } from "./components/AnalysisPanel";
import { DemoBanner } from "./components/DemoBanner";
import { useLanguage } from "./i18n/LanguageContext";
import { fetchQuote } from "./lib/api";
import companies from "./data/companies.json";
import type { Company, QuoteResponse } from "./types";

const ALL_COMPANIES = companies as Company[];

function findCompany(code: string): Company | null {
  return ALL_COMPANIES.find((c) => c.code === code) ?? null;
}

export default function App() {
  const { t } = useLanguage();
  const [code, setCode] = useState<string | null>(null);
  const [quote, setQuote] = useState<QuoteResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (c: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchQuote(c);
      setQuote(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setQuote(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (code) load(code);
  }, [code, load]);

  const company = code ? findCompany(code) : null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-ink-950 via-ink-950 to-ink-900">
      <Header />

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6">
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
                <PriceHeader quote={quote} company={company} />
                <PriceChart series={quote.series} />
              </div>
              <div className="lg:col-span-2">
                <AnalysisPanel analysis={quote.analysis} currency={quote.currency} />
              </div>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-ink-800 px-4 py-6 text-center text-xs text-ink-300 sm:px-6">
        {t.footer}
      </footer>
    </div>
  );
}
