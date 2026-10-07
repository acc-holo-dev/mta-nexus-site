const serviceWorkerSource = String.raw`
const OFFLINE_CACHE_NAME = "nexus-offline-v1";
const STATIC_CACHE_NAME = "nexus-static-v1";
const PUBLIC_DOCUMENT_CACHE_NAME = "nexus-public-documents-v1";
const STATIC_CACHE_MAX_ENTRIES = 96;
const PUBLIC_DOCUMENT_CACHE_MAX_ENTRIES = 24;
const PUBLIC_DOCUMENT_CACHE_HEADER = "x-nexus-offline-cache";
const PUBLIC_DOCUMENT_CACHE_MARKER = "public-readonly-v1";
const SAFE_ASSETS = ["/icon.svg"];
const ARTICLE_SLUG_PATH = /^\/articles\/[a-z0-9][a-z0-9-]{2,199}$/;

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(OFFLINE_CACHE_NAME)
      .then((cache) => cache.addAll(SAFE_ASSETS))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) =>
                (key.startsWith("nexus-offline-") ||
                  key.startsWith("nexus-static-") ||
                  key.startsWith("nexus-public-documents-")) &&
                key !== OFFLINE_CACHE_NAME &&
                key !== STATIC_CACHE_NAME &&
                key !== PUBLIC_DOCUMENT_CACHE_NAME,
            )
            .map((key) => caches.delete(key)),
        ),
      ),
      self.clients.claim(),
    ]),
  );
});

function offlineDocument(request) {
  const language = (request.headers.get("accept-language") || "").toLowerCase();
  const russian = language.startsWith("ru");
  const title = russian ? "MTA NEXUS — нет сети" : "MTA NEXUS — offline";
  const heading = russian ? "Нет подключения к сети" : "You are offline";
  const body = russian
    ? "NEXUS не подтверждает покупки, публикации, модерацию и другие изменения без соединения с сервером."
    : "NEXUS never confirms purchases, publishing, moderation, or other state changes without a server connection.";
  const retry = russian ? "Повторить" : "Try again";
  const html =
    "<!doctype html><html lang=\"" +
    (russian ? "ru" : "en") +
    "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"theme-color\" content=\"#09090b\"><title>" +
    title +
    "</title><style>html{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#09090b;color:#f4f4f5;font:16px/1.5 system-ui,sans-serif}main{max-width:38rem;padding:2rem}h1{font-size:2rem;line-height:1.1}p{color:#a1a1aa}a{display:inline-block;margin-top:1rem;padding:.7rem 1rem;border:1px solid #3f3f46;border-radius:.75rem;color:#fafafa;text-decoration:none}a:focus-visible{outline:2px solid #fafafa;outline-offset:3px}</style></head><body><main><strong>MTA NEXUS</strong><h1>" +
    heading +
    "</h1><p>" +
    body +
    "</p><a href=\"\" aria-label=\"" +
    retry +
    "\">" +
    retry +
    "</a></main></body></html>";

  return new Response(html, {
    status: 503,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function notificationTarget(value) {
  try {
    const target = new URL(
      typeof value === "string" ? value : "/notifications",
      self.location.origin,
    );
    if (target.origin === self.location.origin) {
      return target.pathname + target.search + target.hash;
    }
  } catch {}
  return "/notifications";
}

function isPublicDocumentPath(pathname) {
  return (
    pathname === "/articles" ||
    pathname === "/copyright" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    ARTICLE_SLUG_PATH.test(pathname)
  );
}

function hasCookieVary(response) {
  return (response.headers.get("vary") || "")
    .split(",")
    .some((value) => value.trim().toLowerCase() === "cookie");
}

function canCachePublicDocument(request, url, response) {
  const contentType =
    (response.headers.get("content-type") || "").toLowerCase();
  return (
    request.mode === "navigate" &&
    isPublicDocumentPath(url.pathname) &&
    response.ok &&
    response.type === "basic" &&
    contentType.startsWith("text/html") &&
    response.headers.get(PUBLIC_DOCUMENT_CACHE_HEADER) ===
      PUBLIC_DOCUMENT_CACHE_MARKER &&
    hasCookieVary(response)
  );
}

async function trimCache(cache, maxEntries) {
  const keys = await cache.keys();
  const overflow = keys.length - maxEntries;
  if (overflow <= 0) return;
  await Promise.all(
    keys.slice(0, overflow).map((request) => cache.delete(request)),
  );
}

async function immutableStaticResponse(request) {
  const cache = await caches.open(STATIC_CACHE_NAME);
  const cached = await cache.match(request);
  if (cached) return cached;

  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
    await trimCache(cache, STATIC_CACHE_MAX_ENTRIES);
  }
  return response;
}

async function navigationResponse(request, url) {
  try {
    const response = await fetch(request);
    if (canCachePublicDocument(request, url, response)) {
      const cache = await caches.open(PUBLIC_DOCUMENT_CACHE_NAME);
      await cache.put(request, response.clone());
      await trimCache(cache, PUBLIC_DOCUMENT_CACHE_MAX_ENTRIES);
    }
    return response;
  } catch {
    if (isPublicDocumentPath(url.pathname)) {
      const cache = await caches.open(PUBLIC_DOCUMENT_CACHE_NAME);
      const cached = await cache.match(request);
      if (cached) return cached;
    }
    return offlineDocument(request);
  }
}

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {}

  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim().slice(0, 120)
      : "MTA NEXUS";
  const body =
    typeof payload.body === "string"
      ? payload.body.trim().slice(0, 280)
      : "You have a new notification.";
  const target = notificationTarget(payload.url);

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag:
        typeof payload.tag === "string" && payload.tag.trim()
          ? payload.tag.trim().slice(0, 120)
          : undefined,
      data: { url: target },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = notificationTarget(event.notification.data?.url);

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (clients) => {
        for (const client of clients) {
          if (new URL(client.url).origin !== self.location.origin) continue;
          if ("navigate" in client) await client.navigate(target);
          return client.focus();
        }
        return self.clients.openWindow(target);
      }),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (SAFE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request)),
    );
    return;
  }

  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(immutableStaticResponse(request));
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(navigationResponse(request, url));
  }
});
`;

export function GET() {
  return new Response(serviceWorkerSource, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
