import express from "express";
import { requireAdmin } from "./auth.js";
import { listAllUsers } from "./auth.js";
import { listAllAlerts } from "./alerts.js";
import { listCompanies } from "./companies.js";
import { isEmailConfigured } from "./mailer.js";
import { isGoogleConfigured, isAppleConfigured } from "./oidcProviders.js";

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
  });
});

adminRouter.get("/users", (_req, res) => {
  res.json(listAllUsers());
});

adminRouter.get("/alerts", (_req, res) => {
  res.json(listAllAlerts());
});
