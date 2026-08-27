import type { Company } from "../types";

// Normalize Arabic text so common alternate letter forms match each other
// (e.g. أ/إ/آ -> ا) and strip diacritics, so "الراجحي" matches "ﺍﻟﺮﺍﺟﺤﻲ"-style input too.
function normalize(str: string | null | undefined): string {
  return (str || "")
    .toLowerCase()
    .replace(/[ً-ْ]/g, "") // Arabic diacritics
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .trim();
}

export interface SearchResult {
  company: Company | null;
  isDirect: boolean;
  code: string;
}

const TASI_CODE_RE = /^\d{2,5}$/;
const US_CODE_RE = /^[A-Za-z]{1,5}(\.[A-Za-z]{1,2})?$/;

export function searchCompanies(query: string, companies: Company[], limit = 8): SearchResult[] {
  const raw = query.trim();
  if (!raw) return [];

  const q = normalize(raw);
  const results: SearchResult[] = [];

  for (const company of companies) {
    const nameEn = normalize(company.nameEn);
    const nameAr = normalize(company.nameAr);
    const codeMatch = company.code.startsWith(raw);
    const nameMatch = nameEn.includes(q) || nameAr.includes(q);
    if (codeMatch || nameMatch) {
      results.push({ company, isDirect: false, code: company.code });
    }
    if (results.length >= limit * 3) break;
  }

  // Rank: exact code match first, then "starts with", then substring
  results.sort((a, b) => {
    const score = (r: SearchResult) => {
      if (!r.company) return 0;
      if (r.company.code === raw) return 100;
      if (r.company.code.startsWith(raw)) return 80;
      const nameEn = normalize(r.company.nameEn);
      const nameAr = normalize(r.company.nameAr);
      if (nameEn.startsWith(q) || nameAr.startsWith(q)) return 60;
      return 10;
    };
    return score(b) - score(a);
  });

  const trimmed = results.slice(0, limit);
  const upper = raw.toUpperCase();

  // If the query looks like a raw TASI code not present in our directory,
  // still offer a direct lookup so the app stays useful beyond the curated list.
  // Numeric codes are unambiguous, so this is offered even alongside other
  // matches (e.g. "22" prefix-matches "2222" but "22" itself might also be
  // a different real code not in our directory).
  if (TASI_CODE_RE.test(raw) && !trimmed.some((r) => r.company?.code === raw)) {
    trimmed.push({ company: null, isDirect: true, code: raw });
  } else if (
    // A bare 1-5 letter query is ambiguous — it could be a ticker (AAPL) or
    // the start of a company name (e.g. "apple") that already matched above.
    // Only offer the literal-ticker guess when nothing else matched, so
    // typing "apple" shows the real "Apple Inc. (AAPL)" result instead of
    // also suggesting a bogus direct lookup for "APPLE".
    trimmed.length === 0 &&
    US_CODE_RE.test(raw) &&
    !trimmed.some((r) => r.company?.code === upper)
  ) {
    trimmed.push({ company: null, isDirect: true, code: upper });
  }

  return trimmed.slice(0, limit);
}
