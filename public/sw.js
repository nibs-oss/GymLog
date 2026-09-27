// GymLog service worker: makes the app installable and keeps static assets cached.
// Pages and data always come from the network so you never see stale workouts.
const CACHE = "gymlog-static-v1";

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Build assets are content-hashed, so cache-first is safe
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(
      caches.open(CACHE).then(async (cache) => {
        const hit = await cache.match(req);
        if (hit) return hit;
        const res = await fetch(req);
        if (res.ok) cache.put(req, res.clone());
        return res;
      })
    );
    return;
  }

  // Pages: network, with a simple offline message
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req).catch(
        () =>
          new Response(
            '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><body style="background:#07111f;color:#e6f1fb;font-family:system-ui;display:grid;place-items:center;height:100vh;margin:0;text-align:center"><div><p style="font-size:40px;margin:0">📡</p><h1 style="font-size:20px">You\'re offline</h1><p style="color:#94a3b8">Reconnect to log your workout.</p></div></body>',
            { headers: { "Content-Type": "text/html; charset=utf-8" } }
          )
      )
    );
  }
});
