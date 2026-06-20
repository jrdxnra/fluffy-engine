// Rest Timer Service Worker
// Handles background notifications so the timer fires even when the screen is off.

let pendingTimeout = null;

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("message", (event) => {
  if (!event.data) return;

  if (event.data.type === "SCHEDULE_TIMER") {
    // Cancel any existing pending timer
    if (pendingTimeout !== null) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }

    const delayMs = event.data.delayMs;
    if (typeof delayMs !== "number" || delayMs <= 0) return;

    pendingTimeout = setTimeout(() => {
      pendingTimeout = null;
      self.registration
        .showNotification("Rest timer done! 💪", {
          body: "Time to get back to work.",
          icon: "/favicon.svg",
          vibrate: [600, 200, 600, 200, 600, 200, 600],
          tag: "rest-timer",
          requireInteraction: false,
          silent: false,
        })
        .catch(() => {});
    }, delayMs);
  }

  if (event.data.type === "CANCEL_TIMER") {
    if (pendingTimeout !== null) {
      clearTimeout(pendingTimeout);
      pendingTimeout = null;
    }
  }
});
