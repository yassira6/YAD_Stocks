import { useEffect, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../lib/AuthContext";
import { useTheme } from "../lib/ThemeContext";
import { navigateTo, type View } from "../lib/hashRoute";

interface Props {
  view: View;
}

export function Header({ view }: Props) {
  const { t, lang, toggleLang } = useLanguage();
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  const navItems: { view: View; label: string }[] = [
    { view: "stock", label: t.navStocks },
    ...(user ? [{ view: "watchlist" as View, label: t.navWatchlist }] : []),
    { view: "alerts", label: t.navAlerts },
    { view: "signals", label: t.navSignals },
    ...(user?.isAdmin ? [{ view: "admin" as View, label: t.navAdmin }] : []),
  ];

  // Close the mobile nav dropdown on outside click.
  useEffect(() => {
    if (!navOpen) return;
    const onClick = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setNavOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [navOpen]);

  const goTo = (v: View) => {
    navigateTo(v);
    setNavOpen(false);
  };

  return (
    <header className="sticky top-0 z-30 border-b border-ink-700/60 bg-ink-950/85 backdrop-blur supports-[backdrop-filter]:bg-ink-950/70">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
        <button
          type="button"
          onClick={() => navigateTo("stock")}
          className="flex min-w-0 shrink items-center gap-3 rounded-xl text-start transition hover:opacity-90"
          aria-label={t.appName}
        >
          <img src="/icon.svg" alt="" className="h-9 w-9 shrink-0 rounded-xl shadow-lg shadow-brand-900/40 sm:h-10 sm:w-10" />
          <div className="min-w-0 leading-tight">
            <h1 className="truncate text-base font-bold tracking-tight text-ink-100 sm:text-lg">{t.appName}</h1>
            <p className="hidden truncate text-xs text-ink-300 lg:block">{t.tagline}</p>
          </div>
        </button>

        <div className="flex shrink-0 items-center gap-2">
          <nav className="hidden items-center gap-1 rounded-full border border-ink-700 bg-ink-850/70 p-1 lg:flex">
            {navItems.map((item) => (
              <button
                key={item.view}
                type="button"
                onClick={() => navigateTo(item.view)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${
                  view === item.view ? "bg-brand-600 text-white" : "text-ink-200 hover:text-ink-100"
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>

          <button
            type="button"
            onClick={toggleLang}
            className="flex items-center gap-1.5 rounded-full border border-ink-600 bg-ink-800/70 px-2.5 py-1.5 text-sm font-medium text-ink-100 transition hover:border-brand-500 hover:text-brand-300 active:scale-95 sm:px-3"
            aria-label="Switch language"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" className="shrink-0 opacity-70">
              <path
                d="M4 5h9M8.5 3v2m0 0c0 4-1.5 8-5.5 10M6 10c1 2.5 3 4 6 5M14 21l4-9 4 9M15.5 18h5"
                stroke="currentColor"
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden sm:inline">{lang === "en" ? "العربية" : "English"}</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="flex items-center justify-center rounded-full border border-ink-600 bg-ink-800/70 p-2 text-ink-100 transition hover:border-brand-500 hover:text-brand-300 active:scale-95"
            aria-label={theme === "dark" ? t.toggleThemeToLight : t.toggleThemeToDark}
            title={theme === "dark" ? t.toggleThemeToLight : t.toggleThemeToDark}
          >
            {theme === "dark" ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.8" />
                <path
                  d="M12 2.5v2M12 19.5v2M4.5 12h-2M21.5 12h-2M6.3 6.3 4.9 4.9M19.1 19.1l-1.4-1.4M6.3 17.7l-1.4 1.4M19.1 4.9l-1.4 1.4"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path
                  d="M20.5 14.5A8.5 8.5 0 1 1 9.5 3.5a7 7 0 0 0 11 11Z"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinejoin="round"
                />
              </svg>
            )}
          </button>

          {user ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setNavOpen(false);
                  setMenuOpen((o) => !o);
                }}
                className="flex items-center gap-2 rounded-full border border-ink-600 bg-ink-800/70 py-1 ps-1 pe-2.5 text-sm font-medium text-ink-100 transition hover:border-brand-500 sm:pe-3"
              >
                {user.picture ? (
                  <img src={user.picture} alt="" className="h-6 w-6 shrink-0 rounded-full" referrerPolicy="no-referrer" />
                ) : (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">
                    {(user.name || user.email)[0]?.toUpperCase()}
                  </span>
                )}
                <span className="hidden max-w-[10ch] truncate sm:inline">{user.name || user.email}</span>
              </button>
              {menuOpen && (
                <div className="absolute end-0 z-40 mt-2 w-56 overflow-hidden rounded-2xl border border-ink-600 bg-ink-850 shadow-2xl shadow-black/50">
                  <p className="truncate border-b border-ink-700 px-4 py-2.5 text-xs text-ink-300">
                    {t.signedInAs} <span className="text-ink-100">{user.email}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      logout();
                    }}
                    className="block w-full px-4 py-2.5 text-start text-sm text-ink-100 transition hover:bg-ink-800"
                  >
                    {t.logout}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => navigateTo("login")}
              className="rounded-full bg-brand-600 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-brand-500 sm:px-3.5"
            >
              {t.navLogin}
            </button>
          )}

          <div className="relative lg:hidden" ref={navRef}>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                setNavOpen((o) => !o);
              }}
              className="flex items-center justify-center rounded-full border border-ink-600 bg-ink-800/70 p-2 text-ink-100 transition hover:border-brand-500 hover:text-brand-300 active:scale-95"
              aria-label={navOpen ? t.menuCloseLabel : t.menuOpenLabel}
              aria-expanded={navOpen}
            >
              {navOpen ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M5 5l14 14M19 5 5 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              )}
            </button>
            {navOpen && (
              <nav className="absolute end-0 z-40 mt-2 w-48 overflow-hidden rounded-2xl border border-ink-600 bg-ink-850 p-1.5 shadow-2xl shadow-black/50">
                {navItems.map((item) => (
                  <button
                    key={item.view}
                    type="button"
                    onClick={() => goTo(item.view)}
                    className={`block w-full rounded-xl px-3.5 py-2.5 text-start text-sm font-medium transition ${
                      view === item.view ? "bg-brand-600 text-white" : "text-ink-100 hover:bg-ink-800"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </nav>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
