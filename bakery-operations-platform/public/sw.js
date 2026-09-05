/* Service worker for the bakery operations platform — Web Push notifications.
 * Kept intentionally minimal: no offline caching, just push handling so
 * the production screen is notified of new orders even when closed. */

self.addEventListener("install", () => {
  // Activate this worker immediately without waiting for old tabs to close.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// A registered fetch handler is what makes the app installable — it's what
// lets the browser fire `beforeinstallprompt` (the "Install app" button /
// prompt on Android Chrome). We don't cache or intercept: requests go to
// the network exactly as they would without a service worker.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = payload.title || "🥖 طلب جديد";
  const options = {
    body: payload.body || "وصل طلب جديد",
    icon: "/icons/icon.svg",
    badge: "/icons/icon.svg",
    lang: "ar",
    dir: "rtl",
    tag: payload.tag || "new-order",
    renotify: true,
    vibrate: [120, 60, 120],
    data: { url: payload.url || "/production/orders" },
  };

  event.waitUntil(
    (async () => {
      // Always tell any open screen to refresh its list. Two channels,
      // because client.postMessage from a SW is flaky on some platforms
      // (notably iOS PWAs): direct client messages + a BroadcastChannel.
      const hasVisibleClient = await notifyOpenClients();

      // Refresh-only ("silent") push: if the app is open, just refresh —
      // no OS banner. When the app is closed we still show a notification
      // (so the worker is alerted, and to satisfy the browser's
      // must-show-notification policy for background pushes).
      if (payload.silent && hasVisibleClient) return;

      await self.registration.showNotification(title, options);
    })()
  );
});

async function notifyOpenClients() {
  let hasVisibleClient = false;
  try {
    const clients = await self.clients.matchAll({
      type: "window",
      includeUncontrolled: true,
    });
    for (const client of clients) {
      client.postMessage({ type: "new-order" });
      if (client.visibilityState === "visible") hasVisibleClient = true;
    }
  } catch {
    /* ignore */
  }
  try {
    const bc = new BroadcastChannel("orders-refresh");
    bc.postMessage({ type: "new-order" });
    bc.close();
  } catch {
    /* BroadcastChannel unsupported — client messages above still apply */
  }
  return hasVisibleClient;
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/production/orders";
  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Focus an existing tab on that screen if we have one, and tell it
      // to refresh its order list right away.
      await notifyOpenClients();
      for (const client of clients) {
        if (client.url.includes("/production") && "focus" in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })()
  );
});
