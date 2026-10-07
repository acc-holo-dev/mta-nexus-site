import { describe, expect, it } from "vitest";
import { parseWebPushSubscription } from "../apps/web/src/lib/web-push-subscription";

describe("Web Push subscription validation", () => {
  const valid = {
    endpoint: "https://push.example.test/subscriptions/abc",
    expirationTime: null,
    keys: { p256dh: "p".repeat(86), auth: "a".repeat(22) },
  };

  it("accepts bounded HTTPS subscriptions", () => {
    expect(parseWebPushSubscription(valid)).toMatchObject({
      endpoint: valid.endpoint,
      expirationAt: null,
      p256dh: valid.keys.p256dh,
      auth: valid.keys.auth,
    });
  });

  it("rejects insecure, incomplete and oversized subscriptions", () => {
    expect(parseWebPushSubscription({ ...valid, endpoint: "http://push.example.test/subscriptions/abc" })).toBeNull();
    expect(parseWebPushSubscription({ ...valid, keys: { p256dh: valid.keys.p256dh } })).toBeNull();
    expect(parseWebPushSubscription({ ...valid, endpoint: `https://push.example.test/${"x".repeat(2100)}` })).toBeNull();
  });

  it("normalizes an expiration timestamp when supplied", () => {
    const expirationTime = Date.UTC(2030, 0, 1);
    expect(parseWebPushSubscription({ ...valid, expirationTime })?.expirationAt).toEqual(new Date(expirationTime));
  });
});
