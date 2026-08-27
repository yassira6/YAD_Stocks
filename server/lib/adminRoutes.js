import express from "express";
import { requireAdmin, listAllUsers, getUserById } from "./auth.js";
import { listAllAlerts } from "./alerts.js";
import { listCompanies } from "./companies.js";
import { isEmailConfigured, sendMail } from "./mailer.js";
import { isGoogleConfigured, isAppleConfigured } from "./oidcProviders.js";
import { recordAdminEmail, listAdminEmailsForUser } from "./adminEmails.js";
import { getPriceSourceName } from "./priceProvider.js";
import { isMarketOpen } from "./marketHours.js";

export const adminRouter = express.Router();
adminRouter.use(requireAdmin);

adminRouter.get("/status", (_req, res) => {
  res.json({
    smtpConfigured: isEmailConfigured(),
    googleConfigured: isGoogleConfigured(),
    appleConfigured: isAppleConfigured(),
    totalUsers: listAllUsers().length,
    totalAlerts: listAllAlerts().length,
    totalCompanies: listCompanies().length,
    priceSource: getPriceSourceName(),
    marketOpen: isMarketOpen(),
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
