import { Buffer } from "node:buffer";
import { createECDH } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  parseWebPushSubscription,
  parseWebPushVapidPublicKey,
} from "../apps/web/src/lib/web-push-subscription";

function base64Url(bytes: Uint8Array) {
  return Buffer.from(bytes).toString("base64url");
}

function p256Key() {
  const ecdh = createECDH("prime256v1");
  ecdh.generateKeys();
  return ecdh.getPublicKey(undefined, "uncompressed").toString("base64url");
}

function authSecret(fill = 2) {
  return base64Url(new Uint8Array(16).fill(fill));
}

describe("Web Push subscription validation", () => {
  const valid = {
    endpoint: "https://push.example.test/subscriptions/abc",
    expirationTime: null,
    keys: {
      p256dh: p256Key(),
      auth: authSecret(),
    },
  };

  it("accepts a bounded HTTPS subscription with valid Web Push key material", () => {
    expect(parseWebPushSubscription(valid)).toMatchObject({
      endpoint: valid.endpoint,
      expirationAt: null,
      p256dh: valid.keys.p256dh,
      auth: valid.keys.auth,
    });
  });

  it("rejects insecure, incomplete and oversized subscriptions", () => {
    for (const endpoint of [
      "http://push.example.test/subscriptions/abc",
      "https://127.0.0.1/subscriptions/abc",
      "https://push.example.test:8443/subscriptions/abc",
      "https://push.example.test/subscriptions/abc#fragment",
    ]) {
      expect(
        parseWebPushSubscription({
          ...valid,
          endpoint,
        }),
      ).toBeNull();
    }
    expect(
      parseWebPushSubscription({
        ...valid,
        keys: { p256dh: valid.keys.p256dh },
      }),
    ).toBeNull();
    expect(
      parseWebPushSubscription({
        ...valid,
        endpoint: `https://push.example.test/${"x".repeat(2100)}`,
      }),
    ).toBeNull();
  });

  it("rejects malformed P-256 and auth secrets", () => {
    const compressedMarker = new Uint8Array(65).fill(1);
    compressedMarker[0] = 0x02;

    expect(
      parseWebPushSubscription({
        ...valid,
        keys: {
          ...valid.keys,
          p256dh: base64Url(compressedMarker),
        },
      }),
    ).toBeNull();
    expect(
      parseWebPushSubscription({
        ...valid,
        keys: {
          ...valid.keys,
          p256dh: base64Url(new Uint8Array(64).fill(1)),
        },
      }),
    ).toBeNull();
    expect(
      parseWebPushSubscription({
        ...valid,
        keys: {
          ...valid.keys,
          auth: base64Url(new Uint8Array(15).fill(2)),
        },
      }),
    ).toBeNull();
    expect(
      parseWebPushSubscription({
        ...valid,
        keys: {
          p256dh: "***not-base64url***",
          auth: valid.keys.auth,
        },
      }),
    ).toBeNull();
  });

  it("rejects an already expired subscription", () => {
    expect(
      parseWebPushSubscription({
        ...valid,
        expirationTime: Date.now() - 60_000,
      }),
    ).toBeNull();
  });

  it("normalizes an expiration timestamp when supplied", () => {
    const expirationTime = Date.UTC(2030, 0, 1);
    expect(
      parseWebPushSubscription({ ...valid, expirationTime })?.expirationAt,
    ).toEqual(new Date(expirationTime));
  });
});

describe("Web Push VAPID public key validation", () => {
  it("accepts an uncompressed P-256 public key", () => {
    const key = p256Key();
    expect(parseWebPushVapidPublicKey(key)).toBe(key);
  });

  it("rejects wrong length, compressed markers and malformed base64url", () => {
    const compressedMarker = new Uint8Array(65).fill(3);
    compressedMarker[0] = 0x03;

    expect(
      parseWebPushVapidPublicKey(base64Url(new Uint8Array(64).fill(3))),
    ).toBeNull();
    expect(
      parseWebPushVapidPublicKey(base64Url(compressedMarker)),
    ).toBeNull();
    expect(parseWebPushVapidPublicKey("not+base64/value")).toBeNull();
    expect(parseWebPushVapidPublicKey(undefined)).toBeNull();
  });
});
