import { describe, expect, it } from "vitest";
import { GET as getServiceWorker } from "../apps/web/src/app/sw.js/route";

describe("Web Push service worker surface", () => {
  it("shows push notifications and constrains click navigation to this origin", async () => {
    const source = await getServiceWorker().text();
    expect(source).toContain('addEventListener("push"');
    expect(source).toContain("showNotification");
    expect(source).toContain('addEventListener("notificationclick"');
    expect(source).toContain("target.origin === self.location.origin");
    expect(source).toContain('return "/notifications"');
  });

  it("keeps offline mutation and private-route cache safety unchanged", async () => {
    const source = await getServiceWorker().text();

    expect(source).toContain('request.method !== "GET"');
    expect(source).toContain('url.pathname.startsWith("/_next/static/")');
    expect(source).not.toContain('url.pathname.startsWith("/api/")');
    expect(source).not.toContain('url.pathname.startsWith("/settings")');
    expect(source).not.toContain('url.pathname.startsWith("/security")');
  });
});
