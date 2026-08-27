import type { Lang } from "../i18n/translations";

const localeOf = (lang: Lang) => (lang === "ar" ? "ar-SA" : "en-US");

export function formatPrice(value: number | null | undefined, lang: Lang, currency = "SAR") {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(localeOf(lang), {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number | null | undefined, lang: Lang, digits = 2) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(localeOf(lang), {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  }).format(value);
}

export function formatCompactNumber(value: number | null | undefined, lang: Lang) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(localeOf(lang), { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function formatPercent(value: number | null | undefined, lang: Lang) {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat(localeOf(lang), {
    style: "percent",
    maximumFractionDigits: 2,
    signDisplay: "always",
  }).format(value);
}

export function formatDateTime(ms: number, lang: Lang) {
  return new Intl.DateTimeFormat(localeOf(lang), {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(ms));
}

export function formatDate(dateStr: string, lang: Lang) {
  return new Intl.DateTimeFormat(localeOf(lang), { dateStyle: "medium" }).format(new Date(dateStr));
}
