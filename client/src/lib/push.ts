// Thin wrapper around the browser's Push API for the "Signals" subscription
// feature. Every function is defensive about missing browser support (older
// Safari, some in-app browsers) since this isn't universally available.
//
// iOS/iPadOS is a special case: Apple only allows Web Push for a site the
// user has explicitly "Added to Home Screen" as an installed web app
// (Safari 16.4+) — it silently doesn't work in a normal Safari tab, with no
// helpful error to catch. isIOS()/isStandalone() let the UI detect that case
// up front and tell the user what to do, instead of the toggle just failing.

export function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  // iPadOS 13+ reports as "MacIntel" but has touch support, unlike a real Mac.
  return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // navigator.standalone is Safari-specific (iOS); display-mode covers everyone else.
  return (window.navigator as { standalone?: boolean }).standalone === true || window.matchMedia("(display-mode: standalone)").matches;
}

export function isPushSupported(): boolean {
  return typeof window !== "undefined" && "serviceWorker" in navigator && "PushManager" in window;
}

/**
 * Why push can't be turned on right now, if it can't — lets the UI show a
 * specific, actionable message instead of a generic "not supported".
 */
export function getPushBlockedReason(): "unsupported" | "ios_not_installed" | null {
  if (isIOS() && !isStandalone()) return "ios_not_installed";
  if (!isPushSupported()) return "unsupported";
  return null;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register("/sw.js");
}

/**
 * Registers the service worker, requests Notification permission (if not
 * already granted/denied), and subscribes to push with the given VAPID
 * public key. Returns the raw PushSubscription (to POST to the backend) or
 * throws with a message safe to show the user.
 */
export async function subscribeToPush(vapidPublicKey: string): Promise<PushSubscriptionJSON> {
  if (!isPushSupported()) throw new Error("Push notifications are not supported in this browser.");

  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new Error("Notification permission was not granted.");

  const registration = await registerServiceWorker();
  const existing = await registration.pushManager.getSubscription();
  const subscription =
    existing ??
    (await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidPublicKey) as unknown as BufferSource,
    }));

  return subscription.toJSON();
}

/** Unsubscribes the current browser's push registration, if any. Returns the endpoint that was removed (for the backend call), or null. */
export async function unsubscribeFromPush(): Promise<string | null> {
  if (!isPushSupported()) return null;
  const registration = await navigator.serviceWorker.getRegistration("/sw.js");
  const subscription = await registration?.pushManager.getSubscription();
  if (!subscription) return null;
  const endpoint = subscription.endpoint;
  await subscription.unsubscribe();
  return endpoint;
}
