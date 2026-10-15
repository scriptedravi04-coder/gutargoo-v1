// Gutargoo+ service worker — makes the website installable ("Install app" / Add to Home Screen)
// and opens it quickly. It only keeps the website's own design files (JS, CSS, icons, images).
//
// It NEVER touches: /api (data, login), /stream + /storage (videos, posters from Bunny),
// /admin (admin panel), /.well-known, /socket.io, /uploads, video files, or other websites.
// So movies, login, admin and everything live always come straight from the server.
//
// After changing this file, bump VERSION so phones pick up the new one.
const VERSION = "v2";
const SHELL = `gp-shell-${VERSION}`; // the page itself (index.html), for opening offline
const STATIC = `gp-static-${VERSION}`; // hashed JS/CSS + icons/images from /public

const PRECACHE = ["/", "/manifest.json", "/icon-192.png", "/icon-512.png", "/img/white_logo.png", "/img/mark.png"];

const SKIP_PREFIXES = ["/api", "/stream", "/storage", "/admin", "/.well-known", "/socket.io", "/uploads"];
// only keep real files — never an HTML page saved under a JS/image name
const cacheable = (res) => res.ok && res.type === "basic" && !(res.headers.get("Content-Type") || "").includes("text/html");

const SKIP_EXT = /\.(mp4|m3u8|ts|m4s|webm|mov|mp3|aac)$/i;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC)
      .then((cache) => Promise.all(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })).catch(() => null))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("gp-") && k !== SHELL && k !== STATIC).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

const offlinePage = () =>
  new Response(
    '<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><title>Gutargoo+</title>' +
      '<body style="margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#000;color:#fff;font-family:system-ui,sans-serif;text-align:center">' +
      '<div><p style="font-size:18px;font-weight:700">No internet connection</p><p style="color:#9e9e9e">Check your connection and try again.</p>' +
      '<button onclick="location.reload()" style="margin-top:12px;padding:10px 22px;border:0;border-radius:10px;background:#F97316;color:#fff;font-weight:700">Retry</button></div>',
    { headers: { "Content-Type": "text/html; charset=utf-8" } }
  );

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  if (req.headers.has("range")) return; // video seeking
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // Bunny, fonts, analytics… untouched
  if (SKIP_PREFIXES.some((p) => url.pathname === p || url.pathname.startsWith(p + "/"))) return;
  if (SKIP_EXT.test(url.pathname)) return;

  // Pages: always try the server first (so a new version shows at once); offline → last saved page
  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          if (res.ok && res.type === "basic") {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put("/", copy));
          }
          return res;
        })
        .catch(() =>
          caches
            .open(SHELL) // newest saved page first, the install-time copy only as backup
            .then((c) => c.match("/"))
            .then((r) => r || caches.match("/"))
            .then((r) => r || offlinePage())
        )
    );
    return;
  }

  // Hashed build files never change → cache first
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(
      caches.match(req).then(
        (hit) =>
          hit ||
          fetch(req).then((res) => {
            if (cacheable(res)) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Icons / images in /public → show saved copy, refresh it in the background
  event.respondWith(
    caches.match(req).then((hit) => {
      const net = fetch(req)
        .then((res) => {
          if (cacheable(res)) {
            const copy = res.clone();
            caches.open(STATIC).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => hit || Response.error());
      return hit || net;
    })
  );
});
