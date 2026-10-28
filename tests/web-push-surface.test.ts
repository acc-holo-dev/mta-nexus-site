import { describe, expect, it } from "vitest";
import { GET as getServiceWorker } from "../apps/web/src/app/sw.js/route";
import {
  createServiceWorkerHarness,
  makeServiceWorkerRequest,
} from "./helpers/service-worker-harness";

async function serviceWorkerSource() {
  return getServiceWorker().text();
}

describe("Web Push service worker behavior", () => {
  it("shows a push notification and keeps external targets inside NEXUS", async () => {
    const harness = createServiceWorkerHarness(await serviceWorkerSource());

    await harness.dispatchPush({
      title: "Security notice",
      body: "Review your account.",
      url: "https://evil.example/phishing",
      tag: "security",
    });

    expect(harness.notifications).toHaveLength(1);
    expect(harness.notifications[0]).toMatchObject({
      title: "Security notice",
      options: {
        body: "Review your account.",
        tag: "security",
        data: { url: "/notifications" },
      },
    });
  });

  it("preserves an explicit same-origin target", async () => {
    const harness = createServiceWorkerHarness(await serviceWorkerSource());

    await harness.dispatchPush({
      title: "NEXUS",
      url: "/security?from=push#activity",
    });

    expect(harness.notifications[0]?.options).toMatchObject({
      data: { url: "/security?from=push#activity" },
    });
  });

  it("notification clicks reject external navigation and open the safe fallback", async () => {
    const harness = createServiceWorkerHarness(await serviceWorkerSource());

    await harness.dispatchNotificationClick("https://evil.example/phishing");

    expect(harness.openedWindows).toEqual(["/notifications"]);
  });

  it("does not intercept API reads or notification mutations", async () => {
    const harness = createServiceWorkerHarness(await serviceWorkerSource());

    await expect(
      harness.dispatchFetch(makeServiceWorkerRequest("https://nexus.test/api/notifications")),
    ).resolves.toMatchObject({ intercepted: false });
    await expect(
      harness.dispatchFetch(
        makeServiceWorkerRequest("https://nexus.test/api/notifications/push", {
          method: "POST",
        }),
      ),
    ).resolves.toMatchObject({ intercepted: false });

    expect(harness.fetchCalls).toEqual([]);
    expect(harness.cachePuts).toEqual([]);
  });
});
