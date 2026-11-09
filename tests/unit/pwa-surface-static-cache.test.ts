import { describe, expect, it } from "vitest";
import {
  createServiceWorkerHarness,
  makeServiceWorkerRequest,
  serviceWorkerSource,
} from "../helpers/pwa-surface-harness";

describe("PWA immutable static cache", () => {
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
    const request = makeServiceWorkerRequest("https://nexus.test/_next/static/chunks/new.js");

    await harness.dispatchFetch(request);

    expect(harness.cacheDeletes).toEqual(oldKeys.slice(0, 2));
  });

  it("serves an immutable static cache hit without network access", async () => {
    const cachedResponse = { kind: "cached" };
    const harness = createServiceWorkerHarness(await serviceWorkerSource(), {
      cachedResponse,
    });

    const result = await harness.dispatchFetch(
      makeServiceWorkerRequest("https://nexus.test/_next/static/css/app-abc123.css"),
    );

    expect(result.intercepted).toBe(true);
    expect(result.response).toBe(cachedResponse);
    expect(harness.fetchCalls).toEqual([]);
    expect(harness.cachePuts).toEqual([]);
  });
});
