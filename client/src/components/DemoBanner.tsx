import { useLanguage } from "../i18n/LanguageContext";

export function DemoBanner() {
  const { t } = useLanguage();
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gold-500/40 bg-gold-500/10 p-4 text-gold-200">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="mt-0.5 shrink-0">
        <path
          d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <div>
        <p className="text-sm font-semibold">{t.demoBannerTitle}</p>
        <p className="mt-0.5 text-sm leading-relaxed text-gold-200/90">{t.demoBannerBody}</p>
      </div>
    </div>
  );
}
