import { useLanguage } from "../i18n/LanguageContext";
import type { View } from "../App";

interface Props {
  view: View;
  onNavigate: (view: View) => void;
}

export function Header({ view, onNavigate }: Props) {
  const { t, lang, toggleLang } = useLanguage();

  return (
    <header className="sticky top-0 z-30 border-b border-ink-700/60 bg-ink-950/85 backdrop-blur supports-[backdrop-filter]:bg-ink-950/70">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <img src="/icon.svg" alt="" className="h-9 w-9 rounded-xl shadow-lg shadow-brand-900/40 sm:h-10 sm:w-10" />
          <div className="leading-tight">
            <h1 className="text-base font-bold tracking-tight text-white sm:text-lg">{t.appName}</h1>
            <p className="hidden text-xs text-ink-300 sm:block">{t.tagline}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <nav className="flex items-center gap-1 rounded-full border border-ink-700 bg-ink-850/70 p-1">
            <button
              type="button"
              onClick={() => onNavigate("stock")}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                view === "stock" ? "bg-brand-600 text-white" : "text-ink-200 hover:text-white"
              }`}
            >
              {t.navStocks}
            </button>
            <button
              type="button"
              onClick={() => onNavigate("alerts")}
              className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                view === "alerts" ? "bg-brand-600 text-white" : "text-ink-200 hover:text-white"
              }`}
            >
              {t.navAlerts}
            </button>
          </nav>

          <button
            type="button"
            onClick={toggleLang}
            className="flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-800/70 px-3 py-1.5 text-sm font-medium text-ink-100 transition hover:border-brand-500 hover:text-brand-300 active:scale-95"
            aria-label="Switch language"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="opacity-70">
              <path
                d="M4 5h9M8.5 3v2m0 0c0 4-1.5 8-5.5 10M6 10c1 2.5 3 4 6 5M14 21l4-9 4 9M15.5 18h5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            {lang === "en" ? "العربية" : "English"}
          </button>
        </div>
      </div>
    </header>
  );
}
