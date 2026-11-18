import {
  offlineDocumentCopy,
  offlineDocumentTheme,
} from "../../features/shell/offline-document-copy";

const OFFLINE_BUNDLE_MARKER = "__NEXUS_OFFLINE_BUNDLE__";

const serviceWorkerTemplate = String.raw`
const OFFLINE_CACHE_NAME = "nexus-offline-v1";
const STATIC_CACHE_NAME = "nexus-static-v1";
const PUBLIC_DOCUMENT_CACHE_NAME = "nexus-public-documents-v1";
const STATIC_CACHE_MAX_ENTRIES = 96;
const PUBLIC_DOCUMENT_CACHE_MAX_ENTRIES = 24;
const PUBLIC_DOCUMENT_CACHE_HEADER = "x-nexus-offline-cache";
const PUBLIC_DOCUMENT_CACHE_MARKER = "public-readonly-v1";
const SAFE_ASSETS = ["/icon.svg"];
const ARTICLE_SLUG_PATH = /^\/articles\/[a-z0-9][a-z0-9-]{2,199}$/;
${OFFLINE_BUNDLE_MARKER}

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

function offlineLocaleFromLanguage(value) {
  return (value || "").toLowerCase().startsWith("ru") ? "ru" : "en";
}

function offlineDocument(request) {
  const locale = offlineLocaleFromLanguage(request.headers.get("accept-language"));
  const copy = OFFLINE_COPY[locale];
  const theme = OFFLINE_THEME;
  const html =
    "<!doctype html><html lang=\"" +
    locale +
    "\"><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><meta name=\"theme-color\" content=\"" +
    theme.page +
    "\"><title>" +
    copy.title +
    "</title><style>html{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:" +
    theme.page +
    ";color:" +
    theme.text +
    ";font:16px/1.5 " +
    theme.fontSans +
    "}main{max-width:38rem;padding:2rem}strong{font-family:" +
    theme.fontDisplay +
    "}h1{font-family:" +
    theme.fontDisplay +
    ";font-size:2rem;line-height:1.1}p{color:" +
    theme.textSecondary +
    "}a{display:inline-block;margin-top:1rem;padding:.7rem 1rem;border:1px solid " +
    theme.border +
    ";border-radius:.75rem;color:" +
    theme.text +
    ";text-decoration:none}a:focus-visible{outline:2px solid " +
    theme.text +
    ";outline-offset:3px}</style></head><body><main><strong>" +
    copy.brand +
    "</strong><h1>" +
    copy.heading +
    "</h1><p>" +
    copy.body +
    "</p><a href=\"\" aria-label=\"" +
    copy.retry +
    "\">" +
    copy.retry +
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
    pathname === "/community-rules" ||
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

  const pushLocale = offlineLocaleFromLanguage(self.navigator && self.navigator.language);
  const title =
    typeof payload.title === "string" && payload.title.trim()
      ? payload.title.trim().slice(0, 120)
      : OFFLINE_COPY[pushLocale].brand;
  const body =
    typeof payload.body === "string"
      ? payload.body.trim().slice(0, 280)
      : OFFLINE_COPY[pushLocale].pushFallbackBody;
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

function buildServiceWorkerSource() {
  const markerIndex = serviceWorkerTemplate.indexOf(OFFLINE_BUNDLE_MARKER);
  if (markerIndex === -1) {
    throw new Error("offline bundle marker missing from service worker template");
  }
  // Concatenate so JSON `$` sequences are not interpreted by String.replace.
  const bundle =
    "const OFFLINE_COPY = " +
    JSON.stringify(offlineDocumentCopy) +
    ";\nconst OFFLINE_THEME = " +
    JSON.stringify(offlineDocumentTheme) +
    ";";
  return (
    serviceWorkerTemplate.slice(0, markerIndex) +
    bundle +
    serviceWorkerTemplate.slice(markerIndex + OFFLINE_BUNDLE_MARKER.length)
  );
}

export function GET() {
  return new Response(buildServiceWorkerSource(), {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Service-Worker-Allowed": "/",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
