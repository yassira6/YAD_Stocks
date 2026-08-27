import type { QuoteResponse } from "../types";

export async function fetchQuote(code: string): Promise<QuoteResponse> {
  const res = await fetch(`/api/quote/${encodeURIComponent(code)}`);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}
