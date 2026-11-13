import { describe, expect, it } from "vitest";
import {
  createServiceWorkerHarness,
  makeServiceWorkerRequest,
  publicDocumentResponse,
  serviceWorkerSource,
} from "../helpers/pwa-surface-harness";

describe("PWA public document offline cache", () => {
  it("caches only explicitly marked anonymous public read-only navigation", async () => {
    const response = publicDocumentResponse();
    const harness = createServiceWorkerHarness(await serviceWorkerSource(), {
      async fetch() {
        return response;
      },
    });
    const request = makeServiceWorkerRequest("https://nexus.test/articles/release-notes", {
      mode: "navigate",
    });

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
      const harness = createServiceWorkerHarness(await serviceWorkerSource(), {
        async fetch() {
          return response;
        },
      });

      await harness.dispatchFetch(
        makeServiceWorkerRequest("https://nexus.test/articles/security-update", {
          mode: "navigate",
        }),
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
      makeServiceWorkerRequest("https://nexus.test/articles/release-notes", { mode: "navigate" }),
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
    const request = makeServiceWorkerRequest("https://nexus.test/articles/new-release", {
      mode: "navigate",
    });

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
    await expect(response.text()).resolves.toContain("never confirms purchases");
    expect(harness.cachePuts).toEqual([]);
  });
});
