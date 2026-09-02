import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../lib/AuthContext";
import { useWatchlist } from "../lib/WatchlistContext";
import { LoginPage } from "./LoginPage";
import { SearchBar } from "./SearchBar";
import { Toggle } from "./Toggle";
import { navigateTo } from "../lib/hashRoute";
import { formatDateTime } from "../lib/format";

export function WatchlistPage() {
  const { t, lang } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { items, loading, remove, setAlerts } = useWatchlist();

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
                  <div className="flex items-center gap-3">
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
