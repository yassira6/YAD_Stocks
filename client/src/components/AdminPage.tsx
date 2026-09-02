import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../lib/AuthContext";
import { useCompanies } from "../lib/CompaniesContext";
import { formatDateTime, formatPrice } from "../lib/format";
import { defaultCurrency, detectMarket } from "../lib/markets";
import { sendUserEmail, sendUserPush, fetchActiveSignals, triggerSignalScan, fetchAdminUserDetail } from "../lib/api";
import type { AdminStatus, AdminUserDetail, CompanySignal, PriceAlert, User } from "../types";

function StatusPill({ ok, yes, no }: { ok: boolean; yes: string; no: string }) {
  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
        ok ? "bg-brand-500/15 text-brand-300" : "bg-ink-700 text-ink-300"
      }`}
    >
      {ok ? yes : no}
    </span>
  );
}

function SendMessageModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { t } = useLanguage();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [emailChecked, setEmailChecked] = useState(true);
  const [pushChecked, setPushChecked] = useState(false);
  const [sending, setSending] = useState(false);
  const [emailResult, setEmailResult] = useState<"sent" | "failed" | null>(null);
  const [emailErrorMsg, setEmailErrorMsg] = useState<string | null>(null);
  const [pushResult, setPushResult] = useState<"sent" | "failed" | null>(null);
  const [pushErrorMsg, setPushErrorMsg] = useState<string | null>(null);

  async function submit() {
    if (!emailChecked && !pushChecked) return;
    setSending(true);
    setEmailResult(null);
    setEmailErrorMsg(null);
    setPushResult(null);
    setPushErrorMsg(null);

    if (emailChecked) {
      try {
        await sendUserEmail(user.id, { subject, body });
        setEmailResult("sent");
      } catch (err) {
        setEmailResult("failed");
        setEmailErrorMsg(err instanceof Error ? err.message : String(err));
      }
    }
    if (pushChecked) {
      try {
        await sendUserPush(user.id, { title: subject, body });
        setPushResult("sent");
      } catch (err) {
        setPushResult("failed");
        setPushErrorMsg(err instanceof Error ? err.message : String(err));
      }
    }
    setSending(false);
  }

  const bodyMaxLength = pushChecked ? 1000 : 10000;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/40 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-ink-100">
          {t.adminSendMessage} — {user.name || user.email}
        </h3>
        <p className="mt-1 text-xs text-ink-300">{user.email}</p>

        <div className="mt-4 flex gap-4">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-100">
            <input
              type="checkbox"
              checked={emailChecked}
              onChange={(e) => setEmailChecked(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-brand-600"
            />
            {t.adminChannelEmail}
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink-100">
            <input
              type="checkbox"
              checked={pushChecked}
              onChange={(e) => setPushChecked(e.target.checked)}
              className="h-4 w-4 cursor-pointer accent-brand-600"
            />
            {t.adminChannelPush}
          </label>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-300">{t.adminEmailSubject}</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={pushChecked ? 100 : 200}
              className="w-full rounded-xl border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-ink-100 outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-300">{t.adminEmailBody}</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={bodyMaxLength}
              rows={6}
              className="w-full rounded-xl border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-ink-100 outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {!emailChecked && !pushChecked && <p className="mt-3 text-sm font-medium text-bear">{t.adminNoChannelSelected}</p>}
        {emailResult === "sent" && <p className="mt-3 text-sm font-semibold text-brand-300">{t.adminChannelEmail}: {t.adminEmailSent}</p>}
        {emailResult === "failed" && (
          <p className="mt-3 text-sm font-semibold text-bear">
            {t.adminChannelEmail}: {t.adminEmailFailed} {emailErrorMsg ? `(${emailErrorMsg})` : ""}
          </p>
        )}
        {pushResult === "sent" && <p className="mt-1 text-sm font-semibold text-brand-300">{t.adminChannelPush}: {t.adminEmailSent}</p>}
        {pushResult === "failed" && (
          <p className="mt-1 text-sm font-semibold text-bear">
            {t.adminChannelPush}: {t.adminEmailFailed} {pushErrorMsg ? `(${pushErrorMsg})` : ""}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full border border-ink-600 px-4 py-2 text-sm font-semibold text-ink-200 transition hover:border-ink-500"
          >
            {t.cancel}
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={sending || !subject.trim() || !body.trim() || (!emailChecked && !pushChecked)}
            className="cursor-pointer rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? t.adminEmailSending : t.adminEmailSend}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserDetailModal({ userId, alerts, onClose }: { userId: string; alerts: PriceAlert[]; onClose: () => void }) {
  const { t, lang } = useLanguage();
  const [detail, setDetail] = useState<AdminUserDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchAdminUserDetail(userId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const userAlerts = detail ? alerts.filter((a) => a.userEmail === detail.email) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/40 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {loading && <p className="text-sm text-ink-300">{t.loading}</p>}
        {error && <p className="text-sm text-bear">{error}</p>}

        {detail && (
          <>
            <div className="flex items-center gap-3">
              {detail.picture ? (
                <img src={detail.picture} alt="" className="h-10 w-10 rounded-full" referrerPolicy="no-referrer" />
              ) : (
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-ink-700 text-sm font-bold text-ink-200">
                  {(detail.name || detail.email)[0]?.toUpperCase()}
                </span>
              )}
              <div className="min-w-0">
                <h3 className="truncate text-base font-semibold text-ink-100">{detail.name || "—"}</h3>
                <p className="truncate text-xs text-ink-300">{detail.email}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 text-xs text-ink-300">
              <span className="rounded-full bg-ink-700 px-2.5 py-1 font-semibold text-ink-200">{detail.provider}</span>
              {detail.isAdmin && (
                <span className="rounded-full bg-gold-500/15 px-2.5 py-1 font-semibold text-gold-400">{t.navAdmin}</span>
              )}
              <span>
                {t.adminJoined}: {formatDateTime(detail.createdAt, lang)}
              </span>
              <span>
                {t.adminLastLogin}: {formatDateTime(detail.lastLoginAt, lang)}
              </span>
            </div>

            <div className="mt-5">
              <h4 className="text-sm font-semibold text-ink-100">{t.adminUserSignalPrefs}</h4>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <StatusPill ok={detail.signalSubscription.emailEnabled} yes={`${t.adminChannelEmail}: ${t.enabledLabel}`} no={`${t.adminChannelEmail}: ${t.disabledLabel}`} />
                <StatusPill ok={detail.signalSubscription.pushEnabled} yes={`${t.adminChannelPush}: ${t.enabledLabel}`} no={`${t.adminChannelPush}: ${t.disabledLabel}`} />
                <span className="rounded-full bg-ink-700 px-2.5 py-1 font-semibold text-ink-200">
                  {t.signalsScopeLabel}: {detail.signalSubscription.scope === "watchlist" ? t.signalsScopeWatchlist : t.signalsScopeAll}
                </span>
                <StatusPill ok={detail.hasPushRegistration} yes={t.adminHasPushDevice} no={t.adminNoPushDevice} />
              </div>
            </div>

            <div className="mt-5">
              <h4 className="text-sm font-semibold text-ink-100">
                {t.watchlistTitle} ({detail.watchlist.length})
              </h4>
              {detail.watchlist.length === 0 ? (
                <p className="mt-2 text-xs text-ink-300">{t.watchlistEmpty}</p>
              ) : (
                <ul className="mt-2 divide-y divide-ink-800">
                  {detail.watchlist.map((w) => (
                    <li key={w.code} className="flex items-center justify-between gap-2 py-2 text-sm">
                      <span className="min-w-0 truncate text-ink-100">
                        {lang === "ar" ? w.nameAr || w.nameEn || w.code : w.nameEn || w.code}{" "}
                        <span className="font-mono text-xs text-brand-300">({w.code})</span>
                      </span>
                      {w.alertsEnabled && (
                        <span className="shrink-0 rounded-full bg-brand-500/15 px-2 py-0.5 text-[11px] font-semibold text-brand-300">
                          {t.watchlistAlertsLabel}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="mt-5">
              <h4 className="text-sm font-semibold text-ink-100">
                {t.adminAlertsTitle} ({userAlerts.length})
              </h4>
              {userAlerts.length === 0 ? (
                <p className="mt-2 text-xs text-ink-300">{t.alertsEmpty}</p>
              ) : (
                <ul className="mt-2 divide-y divide-ink-800">
                  {userAlerts.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2 py-2 text-sm text-ink-100">
                      <span className="font-mono text-xs text-brand-300">{a.code}</span>
                      <span>
                        {a.direction} @ {formatPrice(a.targetPrice, lang, defaultCurrency(detectMarket(a.code)))}
                      </span>
                      <span className="text-xs text-ink-300">{a.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="cursor-pointer rounded-full border border-ink-600 px-4 py-2 text-sm font-semibold text-ink-200 transition hover:border-ink-500"
          >
            {t.cancel}
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminPage() {
  const { t, lang } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { companies } = useCompanies();
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [signals, setSignals] = useState<CompanySignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailTarget, setEmailTarget] = useState<User | null>(null);
  const [viewTargetId, setViewTargetId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ scanned: number; newSignals: number } | null>(null);

  function reloadSignals() {
    fetchActiveSignals()
      .then(setSignals)
      .catch(() => {});
  }

  useEffect(() => {
    if (authLoading || !user?.isAdmin) return;
    setLoading(true);
    Promise.all([
      fetch("/api/admin/status").then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch("/api/admin/users").then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch("/api/admin/alerts").then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetchActiveSignals(),
    ])
      .then(([s, u, a, sig]) => {
        setStatus(s);
        setUsers(u);
        setAlerts(a);
        setSignals(sig);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [authLoading, user]);

  async function onScanNow() {
    setScanning(true);
    setScanResult(null);
    try {
      const result = await triggerSignalScan();
      setScanResult(result);
      reloadSignals();
    } catch {
      // best-effort — the periodic scan will still run on its own schedule
    } finally {
      setScanning(false);
    }
  }

  if (authLoading) return null;

  if (!user?.isAdmin) {
    return (
      <div className="mx-auto max-w-lg rounded-3xl border border-bear/30 bg-bear/10 p-6 text-center text-sm text-bear">
        {t.errorTitle}
      </div>
    );
  }

  const alertCountByEmail = alerts.reduce<Record<string, number>>((acc, a) => {
    if (a.userEmail) acc[a.userEmail] = (acc[a.userEmail] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <h2 className="text-xl font-bold text-ink-100 sm:text-2xl">{t.adminTitle}</h2>

      {loading && <p className="text-sm text-ink-300">{t.loading}</p>}
      {error && <p className="text-sm text-bear">{error}</p>}

      {status && (
        <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
          <h3 className="text-base font-semibold text-ink-100">{t.adminStatusTitle}</h3>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl border border-ink-700 bg-ink-850 py-3">
              <p className="text-2xl font-bold text-ink-100">{status.totalUsers}</p>
              <p className="text-xs text-ink-300">{t.totalUsers}</p>
            </div>
            <div className="rounded-2xl border border-ink-700 bg-ink-850 py-3">
              <p className="text-2xl font-bold text-ink-100">{status.totalAlerts}</p>
              <p className="text-xs text-ink-300">{t.totalAlerts}</p>
            </div>
            <div className="rounded-2xl border border-ink-700 bg-ink-850 py-3">
              <p className="text-2xl font-bold text-ink-100">{status.totalCompanies || companies.length}</p>
              <p className="text-xs text-ink-300">{t.totalCompanies}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-xs text-ink-300">{t.adminEmailConfigured}:</span>
            <StatusPill ok={status.smtpConfigured} yes={t.configuredYes} no={t.configuredNo} />
            <span className="ms-3 text-xs text-ink-300">{t.adminGoogleConfigured}:</span>
            <StatusPill ok={status.googleConfigured} yes={t.configuredYes} no={t.configuredNo} />
            <span className="ms-3 text-xs text-ink-300">{t.adminAppleConfigured}:</span>
            <StatusPill ok={status.appleConfigured} yes={t.configuredYes} no={t.configuredNo} />
            <span className="ms-3 text-xs text-ink-300">{t.adminPushConfigured}:</span>
            <StatusPill ok={status.pushConfigured} yes={t.configuredYes} no={t.configuredNo} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-ink-300">{t.adminPriceSource}:</span>
            <span className="rounded-full bg-ink-700 px-2.5 py-1 text-xs font-semibold text-ink-200">
              {status.priceSource}
            </span>
            <span className="ms-3 text-xs text-ink-300">{t.adminMarketStatus} (TASI):</span>
            <StatusPill ok={status.tasiMarketOpen} yes={t.marketOpenLabel} no={t.marketClosedLabel} />
            <span className="ms-3 text-xs text-ink-300">{t.adminMarketStatus} (US):</span>
            <StatusPill ok={status.usMarketOpen} yes={t.marketOpenLabel} no={t.marketClosedLabel} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="text-xs text-ink-300">{t.adminSignalSubscribersTitle}:</span>
            <span className="rounded-full bg-ink-700 px-2.5 py-1 text-xs font-semibold text-ink-200">
              {t.adminSignalEmailSubscribers} {status.signalSubscribers.email}
            </span>
            <span className="rounded-full bg-ink-700 px-2.5 py-1 text-xs font-semibold text-ink-200">
              {t.adminSignalPushSubscribers} {status.signalSubscribers.push}
            </span>
          </div>
        </div>
      )}

      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
        <h3 className="text-base font-semibold text-ink-100">{t.adminUsersTitle}</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[480px] text-start text-sm">
            <tbody className="divide-y divide-ink-800">
              {users.map((u) => (
                <tr key={u.id}>
                  <td className="py-2.5 pe-3">
                    <div className="flex items-center gap-2">
                      {u.picture ? (
                        <img src={u.picture} alt="" className="h-6 w-6 rounded-full" referrerPolicy="no-referrer" />
                      ) : (
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-700 text-[10px] font-bold text-ink-200">
                          {(u.name || u.email)[0]?.toUpperCase()}
                        </span>
                      )}
                      <span className="text-ink-100">{u.name || "—"}</span>
                    </div>
                  </td>
                  <td className="py-2.5 pe-3 text-ink-300">{u.email}</td>
                  <td className="py-2.5 pe-3 text-ink-300">{u.provider}</td>
                  <td className="py-2.5 pe-3 text-ink-300">{alertCountByEmail[u.email] || 0}</td>
                  <td className="py-2.5 pe-3">
                    {u.isAdmin && (
                      <span className="rounded-full bg-gold-500/15 px-2 py-0.5 text-xs font-semibold text-gold-400">
                        {t.navAdmin}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-xs text-ink-300/80">{formatDateTime(u.lastLoginAt, lang)}</td>
                  <td className="py-2.5 ps-3">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewTargetId(u.id)}
                        className="cursor-pointer rounded-full border border-ink-600 px-3 py-1 text-xs font-semibold text-ink-200 transition hover:border-brand-500 hover:text-brand-300"
                      >
                        {t.adminViewUser}
                      </button>
                      <button
                        type="button"
                        onClick={() => setEmailTarget(u)}
                        className="cursor-pointer rounded-full border border-ink-600 px-3 py-1 text-xs font-semibold text-ink-200 transition hover:border-brand-500 hover:text-brand-300"
                      >
                        {t.adminSendMessage}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {emailTarget && <SendMessageModal user={emailTarget} onClose={() => setEmailTarget(null)} />}
      {viewTargetId && <UserDetailModal userId={viewTargetId} alerts={alerts} onClose={() => setViewTargetId(null)} />}

      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
        <h3 className="text-base font-semibold text-ink-100">{t.adminAlertsTitle}</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-start text-sm">
            <tbody className="divide-y divide-ink-800">
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td className="py-2.5 pe-3 font-mono text-xs text-brand-300">{a.code}</td>
                  <td className="py-2.5 pe-3 text-ink-300">{a.userEmail || a.email}</td>
                  <td className="py-2.5 pe-3 text-ink-100">
                    {a.direction} @ {formatPrice(a.targetPrice, lang, defaultCurrency(detectMarket(a.code)))}
                  </td>
                  <td className="py-2.5 pe-3 text-ink-300">{a.status}</td>
                  <td className="py-2.5 pe-3">
                    {a.emailSent === null ? (
                      <span className="text-xs text-ink-300">{t.emailSentPending}</span>
                    ) : a.emailSent ? (
                      <span className="text-xs font-semibold text-brand-300">{t.emailSentYes}</span>
                    ) : (
                      <span className="text-xs font-semibold text-bear" title={a.emailError || ""}>
                        {t.emailSentNo}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 pe-3">
                    {!a.pushEnabled ? (
                      <span className="text-xs text-ink-300/60">—</span>
                    ) : a.pushSent === null ? (
                      <span className="text-xs text-ink-300">{t.emailSentPending}</span>
                    ) : a.pushSent ? (
                      <span className="text-xs font-semibold text-brand-300">{t.emailSentYes}</span>
                    ) : (
                      <span className="text-xs font-semibold text-bear" title={a.pushError || ""}>
                        {t.emailSentNo}
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 text-xs text-ink-300/80">{formatDateTime(a.createdAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-base font-semibold text-ink-100">{t.adminActiveSignalsTitle}</h3>
          <button
            type="button"
            onClick={onScanNow}
            disabled={scanning}
            className="cursor-pointer rounded-full border border-ink-600 px-3 py-1.5 text-xs font-medium text-ink-200 transition hover:border-brand-500 hover:text-brand-300 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {scanning ? t.adminScanning : t.adminScanNow}
          </button>
        </div>

        {scanResult && (
          <p className="mt-2 text-xs text-ink-300">
            {t.adminScanScannedLabel}: {scanResult.scanned} · {t.adminScanNewSignalsLabel}: {scanResult.newSignals}
          </p>
        )}

        {signals.length === 0 ? (
          <p className="mt-4 text-sm text-ink-300">{t.adminActiveSignalsEmpty}</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[480px] text-start text-sm">
              <tbody className="divide-y divide-ink-800">
                {signals.map((s) => (
                  <tr key={s.code}>
                    <td className="py-2.5 pe-3 font-mono text-xs text-brand-300">{s.code}</td>
                    <td className="py-2.5 pe-3 text-ink-100">
                      {lang === "ar" ? s.nameAr || s.nameEn || s.code : s.nameEn || s.code}
                    </td>
                    <td className="py-2.5 pe-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                          s.lastVerdict === "strong_buy" ? "bg-bull/10 text-bull" : "bg-bear/10 text-bear"
                        }`}
                      >
                        {s.lastVerdict === "strong_buy" ? t.signalVerdictBuy : t.signalVerdictSell}
                      </span>
                    </td>
                    <td className="py-2.5 pe-3 text-ink-300">{s.lastScore}</td>
                    <td className="py-2.5 text-xs text-ink-300/80">
                      {s.lastNotifiedAt ? formatDateTime(s.lastNotifiedAt, lang) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
