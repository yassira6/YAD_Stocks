import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../lib/AuthContext";
import { useCompanies } from "../lib/CompaniesContext";
import { formatDateTime, formatPrice } from "../lib/format";
import { defaultCurrency, detectMarket } from "../lib/markets";
import { sendUserEmail } from "../lib/api";
import type { AdminStatus, PriceAlert, User } from "../types";

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

function SendEmailModal({ user, onClose }: { user: User; onClose: () => void }) {
  const { t } = useLanguage();
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<"sent" | "failed" | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function submit() {
    setSending(true);
    setResult(null);
    setErrorMsg(null);
    try {
      await sendUserEmail(user.id, { subject, body });
      setResult("sent");
    } catch (err) {
      setResult("failed");
      setErrorMsg(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/40 sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-ink-100">
          {t.adminSendEmail} — {user.name || user.email}
        </h3>
        <p className="mt-1 text-xs text-ink-300">{user.email}</p>

        <div className="mt-4 space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-300">{t.adminEmailSubject}</label>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              maxLength={200}
              className="w-full rounded-xl border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-ink-100 outline-none focus:border-brand-500"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-ink-300">{t.adminEmailBody}</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={10000}
              rows={6}
              className="w-full rounded-xl border border-ink-600 bg-ink-850 px-3 py-2 text-sm text-ink-100 outline-none focus:border-brand-500"
            />
          </div>
        </div>

        {result === "sent" && <p className="mt-3 text-sm font-semibold text-brand-300">{t.adminEmailSent}</p>}
        {result === "failed" && (
          <p className="mt-3 text-sm font-semibold text-bear">
            {t.adminEmailFailed} {errorMsg ? `(${errorMsg})` : ""}
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
            disabled={sending || !subject.trim() || !body.trim()}
            className="cursor-pointer rounded-full bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sending ? t.adminEmailSending : t.adminEmailSend}
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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [emailTarget, setEmailTarget] = useState<User | null>(null);

  useEffect(() => {
    if (authLoading || !user?.isAdmin) return;
    setLoading(true);
    Promise.all([
      fetch("/api/admin/status").then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch("/api/admin/users").then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
      fetch("/api/admin/alerts").then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status))))),
    ])
      .then(([s, u, a]) => {
        setStatus(s);
        setUsers(u);
        setAlerts(a);
        setError(null);
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)))
      .finally(() => setLoading(false));
  }, [authLoading, user]);

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
                    <button
                      type="button"
                      onClick={() => setEmailTarget(u)}
                      className="cursor-pointer rounded-full border border-ink-600 px-3 py-1 text-xs font-semibold text-ink-200 transition hover:border-brand-500 hover:text-brand-300"
                    >
                      {t.adminSendEmail}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {emailTarget && <SendEmailModal user={emailTarget} onClose={() => setEmailTarget(null)} />}

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
                  <td className="py-2.5 text-xs text-ink-300/80">{formatDateTime(a.createdAt, lang)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
