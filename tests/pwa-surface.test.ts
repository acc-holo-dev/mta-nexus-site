import { describe, expect, it } from "vitest";
import manifest from "../apps/web/src/app/manifest";
import { GET as getServiceWorker } from "../apps/web/src/app/sw.js/route";
import {
  createServiceWorkerHarness,
  makeServiceWorkerRequest,
} from "./helpers/service-worker-harness";

async function serviceWorkerSource() {
  return getServiceWorker().text();
}

function publicDocumentResponse(options: {
  marker?: boolean;
  vary?: string;
} = {}) {
  const clone = { kind: "public-document-clone" };
  const headers = new Headers({
    "Content-Type": "text/html; charset=utf-8",
    ...(options.marker === false
      ? {}
      : { "X-Nexus-Offline-Cache": "public-readonly-v1" }),
    Vary: options.vary ?? "Cookie",
  });
  return {
    ok: true,
    type: "basic",
    headers,
    clone() {
      return clone;
    },
  };
}

describe("PWA release surface", () => {
  it("publishes an installable standalone manifest", () => {
    const value = manifest();

    expect(value.id).toBe("/");
    expect(value.start_url).toBe("/");
    expect(value.scope).toBe("/");
    expect(value.display).toBe("standalone");
    expect(value.icons).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          src: "/icon.svg",
          type: "image/svg+xml",
        }),
      ]),
    );
  });

  it("serves the worker with strict service-worker headers", async () => {
    const response = getServiceWorker();

    expect(response.headers.get("content-type")).toContain(
      "application/javascript",
    );
    expect(response.headers.get("service-worker-allowed")).toBe("/");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });

  it("does not intercept mutations, cross-origin requests or same-origin API reads", async () => {
    const harness = createServiceWorkerHarness(await serviceWorkerSource());

    await expect(
      harness.dispatchFetch(
        makeServiceWorkerRequest("https://nexus.test/_next/static/app.js", {
          method: "POST",
        }),
      ),
    ).resolves.toMatchObject({ intercepted: false });
    await expect(
      harness.dispatchFetch(
        makeServiceWorkerRequest("https://cdn.example.test/_next/static/app.js"),
      ),
    ).resolves.toMatchObject({ intercepted: false });
    await expect(
      harness.dispatchFetch(
        makeServiceWorkerRequest("https://nexus.test/api/notifications"),
      ),
    ).resolves.toMatchObject({ intercepted: false });

    expect(harness.fetchCalls).toEqual([]);
    expect(harness.cachePuts).toEqual([]);
  });

  it("cache-first stores only a successful same-origin immutable static response", async () => {
    const clone = { kind: "cached-clone" };
    const networkResponse = {
      ok: true,
      type: "basic",
      clone() {
        return clone;
      },
    };
    const harness = createServiceWorkerHarness(await serviceWorkerSource(), {
      async fetch() {
        return networkResponse;
      },
    });
    const request = makeServiceWorkerRequest(
      "https://nexus.test/_next/static/chunks/app-abc123.js",
    );

    const result = await harness.dispatchFetch(request);

    expect(result.intercepted).toBe(true);
    expect(result.response).toBe(networkResponse);
    expect(harness.fetchCalls).toEqual([request]);
    expect(harness.cachePuts).toEqual([{ request, response: clone }]);
  });

  it("bounds the immutable static cache and evicts oldest entries", async () => {
    const oldKeys = Array.from({ length: 97 }, (_, index) => ({
      url: `https://nexus.test/_next/static/chunks/old-${index}.js`,
    }));
    const clone = { kind: "cached-clone" };
    const harness = createServiceWorkerHarness(await serviceWorkerSource(), {
      cacheKeys: oldKeys,
      async fetch() {
        return {
          ok: true,
          type: "basic",
          clone() {
            return clone;
          },
        };
      },
    });
    const request = makeServiceWorkerRequest(
      "https://nexus.test/_next/static/chunks/new.js",
    );

    await harness.dispatchFetch(request);

    expect(harness.cacheDeletes).toEqual(oldKeys.slice(0, 2));
  });

  it("serves an immutable static cache hit without network access", async () => {
    const cachedResponse = { kind: "cached" };
    const harness = createServiceWorkerHarness(await serviceWorkerSource(), {
      cachedResponse,
    });

    const result = await harness.dispatchFetch(
      makeServiceWorkerRequest(
        "https://nexus.test/_next/static/css/app-abc123.css",
      ),
    );

    expect(result.intercepted).toBe(true);
    expect(result.response).toBe(cachedResponse);
    expect(harness.fetchCalls).toEqual([]);
    expect(harness.cachePuts).toEqual([]);
  });

  it("caches only explicitly marked anonymous public read-only navigation", async () => {
    const response = publicDocumentResponse();
    const harness = createServiceWorkerHarness(await serviceWorkerSource(), {
      async fetch() {
        return response;
      },
    });
    const request = makeServiceWorkerRequest(
      "https://nexus.test/articles/release-notes",
      { mode: "navigate" },
    );

    const result = await harness.dispatchFetch(request);

    expect(result.response).toBe(response);
    expect(harness.cachePuts).toEqual([
      {
        request,
        response: { kind: "public-document-clone" },
      },
    ]);
  });

  it("requires both the server marker and Vary Cookie before caching HTML", async () => {
    for (const response of [
      publicDocumentResponse({ marker: false }),
      publicDocumentResponse({ vary: "Accept-Encoding" }),
    ]) {
      const harness = createServiceWorkerHarness(
        await serviceWorkerSource(),
        {
          async fetch() {
            return response;
          },
        },
      );

      await harness.dispatchFetch(
        makeServiceWorkerRequest(
          "https://nexus.test/articles/security-update",
          { mode: "navigate" },
        ),
      );

      expect(harness.cachePuts).toEqual([]);
    }
  });

  it("refuses marked HTML outside the public read-only allowlist", async () => {
    const harness = createServiceWorkerHarness(await serviceWorkerSource(), {
      async fetch() {
        return publicDocumentResponse();
      },
    });

    await harness.dispatchFetch(
      makeServiceWorkerRequest("https://nexus.test/market", {
        mode: "navigate",
      }),
    );
    await harness.dispatchFetch(
      makeServiceWorkerRequest("https://nexus.test/settings", {
        mode: "navigate",
      }),
    );

    expect(harness.cachePuts).toEqual([]);
  });

  it("serves a previously cached public document only after network failure", async () => {
    const cachedResponse = { kind: "cached-public-document" };
    const harness = createServiceWorkerHarness(await serviceWorkerSource(), {
      cachedResponse,
      async fetch() {
        throw new TypeError("offline");
      },
    });

    const result = await harness.dispatchFetch(
      makeServiceWorkerRequest(
        "https://nexus.test/articles/release-notes",
        { mode: "navigate" },
      ),
    );

    expect(result.response).toBe(cachedResponse);
  });

  it("bounds the public document cache independently", async () => {
    const oldKeys = Array.from({ length: 25 }, (_, index) => ({
      url: `https://nexus.test/articles/old-${index}-post`,
    }));
    const harness = createServiceWorkerHarness(await serviceWorkerSource(), {
      cacheKeys: oldKeys,
      async fetch() {
        return publicDocumentResponse();
      },
    });
    const request = makeServiceWorkerRequest(
      "https://nexus.test/articles/new-release",
      { mode: "navigate" },
    );

    await harness.dispatchFetch(request);

    expect(harness.cacheDeletes).toEqual(oldKeys.slice(0, 2));
  });

  it("falls back to the self-contained offline document without caching navigation HTML", async () => {
    const harness = createServiceWorkerHarness(await serviceWorkerSource(), {
      async fetch() {
        throw new TypeError("offline");
      },
    });

    const result = await harness.dispatchFetch(
      makeServiceWorkerRequest("https://nexus.test/settings", {
        mode: "navigate",
        language: "en",
      }),
    );

    expect(result.intercepted).toBe(true);
    expect(result.response).toBeInstanceOf(Response);
    const response = result.response as Response;
    expect(response.status).toBe(503);
    await expect(response.text()).resolves.toContain(
      "never confirms purchases",
    );
    expect(harness.cachePuts).toEqual([]);
  });
});
