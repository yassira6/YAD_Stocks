import nodemailer from "nodemailer";
import { detectMarket } from "./markets.js";

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
  const market = detectMarket(alert.code);
  const currencyAr = market === "US" ? "$" : "ر.س";
  const currencyEn = market === "US" ? "USD" : "SAR";

  if (alert.lang === "ar") {
    const directionAr = alert.direction === "buy" ? "الشراء" : "البيع";
    const subject = `MyShare — ${name} (${alert.code}) وصل إلى سعر ${directionAr} المستهدف`;
    const text = [
      `تنبيهك لـ ${name} (${alert.code}) تحقق.`,
      `هدفك: ${directionAr} عند ${alert.targetPrice.toFixed(2)} ${currencyAr}`,
      `السعر الحالي: ${currentPrice.toFixed(2)} ${currencyAr}`,
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
    `Your target: ${alert.direction} at ${currencyEn} ${alert.targetPrice.toFixed(2)}`,
    `Current price: ${currencyEn} ${currentPrice.toFixed(2)}`,
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

function signalEmailContent({ code, nameEn, nameAr, verdict, score, price }, lang) {
  const name = lang === "ar" ? nameAr || nameEn || code : nameEn || code;
  const link = APP_URL ? `${APP_URL.replace(/\/$/, "")}/?code=${code}` : null;
  const market = detectMarket(code);
  const isBuy = verdict === "strong_buy";

  if (lang === "ar") {
    const verdictAr = isBuy ? "شراء قوي" : "بيع قوي";
    const emoji = isBuy ? "🚀" : "⚠️";
    const currency = market === "US" ? "$" : "ر.س";
    const subject = `MyShare — ${emoji} إشارة ${verdictAr}: ${name} (${code})`;
    const text = [
      `${name} (${code}) أصبح الآن إشارة "${verdictAr}" (النتيجة المركّبة: ${score > 0 ? "+" : ""}${score}).`,
      price != null ? `السعر الحالي: ${price.toFixed(2)} ${currency}` : null,
      link ? `عرض التحليل الكامل في MyShare: ${link}` : null,
      "",
      "هذا تنبيه آلي مبني على تحليل فني تلقائي وليس نصيحة استثمارية. يُرجى التحقق دائماً قبل اتخاذ أي قرار استثماري.",
    ]
      .filter(Boolean)
      .join("\n");
    return { subject, text };
  }

  const verdictEn = isBuy ? "Strong Buy" : "Strong Sell";
  const emoji = isBuy ? "🚀" : "⚠️";
  const currency = market === "US" ? "USD" : "SAR";
  const subject = `MyShare — ${emoji} ${verdictEn} signal: ${name} (${code})`;
  const text = [
    `${name} (${code}) just turned "${verdictEn}" (composite score: ${score > 0 ? "+" : ""}${score}).`,
    price != null ? `Current price: ${currency} ${price.toFixed(2)}` : null,
    link ? `See the full analysis in MyShare: ${link}` : null,
    "",
    "This is an automated alert based on rules-based technical analysis, not investment advice. Always verify before making any investment decision.",
  ]
    .filter(Boolean)
    .join("\n");
  return { subject, text };
}

/**
 * Sends a "new strong signal" notification email to one signal subscriber.
 * Never throws, same contract as sendAlertEmail — the caller decides what
 * to do with a delivery failure.
 */
export async function sendSignalEmail(toEmail, lang, signal) {
  const { subject, text } = signalEmailContent(signal, lang);
  return sendMail({ to: toEmail, subject, text });
}
