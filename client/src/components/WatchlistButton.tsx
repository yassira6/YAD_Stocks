import { useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useWatchlist } from "../lib/WatchlistContext";

const PlusIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
  </svg>
);

const CheckIcon = ({ size = 14 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
    <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface Props {
  code: string;
  /** "icon": small circular +/✓ button (search result rows). "pill": bigger button with a text label (stock page header). */
  variant?: "icon" | "pill";
  /** Stops the click from bubbling to a parent onClick (e.g. a search-result row that also selects the company). */
  stopPropagation?: boolean;
}

export function WatchlistButton({ code, variant = "icon", stopPropagation }: Props) {
  const { t } = useLanguage();
  const { codes, add, remove } = useWatchlist();
  const [busy, setBusy] = useState(false);
  const inWatchlist = codes.has(code);

  async function onClick(e: React.MouseEvent) {
    if (stopPropagation) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (busy) return;
    setBusy(true);
    try {
      if (inWatchlist) await remove(code);
      else await add(code);
    } catch {
      // best-effort — the button just reflects context state, which stays unchanged on failure
    } finally {
      setBusy(false);
    }
  }

  if (variant === "pill") {
    return (
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
          inWatchlist
            ? "border border-brand-500 bg-brand-500/15 text-brand-300"
            : "border border-ink-600 text-ink-200 hover:border-brand-500 hover:text-brand-300"
        }`}
      >
        {inWatchlist ? <CheckIcon size={13} /> : <PlusIcon size={13} />}
        {inWatchlist ? t.watchlistInList : t.watchlistAdd}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      aria-label={inWatchlist ? t.watchlistRemove : t.watchlistAdd}
      title={inWatchlist ? t.watchlistRemove : t.watchlistAdd}
      className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition disabled:opacity-50 ${
        inWatchlist
          ? "border-brand-500 bg-brand-500/15 text-brand-300"
          : "border-ink-600 text-ink-300 hover:border-brand-500 hover:text-brand-300"
      }`}
    >
      {inWatchlist ? <CheckIcon /> : <PlusIcon />}
    </button>
  );
}
