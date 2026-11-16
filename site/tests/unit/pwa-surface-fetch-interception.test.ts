import { describe, expect, it } from "vitest";
import {
  createServiceWorkerHarness,
  makeServiceWorkerRequest,
  serviceWorkerSource,
} from "../helpers/pwa-surface-harness";

describe("PWA service-worker fetch interception", () => {
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
      harness.dispatchFetch(makeServiceWorkerRequest("https://nexus.test/api/notifications")),
    ).resolves.toMatchObject({ intercepted: false });

    expect(harness.fetchCalls).toEqual([]);
    expect(harness.cachePuts).toEqual([]);
  });
});
