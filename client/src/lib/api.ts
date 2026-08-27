import type { AlertDirection, PriceAlert, QuoteResponse } from "../types";

async function unwrap<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed (${res.status})`);
  }
  return res.json();
}

export async function fetchQuote(code: string): Promise<QuoteResponse> {
  return unwrap(await fetch(`/api/quote/${encodeURIComponent(code)}`));
}

export async function createAlert(input: {
  code: string;
  email: string;
  direction: AlertDirection;
  targetPrice: number;
  lang: "en" | "ar";
}): Promise<PriceAlert> {
  return unwrap(
    await fetch("/api/alerts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function fetchAlertsByEmail(email: string): Promise<PriceAlert[]> {
  return unwrap(await fetch(`/api/alerts?email=${encodeURIComponent(email)}`));
}

export async function cancelAlert(id: string, email: string): Promise<void> {
  await unwrap(await fetch(`/api/alerts/${encodeURIComponent(id)}?email=${encodeURIComponent(email)}`, { method: "DELETE" }));
}
