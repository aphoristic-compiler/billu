import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();

self.addEventListener("push", (event) => {
  if (!event.data) return;
  
  const payload = event.data.json();
  const { title, body, icon, url } = payload;

  event.waitUntil(
    self.registration.showNotification(title || "SATURO:// ALERT", {
      body,
      icon: icon || "/terminal-icon.png",
      badge: "/terminal-icon.png",
      vibrate: [200, 100, 200, 100, 200, 100, 200],
      requireInteraction: true,
      tag: "wing-alert",
      data: { url },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data.url;
  
  if (url) {
    event.waitUntil(
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          if (client.url === url && "focus" in client) {
            return client.focus();
          }
        }
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
    );
  }
});
