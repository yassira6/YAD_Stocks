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

// Alerts are always tied to the signed-in session (credentials: "same-origin"
// sends the session cookie); the server derives the owner/email itself.

export async function createAlert(input: {
  code: string;
  direction: AlertDirection;
  targetPrice: number;
  lang: "en" | "ar";
}): Promise<PriceAlert> {
  return unwrap(
    await fetch("/api/alerts", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function fetchMyAlerts(): Promise<PriceAlert[]> {
  return unwrap(await fetch("/api/alerts", { credentials: "same-origin" }));
}

export async function cancelAlert(id: string): Promise<void> {
  await unwrap(await fetch(`/api/alerts/${encodeURIComponent(id)}`, { method: "DELETE", credentials: "same-origin" }));
}

export async function sendUserEmail(userId: string, input: { subject: string; body: string }): Promise<{ sent: boolean }> {
  return unwrap(
    await fetch(`/api/admin/users/${encodeURIComponent(userId)}/email`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}
