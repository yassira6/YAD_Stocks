import companies from "../data/companies.json";
import type { Company } from "../types";

const ALL_COMPANIES = companies as Company[];

// Normalize Arabic text so common alternate letter forms match each other
// (e.g. أ/إ/آ -> ا) and strip diacritics, so "الراجحي" matches "ﺍﻟﺮﺍﺟﺤﻲ"-style input too.
function normalize(str: string): string {
  return str
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

const CODE_RE = /^\d{2,5}$/;

export function searchCompanies(query: string, limit = 8): SearchResult[] {
  const raw = query.trim();
  if (!raw) return [];

  const q = normalize(raw);
  const results: SearchResult[] = [];

  for (const company of ALL_COMPANIES) {
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

  // If the query looks like a raw TASI code not present in our directory,
  // still offer a direct lookup so the app stays useful beyond the curated list.
  if (CODE_RE.test(raw) && !trimmed.some((r) => r.company?.code === raw)) {
    trimmed.push({ company: null, isDirect: true, code: raw });
  }

  return trimmed.slice(0, limit);
}
