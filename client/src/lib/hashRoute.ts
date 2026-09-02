export type View = "stock" | "watchlist" | "alerts" | "signals" | "login" | "admin";

const VALID_VIEWS: View[] = ["stock", "watchlist", "alerts", "signals", "login", "admin"];

/** Parses "#/login?error=google_failed" into { view: "login", params }. */
export function parseHash(): { view: View; params: URLSearchParams } {
  const raw = window.location.hash.replace(/^#/, "");
  const [pathname = "", search = ""] = raw.split("?");
  const seg = pathname.replace(/^\//, "");
  const view = (VALID_VIEWS as string[]).includes(seg) ? (seg as View) : "stock";
  return { view, params: new URLSearchParams(search) };
}

/** For view "stock", an optional `code` deep-links straight to that company (also what alert/signal notification emails link to). */
export function navigateTo(view: View, opts?: { code?: string }) {
  if (view === "stock") {
    window.location.hash = opts?.code ? `/?code=${encodeURIComponent(opts.code)}` : "";
    return;
  }
  window.location.hash = `/${view}`;
}
