import webpush from "web-push";

const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

const configured = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (configured) {
  webpush.setVapidDetails(VAPID_SUBJECT || "mailto:admin@example.com", VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} else {
  console.warn(
    "[push] VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY not set — browser push notifications are disabled. See README for setup."
  );
}

export const isPushConfigured = () => configured;
export const getVapidPublicKey = () => VAPID_PUBLIC_KEY || null;

/**
 * Sends one Web Push message. Never throws — a dead/expired subscription
 * (410 Gone or 404) is reported back as { sent: false, expired: true } so
 * the caller can clean it up, and any other failure is just { sent: false }.
 */
export async function sendPush(subscription, payload) {
  if (!configured) return { sent: false, expired: false, reason: "push_not_configured" };
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: { p256dh: subscription.p256dh, auth: subscription.auth },
      },
      JSON.stringify(payload)
    );
    return { sent: true };
  } catch (err) {
    const expired = err.statusCode === 404 || err.statusCode === 410;
    if (!expired) console.error(`[push] failed to send to ${subscription.endpoint}:`, err.message);
    return { sent: false, expired, reason: err.message };
  }
}
