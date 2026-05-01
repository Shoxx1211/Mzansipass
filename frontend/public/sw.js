// ===============================
// 🚀 PULSE SERVICE WORKER (PRO)
// ===============================

const CACHE_VERSION = "v2";
const CACHE_NAME = `pulse-${CACHE_VERSION}`;

// 🔥 Core assets (app shell)
const CORE_ASSETS = [
  "/",
  "/index.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png"
];

// ===============================
// 📦 INSTALL (PRE-CACHE)
// ===============================
self.addEventListener("install", (event) => {
  console.log("📦 SW installing...");

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(CORE_ASSETS);
    })
  );

  // 🔥 Activate immediately
  self.skipWaiting();
});

// ===============================
// 🔄 ACTIVATE (CLEAN OLD CACHES)
// ===============================
self.addEventListener("activate", (event) => {
  console.log("🚀 SW activating...");

  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log("🧹 Removing old cache:", key);
            return caches.delete(key);
          }
        })
      );
    })
  );

  return self.clients.claim();
});

// ===============================
// 🌐 FETCH STRATEGY
// ===============================
self.addEventListener("fetch", (event) => {
  const req = event.request;

  // 🔥 Only handle GET requests
  if (req.method !== "GET") return;

  // 🔥 HTML → Network First (fresh app)
  if (req.headers.get("accept")?.includes("text/html")) {
    event.respondWith(networkFirst(req));
    return;
  }

  // 🔥 Static assets → Cache First (fast)
  event.respondWith(cacheFirst(req));
});

// ===============================
// 📡 NETWORK FIRST (HTML)
// ===============================
async function networkFirst(request) {
  try {
    const fresh = await fetch(request);

    const cache = await caches.open(CACHE_NAME);
    cache.put(request, fresh.clone());

    return fresh;
  } catch (err) {
    const cached = await caches.match(request);
    return cached || caches.match("/index.html");
  }
}

// ===============================
// ⚡ CACHE FIRST (STATIC)
// ===============================
async function cacheFirst(request) {
  const cached = await caches.match(request);

  if (cached) return cached;

  try {
    const fresh = await fetch(request);

    const cache = await caches.open(CACHE_NAME);
    cache.put(request, fresh.clone());

    return fresh;
  } catch {
    return cached;
  }
}

// ===============================
// 🔄 FORCE UPDATE HANDLER
// ===============================
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    console.log("⚡ Skipping waiting...");
    self.skipWaiting();
  }
});