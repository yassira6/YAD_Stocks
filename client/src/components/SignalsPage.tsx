import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../lib/AuthContext";
import { LoginPage } from "./LoginPage";
import { Toggle } from "./Toggle";
import {
  fetchSignalSubscription,
  fetchVapidPublicKey,
  registerPushSubscription,
  unregisterPushSubscription,
  updateSignalSubscription,
} from "../lib/api";
import { getPushBlockedReason, subscribeToPush, unsubscribeFromPush } from "../lib/push";
import type { SignalSubscription } from "../types";

export function SignalsPage() {
  const { t, lang } = useLanguage();
  const { user, loading: authLoading } = useAuth();

  const [sub, setSub] = useState<SignalSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<"ok" | "error" | null>(null);
  const [vapidKey, setVapidKey] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    Promise.all([fetchSignalSubscription(), fetchVapidPublicKey()])
      .then(([subscription, vapid]) => {
        setSub(subscription);
        setVapidKey(vapid.publicKey);
      })
      .catch(() => setSub({ emailEnabled: false, pushEnabled: false, lang, hasPushRegistration: false, pushConfigured: false }))
      .finally(() => setLoading(false));
  }, [user, lang]);

  async function save(next: Partial<SignalSubscription>) {
    if (!sub) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const merged = { ...sub, ...next };
      const updated = await updateSignalSubscription({
        emailEnabled: merged.emailEnabled,
        pushEnabled: merged.pushEnabled,
        lang,
      });
      setSub(updated);
      setSaveResult("ok");
    } catch {
      setSaveResult("error");
    } finally {
      setSaving(false);
    }
  }

  async function onToggleEmail() {
    if (!sub) return;
    await save({ emailEnabled: !sub.emailEnabled });
  }

  async function onTogglePush() {
    if (!sub) return;
    const turningOn = !sub.pushEnabled;

    if (turningOn) {
      if (!vapidKey) {
        setSaveResult("error");
        return;
      }
      try {
        const subscription = await subscribeToPush(vapidKey);
        await registerPushSubscription(subscription);
        await save({ pushEnabled: true });
        setSub((s) => (s ? { ...s, hasPushRegistration: true } : s));
      } catch {
        setSaveResult("error");
      }
    } else {
      try {
        const endpoint = await unsubscribeFromPush();
        if (endpoint) await unregisterPushSubscription(endpoint);
      } catch {
        // best-effort — still turn the preference off server-side below
      }
      await save({ pushEnabled: false });
    }
  }

  if (authLoading) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-sm space-y-4 text-center">
        <p className="text-sm text-ink-300">{t.signalsLoginRequired}</p>
        <LoginPage />
      </div>
    );
  }

  const pushBlockedReason = getPushBlockedReason();

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-bold text-ink-100 sm:text-2xl">{t.signalsTitle}</h2>
        <p className="mt-1 text-sm text-ink-300">{t.signalsSubtitle}</p>
      </div>

      <div className="space-y-4 rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
        {loading || !sub ? (
          <p className="text-sm text-ink-300">{t.loading}</p>
        ) : (
          <>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink-100">{t.signalsEmailToggleLabel}</p>
                <p className="mt-0.5 text-xs text-ink-300">{t.signalsEmailToggleHint}</p>
              </div>
              <Toggle checked={sub.emailEnabled} onChange={onToggleEmail} disabled={saving} />
            </div>

            <div className="h-px bg-ink-800" />

            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold text-ink-100">{t.signalsPushToggleLabel}</p>
                <p className="mt-0.5 text-xs text-ink-300">
                  {pushBlockedReason === "ios_not_installed"
                    ? t.signalsPushIosHint
                    : pushBlockedReason === "unsupported"
                    ? t.signalsPushUnsupported
                    : !sub.pushConfigured
                    ? t.signalsPushNotConfigured
                    : t.signalsPushToggleHint}
                </p>
              </div>
              <Toggle checked={sub.pushEnabled} onChange={onTogglePush} disabled={saving || !!pushBlockedReason || !sub.pushConfigured} />
            </div>

            {saving && <p className="text-xs text-ink-300">{t.signalsSaving}</p>}
            {!saving && saveResult === "ok" && <p className="text-xs font-medium text-brand-300">{t.signalsSaved}</p>}
            {!saving && saveResult === "error" && <p className="text-xs font-medium text-bear">{t.signalsSaveFailed}</p>}
          </>
        )}
      </div>

      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
        <h3 className="text-sm font-semibold text-ink-100">{t.signalsHowItWorksTitle}</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-300">{t.signalsHowItWorksBody}</p>
        <p className="mt-3 text-xs text-ink-400">{t.signalsDisclaimer}</p>
      </div>
    </div>
  );
}
