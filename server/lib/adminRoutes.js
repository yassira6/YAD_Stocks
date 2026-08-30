import express from "express";
import { requireAdmin, listAllUsers, getUserById } from "./auth.js";
import { listAllAlerts } from "./alerts.js";
import { listCompanies, getCompany } from "./companies.js";
import { isEmailConfigured, sendMail } from "./mailer.js";
import { isGoogleConfigured, isAppleConfigured } from "./oidcProviders.js";
import { recordAdminEmail, listAdminEmailsForUser } from "./adminEmails.js";
import { getPriceSourceName } from "./priceProvider.js";
import { isMarketOpen } from "./marketHours.js";
import { isPushConfigured, sendPush } from "./pushNotifications.js";
import { countSignalSubscribers, listPushSubscriptionsForUser, removePushSubscription } from "./signalSubscriptions.js";
import { listActiveSignals } from "./companySignals.js";
import { scanForSignalsOnce } from "./signalScanner.js";
import { recordAdminPush, listAdminPushesForUser } from "./adminPushes.js";

export const adminRouter = express.Router();
adminRouter.use(requireAdmin);

adminRouter.get("/status", (_req, res) => {
  res.json({
    smtpConfigured: isEmailConfigured(),
    googleConfigured: isGoogleConfigured(),
    appleConfigured: isAppleConfigured(),
    pushConfigured: isPushConfigured(),
    totalUsers: listAllUsers().length,
    totalAlerts: listAllAlerts().length,
    totalCompanies: listCompanies().length,
    priceSource: getPriceSourceName(),
    marketOpen: isMarketOpen("TASI"),
    tasiMarketOpen: isMarketOpen("TASI"),
    usMarketOpen: isMarketOpen("US"),
    signalSubscribers: countSignalSubscribers(),
  });
});

adminRouter.get("/users", (_req, res) => {
  res.json(listAllUsers());
});

adminRouter.get("/alerts", (_req, res) => {
  res.json(listAllAlerts());
});

// Free-text email to a specific user — also the easiest way to confirm SMTP
// is actually configured correctly: send yourself one and check your inbox.
adminRouter.post("/users/:id/email", async (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) return res.status(404).json({ error: "User not found." });

  const subject = String(req.body?.subject || "").trim();
  const body = String(req.body?.body || "").trim();
  if (!subject || !body) {
    return res.status(400).json({ error: "subject and body are required." });
  }
  if (subject.length > 200 || body.length > 10_000) {
    return res.status(400).json({ error: "subject or body too long." });
  }

  const result = await sendMail({ to: target.email, subject, text: body });
  recordAdminEmail({
    userId: target.id,
    sentBy: req.user.email,
    subject,
    body,
    sent: result.sent,
    error: result.sent ? null : result.reason,
  });

  if (!result.sent) {
    return res.status(502).json({ error: result.reason || "Send failed.", sent: false });
  }
  res.json({ sent: true });
});

adminRouter.get("/users/:id/emails", (req, res) => {
  res.json(listAdminEmailsForUser(req.params.id));
});

// Free-text PUSH notification to a specific user — sent to every device
// they've registered (same push_subscriptions the Signals feature and
// per-alert push opt-in use). Mirrors the email endpoint above.
adminRouter.post("/users/:id/push", async (req, res) => {
  const target = getUserById(req.params.id);
  if (!target) return res.status(404).json({ error: "User not found." });

  const title = String(req.body?.title || "").trim();
  const body = String(req.body?.body || "").trim();
  if (!title || !body) {
    return res.status(400).json({ error: "title and body are required." });
  }
  if (title.length > 100 || body.length > 1000) {
    return res.status(400).json({ error: "title or body too long." });
  }
  if (!isPushConfigured()) {
    return res.status(400).json({ error: "push_not_configured", sent: false });
  }

  const subscriptions = listPushSubscriptionsForUser(target.id);
  if (subscriptions.length === 0) {
    const error = "User has no registered push subscriptions.";
    recordAdminPush({ userId: target.id, sentBy: req.user.email, title, body, sent: false, error });
    return res.status(400).json({ error, sent: false });
  }

  let anySent = false;
  let lastReason = null;
  for (const sub of subscriptions) {
    const result = await sendPush(sub, { title, body, url: "/" });
    if (result.expired) removePushSubscription(sub.endpoint);
    if (result.sent) anySent = true;
    else lastReason = result.reason;
  }

  recordAdminPush({
    userId: target.id,
    sentBy: req.user.email,
    title,
    body,
    sent: anySent,
    error: anySent ? null : lastReason,
  });

  if (!anySent) {
    return res.status(502).json({ error: lastReason || "Send failed.", sent: false });
  }
  res.json({ sent: true });
});

adminRouter.get("/users/:id/pushes", (req, res) => {
  res.json(listAdminPushesForUser(req.params.id));
});

// The analysis currently being fanned out to signal subscribers — every
// company the scanner most recently saw as strong_buy/strong_sell.
adminRouter.get("/signals", (_req, res) => {
  const signals = listActiveSignals().map((s) => {
    const company = getCompany(s.code);
    return {
      ...s,
      nameEn: company?.nameEn ?? null,
      nameAr: company?.nameAr ?? null,
    };
  });
  res.json(signals);
});

// Lets the admin trigger a scan on demand (e.g. right after setting SMTP/VAPID
// env vars) instead of waiting for the next SIGNAL_SCAN_INTERVAL_MS tick.
adminRouter.post("/signals/scan", async (_req, res) => {
  try {
    const result = await scanForSignalsOnce();
    res.json(result);
  } catch (err) {
    console.error("[admin] manual signal scan failed:", err);
    res.status(500).json({ error: "Scan failed." });
  }
});
