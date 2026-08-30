import type { AlertDirection, CompanySignal, PriceAlert, QuoteResponse, SignalSubscription } from "../types";

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
  pushEnabled?: boolean;
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

export async function sendUserPush(userId: string, input: { title: string; body: string }): Promise<{ sent: boolean }> {
  return unwrap(
    await fetch(`/api/admin/users/${encodeURIComponent(userId)}/push`, {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

// --- Strong-buy/strong-sell signal subscriptions -----------------------------

export async function fetchVapidPublicKey(): Promise<{ publicKey: string | null; configured: boolean }> {
  return unwrap(await fetch("/api/push/vapid-public-key"));
}

export async function fetchSignalSubscription(): Promise<SignalSubscription> {
  return unwrap(await fetch("/api/signals/subscription", { credentials: "same-origin" }));
}

export async function updateSignalSubscription(input: {
  emailEnabled: boolean;
  pushEnabled: boolean;
  lang: "en" | "ar";
}): Promise<SignalSubscription> {
  return unwrap(
    await fetch("/api/signals/subscription", {
      method: "PUT",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    })
  );
}

export async function registerPushSubscription(subscription: PushSubscriptionJSON): Promise<void> {
  await unwrap(
    await fetch("/api/signals/push-subscribe", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(subscription),
    })
  );
}

export async function unregisterPushSubscription(endpoint: string): Promise<void> {
  await unwrap(
    await fetch("/api/signals/push-unsubscribe", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint }),
    })
  );
}

// --- Admin: signals -----------------------------------------------------------

export async function fetchActiveSignals(): Promise<CompanySignal[]> {
  return unwrap(await fetch("/api/admin/signals", { credentials: "same-origin" }));
}

export async function triggerSignalScan(): Promise<{ scanned: number; newSignals: number }> {
  return unwrap(await fetch("/api/admin/signals/scan", { method: "POST", credentials: "same-origin" }));
}
