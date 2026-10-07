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
