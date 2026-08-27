import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";

interface VersionInfo {
  version: string;
  buildNumber: number;
  commit: string;
}

export function Footer() {
  const { t } = useLanguage();
  const [info, setInfo] = useState<VersionInfo | null>(null);

  useEffect(() => {
    fetch("/api/version")
      .then((res) => (res.ok ? res.json() : null))
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  return (
    <footer className="border-t border-ink-800 px-4 py-6 text-center text-xs text-ink-300 sm:px-6">
      <p>{t.footer}</p>
      {info && (
        <p className="mt-1 text-ink-300/70">
          {t.version} {info.version} · build {info.buildNumber} · {info.commit}
        </p>
      )}
    </footer>
  );
}
