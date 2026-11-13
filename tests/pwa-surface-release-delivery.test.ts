import { describe, expect, it } from "vitest";
import manifest from "../site/src/app/manifest";
import { GET as getServiceWorker } from "../site/src/app/sw.js/route";

describe("PWA release delivery", () => {
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

    expect(response.headers.get("content-type")).toContain("application/javascript");
    expect(response.headers.get("service-worker-allowed")).toBe("/");
    expect(response.headers.get("cache-control")).toContain("no-store");
  });
});
