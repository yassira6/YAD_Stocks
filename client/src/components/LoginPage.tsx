import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { parseHash } from "../lib/hashRoute";

interface ProviderStatus {
  google: boolean;
  apple: boolean;
}

export function LoginPage() {
  const { t } = useLanguage();
  const [status, setStatus] = useState<ProviderStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/auth/status")
      .then((res) => (res.ok ? res.json() : null))
      .then(setStatus)
      .catch(() => setStatus(null));

    const { params } = parseHash();
    if (params.get("error")) setError(params.get("error"));
  }, []);

  return (
    <div className="mx-auto max-w-sm">
      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-6 text-center shadow-xl shadow-black/20 sm:p-8">
        <img src="/icon.svg" alt="" className="mx-auto h-14 w-14 rounded-2xl" />
        <h2 className="mt-4 text-xl font-bold text-white">{t.loginTitle}</h2>
        <p className="mt-1.5 text-sm text-ink-300">{t.loginSubtitle}</p>

        {error && (
          <p className="mt-4 rounded-xl bg-bear/10 px-3 py-2 text-sm text-bear">
            {error === "google_not_configured"
              ? t.googleUnavailable
              : error === "apple_not_configured"
              ? t.appleUnavailable
              : t.loginErrorGeneric}
          </p>
        )}

        <div className="mt-6 space-y-3">
          <a
            href="/auth/google"
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-ink-600 bg-white px-4 py-3 text-sm font-semibold text-ink-950 transition hover:bg-ink-100"
          >
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M23.52 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.47a5.53 5.53 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.57-5.17 3.57-8.82Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3c-1.08.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.26v3.11A12 12 0 0 0 12 24Z"
              />
              <path fill="#FBBC05" d="M5.27 14.28a7.2 7.2 0 0 1 0-4.56V6.61H1.26a12 12 0 0 0 0 10.78l4.01-3.11Z" />
              <path
                fill="#EA4335"
                d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.26 6.61l4.01 3.11C6.22 6.86 8.87 4.75 12 4.75Z"
              />
            </svg>
            {t.continueWithGoogle}
          </a>

          <a
            href="/auth/apple"
            className="flex w-full items-center justify-center gap-2.5 rounded-2xl border border-ink-600 bg-black px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink-950"
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="white">
              <path d="M16.365 1.43c0 1.14-.462 2.15-1.217 2.91-.83.84-2.19 1.48-3.29 1.39-.14-1.1.42-2.25 1.19-2.98.81-.79 2.23-1.38 3.32-1.32ZM20.6 17.13c-.53 1.22-.78 1.76-1.46 2.84-.95 1.5-2.29 3.37-3.95 3.39-1.47.02-1.85-.96-3.85-.95-2 .01-2.42.97-3.9.95-1.66-.02-2.93-1.71-3.88-3.2-2.66-4.17-2.94-9.06-1.3-11.67 1.17-1.87 3.02-2.97 4.75-2.97 1.77 0 2.88 1 4.34 1 1.42 0 2.28-1 4.34-1 1.54 0 3.17.84 4.33 2.29-3.8 2.09-3.18 7.53.58 9.32Z" />
            </svg>
            {t.continueWithApple}
          </a>
        </div>

        {status && !status.google && !status.apple && (
          <p className="mt-5 text-xs text-ink-300">{t.googleUnavailable}</p>
        )}
      </div>
    </div>
  );
}
