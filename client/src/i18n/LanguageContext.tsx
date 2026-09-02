import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { translations, type Dictionary, type Lang } from "./translations";

interface LanguageContextValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  toggleLang: () => void;
  t: Dictionary;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = "myshare-lang";

/** Falls back to Arabic if the browser doesn't clearly prefer English or Arabic. */
function detectBrowserLang(): Lang {
  try {
    const candidates = navigator.languages?.length ? navigator.languages : [navigator.language];
    for (const l of candidates) {
      const primary = l?.toLowerCase().split("-")[0];
      if (primary === "en") return "en";
      if (primary === "ar") return "ar";
    }
  } catch {
    // ignore (e.g. navigator unavailable)
  }
  return "ar";
}

function detectInitialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "ar") return stored;
  } catch {
    // ignore storage access issues (private browsing, etc.)
  }
  // No explicit choice saved yet — follow the device/browser locale. Once the
  // user toggles the language (persisted above), that choice always wins.
  return detectBrowserLang();
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(detectInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      // ignore
    }
  }, [lang]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      toggleLang: () => setLang((l) => (l === "en" ? "ar" : "en")),
      t: translations[lang],
    }),
    [lang]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
