import nodemailer from "nodemailer";

const { SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER, SMTP_PASS, MAIL_FROM, APP_URL } = process.env;

let transporter = null;
if (SMTP_HOST && SMTP_USER && SMTP_PASS) {
  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: Number(SMTP_PORT) || 587,
    secure: SMTP_SECURE === "true",
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
} else {
  console.warn(
    "[mailer] SMTP_HOST/SMTP_USER/SMTP_PASS not set — alert emails will be logged, not sent. See README for setup."
  );
}

export const isEmailConfigured = () => transporter !== null;

/**
 * Low-level send, shared by the alert-trigger email and the admin free-text
 * email. Never throws — a delivery failure (or SMTP being unconfigured) is
 * reported back as { sent: false, reason } so the caller can record it,
 * rather than taking down whatever loop or request triggered the send.
 */
export async function sendMail({ to, subject, text }) {
  if (!transporter) {
    console.warn(`[mailer] (not sent, SMTP unconfigured) to=${to} subject="${subject}"`);
    return { sent: false, reason: "smtp_not_configured" };
  }
  try {
    await transporter.sendMail({ from: MAIL_FROM || SMTP_USER, to, subject, text });
    return { sent: true };
  } catch (err) {
    console.error(`[mailer] failed to send to ${to}:`, err.message);
    return { sent: false, reason: err.message };
  }
}

function alertEmailContent(alert, company, currentPrice) {
  const name = company ? (alert.lang === "ar" ? company.nameAr || company.nameEn : company.nameEn) : alert.code;
  const link = APP_URL ? `${APP_URL.replace(/\/$/, "")}/?code=${alert.code}` : null;

  if (alert.lang === "ar") {
    const directionAr = alert.direction === "buy" ? "الشراء" : "البيع";
    const subject = `MyShare — ${name} (${alert.code}) وصل إلى سعر ${directionAr} المستهدف`;
    const text = [
      `تنبيهك لـ ${name} (${alert.code}) تحقق.`,
      `هدفك: ${directionAr} عند ${alert.targetPrice.toFixed(2)} ر.س`,
      `السعر الحالي: ${currentPrice.toFixed(2)} ر.س`,
      link ? `افتح السهم في MyShare: ${link}` : null,
      "",
      "هذا تنبيه آلي مبني على تحليل فني تلقائي وليس نصيحة استثمارية. يُرجى التحقق من السعر الفعلي قبل اتخاذ أي قرار.",
    ]
      .filter(Boolean)
      .join("\n");
    return { subject, text };
  }

  const subject = `MyShare — ${name} (${alert.code}) hit your ${alert.direction} target`;
  const text = [
    `Your alert for ${name} (${alert.code}) has triggered.`,
    `Your target: ${alert.direction} at SAR ${alert.targetPrice.toFixed(2)}`,
    `Current price: SAR ${currentPrice.toFixed(2)}`,
    link ? `Open it in MyShare: ${link}` : null,
    "",
    "This is an automated alert based on rules-based technical analysis, not investment advice. Please verify the live price before acting.",
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, text };
}

/**
 * Sends the triggered-alert email. Never throws — a delivery failure is
 * logged and swallowed so it can't take down the alert-checking loop; the
 * alert stays marked "triggered" either way (see lib/alerts.js), since the
 * price condition itself did happen.
 */
export async function sendAlertEmail(alert, company, currentPrice) {
  const { subject, text } = alertEmailContent(alert, company, currentPrice);
  return sendMail({ to: alert.email, subject, text });
}
