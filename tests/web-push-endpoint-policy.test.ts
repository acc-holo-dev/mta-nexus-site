import { describe, expect, it } from "vitest";
import { WebPushPermanentSubscriptionError } from "@nexus/db";
import {
  isPublicWebPushAddress,
  parseWebPushEndpoint,
  resolveWebPushTarget,
} from "../apps/web/src/lib/services/web-push-endpoint-policy";

describe("Web Push endpoint policy", () => {
  it("accepts an ordinary HTTPS push-service endpoint", () => {
    const url = parseWebPushEndpoint("https://push.example.net/subscriptions/abc?token=1");
    expect(url.origin).toBe("https://push.example.net");
    expect(url.pathname).toBe("/subscriptions/abc");
  });

  it.each([
    "http://push.example.net/subscriptions/abc",
    "https://user:secret@push.example.net/subscriptions/abc",
    "https://push.example.net:8443/subscriptions/abc",
    "https://push.example.net/subscriptions/abc#fragment",
    "https://localhost/subscriptions/abc",
    "https://service.local/subscriptions/abc",
    "https://127.0.0.1/subscriptions/abc",
    "https://[::1]/subscriptions/abc",
  ])("rejects an unsafe endpoint permanently: %s", (endpoint) => {
    expect(() => parseWebPushEndpoint(endpoint)).toThrow(WebPushPermanentSubscriptionError);
  });

  it("classifies public and special-use addresses conservatively", () => {
    expect(isPublicWebPushAddress("1.1.1.1")).toBe(true);
    expect(isPublicWebPushAddress("8.8.8.8")).toBe(true);
    expect(isPublicWebPushAddress("2606:4700:4700::1111")).toBe(true);

    for (const address of [
      "0.0.0.0",
      "10.0.0.1",
      "100.64.0.1",
      "127.0.0.1",
      "169.254.1.1",
      "172.16.0.1",
      "192.168.1.1",
      "198.18.0.1",
      "203.0.113.5",
      "::1",
      "fc00::1",
      "fe80::1",
      "2001:db8::1",
      "::ffff:127.0.0.1",
    ]) {
      expect(isPublicWebPushAddress(address), address).toBe(false);
    }
  });

  it("rejects DNS answers containing any non-public address", async () => {
    await expect(
      resolveWebPushTarget("https://push.example.net/subscriptions/abc", async () => [
        { address: "1.1.1.1", family: 4 },
        { address: "10.0.0.10", family: 4 },
      ]),
    ).rejects.toBeInstanceOf(WebPushPermanentSubscriptionError);
  });

  it("pins the connection target to the resolved public address", async () => {
    await expect(
      resolveWebPushTarget("https://push.example.net/subscriptions/abc", async (hostname) => {
        expect(hostname).toBe("push.example.net");
        return [{ address: "1.1.1.1", family: 4 }];
      }),
    ).resolves.toMatchObject({
      hostname: "push.example.net",
      address: "1.1.1.1",
      family: 4,
    });
  });
});
