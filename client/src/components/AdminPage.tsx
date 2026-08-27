import { useEffect, useState } from "react";
import { useLanguage } from "../i18n/LanguageContext";
import { useAuth } from "../lib/AuthContext";
import { useCompanies } from "../lib/CompaniesContext";
import { formatDateTime, formatPrice } from "../lib/format";
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

export function AdminPage() {
  const { t, lang } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { companies } = useCompanies();
  const [status, setStatus] = useState<AdminStatus | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [alerts, setAlerts] = useState<PriceAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <h2 className="text-xl font-bold text-white sm:text-2xl">{t.adminTitle}</h2>

      {loading && <p className="text-sm text-ink-300">{t.loading}</p>}
      {error && <p className="text-sm text-bear">{error}</p>}

      {status && (
        <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
          <h3 className="text-base font-semibold text-white">{t.adminStatusTitle}</h3>
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            <div className="rounded-2xl border border-ink-700 bg-ink-850 py-3">
              <p className="text-2xl font-bold text-white">{status.totalUsers}</p>
              <p className="text-xs text-ink-300">{t.totalUsers}</p>
            </div>
            <div className="rounded-2xl border border-ink-700 bg-ink-850 py-3">
              <p className="text-2xl font-bold text-white">{status.totalAlerts}</p>
              <p className="text-xs text-ink-300">{t.totalAlerts}</p>
            </div>
            <div className="rounded-2xl border border-ink-700 bg-ink-850 py-3">
              <p className="text-2xl font-bold text-white">{status.totalCompanies || companies.length}</p>
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
        </div>
      )}

      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
        <h3 className="text-base font-semibold text-white">{t.adminUsersTitle}</h3>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-3xl border border-ink-700 bg-ink-900 p-5 shadow-xl shadow-black/20 sm:p-6">
        <h3 className="text-base font-semibold text-white">{t.adminAlertsTitle}</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[560px] text-start text-sm">
            <tbody className="divide-y divide-ink-800">
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td className="py-2.5 pe-3 font-mono text-xs text-brand-300">{a.code}</td>
                  <td className="py-2.5 pe-3 text-ink-300">{a.userEmail || a.email}</td>
                  <td className="py-2.5 pe-3 text-ink-100">
                    {a.direction} @ {formatPrice(a.targetPrice, lang, "SAR")}
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
