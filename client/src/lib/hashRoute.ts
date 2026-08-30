export type View = "stock" | "alerts" | "signals" | "login" | "admin";

const VALID_VIEWS: View[] = ["stock", "alerts", "signals", "login", "admin"];

/** Parses "#/login?error=google_failed" into { view: "login", params }. */
export function parseHash(): { view: View; params: URLSearchParams } {
  const raw = window.location.hash.replace(/^#/, "");
  const [pathname = "", search = ""] = raw.split("?");
  const seg = pathname.replace(/^\//, "");
  const view = (VALID_VIEWS as string[]).includes(seg) ? (seg as View) : "stock";
  return { view, params: new URLSearchParams(search) };
}

export function navigateTo(view: View) {
  window.location.hash = view === "stock" ? "" : `/${view}`;
}
