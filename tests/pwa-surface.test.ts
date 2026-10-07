import { describe, expect, it } from "vitest";
import manifest from "../apps/web/src/app/manifest";
import { GET as getServiceWorker } from "../apps/web/src/app/sw.js/route";

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

  it("serves a non-cacheable service worker with a safe offline boundary", async () => {
    const response = getServiceWorker();
    const source = await response.text();

    expect(response.headers.get("content-type")).toContain("application/javascript");
    expect(response.headers.get("service-worker-allowed")).toBe("/");
    expect(response.headers.get("cache-control")).toContain("no-store");

    expect(source).toContain('request.method !== "GET"');
    expect(source).toContain('request.mode === "navigate"');
    expect(source).toContain("fetch(request).catch(() => offlineDocument(request))");
    expect(source).toContain("never confirms purchases");
    expect(source).not.toContain("caches.put(");
  });
});
