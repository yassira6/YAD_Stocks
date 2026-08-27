import { useEffect, useMemo, useRef, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { searchCompanies, type SearchResult } from "../lib/search";

interface Props {
  onSelect: (code: string) => void;
}

export function SearchBar({ onSelect }: Props) {
  const { t, lang } = useLanguage();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const results = useMemo(() => searchCompanies(query), [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function choose(result: SearchResult) {
    onSelect(result.code);
    setQuery(result.company ? (lang === "ar" ? result.company.nameAr : result.company.nameEn) : result.code);
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!open || results.length === 0) {
      if (e.key === "ArrowDown") setOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(results[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <svg
          className="pointer-events-none absolute top-1/2 -translate-y-1/2 text-ink-300 rtl:right-4 ltr:left-4"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
        >
          <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8" />
          <path d="m20 20-3.2-3.2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          type="text"
          inputMode="search"
          autoComplete="off"
          placeholder={t.searchPlaceholder}
          aria-label={t.searchPlaceholder}
          aria-expanded={open}
          role="combobox"
          className="w-full rounded-2xl border border-ink-600 bg-ink-800/80 py-3.5 text-[15px] text-white placeholder:text-ink-300 shadow-inner shadow-black/20 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 rtl:pr-11 rtl:pl-4 ltr:pl-11 ltr:pr-4"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setOpen(false);
            }}
            className="absolute top-1/2 -translate-y-1/2 rounded-full p-1 text-ink-300 hover:bg-ink-700 hover:text-white rtl:left-3 ltr:right-3"
            aria-label={t.clear}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path d="M6 6l12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            </svg>
          </button>
        )}
      </div>
      <p className="mt-2 px-1 text-xs text-ink-300">{t.searchHint}</p>

      {open && query && (
        <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-ink-600 bg-ink-850 shadow-2xl shadow-black/50">
          {results.length === 0 ? (
            <p className="px-4 py-4 text-sm text-ink-300">{t.noResults}</p>
          ) : (
            <ul role="listbox" className="max-h-80 overflow-y-auto py-1.5">
              {results.map((r, i) => (
                <li key={r.isDirect ? `direct-${r.code}` : r.company!.code}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={i === activeIndex}
                    onMouseEnter={() => setActiveIndex(i)}
                    onClick={() => choose(r)}
                    className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-start transition ${
                      i === activeIndex ? "bg-brand-700/25" : "hover:bg-ink-800"
                    }`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-[15px] font-medium text-white">
                        {r.isDirect ? t.directCodeResult : lang === "ar" ? r.company!.nameAr : r.company!.nameEn}
                      </span>
                      <span className="block truncate text-xs text-ink-300">
                        {r.isDirect
                          ? t.directCodeSub
                          : lang === "ar"
                          ? r.company!.sectorAr
                          : r.company!.sectorEn}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-lg bg-ink-700 px-2 py-1 font-mono text-xs font-semibold text-brand-300">
                      {r.code}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
