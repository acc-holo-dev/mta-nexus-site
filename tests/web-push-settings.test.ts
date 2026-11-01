import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  applicationServerKey,
  derivePushStatus,
  endpointFingerprint,
  matchesApplicationServerKey,
  parsePushServerState,
  readBrowserPushCapability,
} from "../apps/web/src/components/web-push-settings";

describe("Web Push settings state parser", () => {
  it("accepts the exact server state contract", () => {
    expect(
      parsePushServerState({
        configured: true,
        publicKey: "public-key",
        subscribed: false,
      }),
    ).toEqual({
      configured: true,
      publicKey: "public-key",
      subscribed: false,
    });
    expect(
      parsePushServerState({
        configured: false,
        publicKey: null,
        subscribed: false,
      }),
    ).toEqual({
      configured: false,
      publicKey: null,
      subscribed: false,
    });
  });

  it("rejects ambiguous or malformed server state", () => {
    expect(parsePushServerState(null)).toBeNull();
    expect(parsePushServerState([])).toBeNull();
    expect(
      parsePushServerState({
        configured: "yes",
        publicKey: null,
        subscribed: false,
      }),
    ).toBeNull();
    expect(
      parsePushServerState({
        configured: true,
        publicKey: 123,
        subscribed: false,
      }),
    ).toBeNull();
    expect(
      parsePushServerState({
        configured: true,
        publicKey: "key",
        subscribed: 1,
      }),
    ).toBeNull();
  });
});

describe("Web Push endpoint fingerprint", () => {
  it("uses the canonical lowercase SHA-256 hex digest without exposing the endpoint", async () => {
    const endpoint = "https://push.example.net/subscriptions/high-entropy-capability";
    await expect(endpointFingerprint(endpoint)).resolves.toBe(
      createHash("sha256").update(endpoint, "utf8").digest("hex"),
    );
  });
});

describe("Web Push VAPID rotation detection", () => {
  it("matches the browser applicationServerKey bytes exactly", () => {
    const first =
      "BOD-Q0l2s6Fc4px7XK1T64eYh1t0DlmeMqksBXtxIYKi-gJ07CN8X8c7n8pE3aTsToHu41vWY1Fs9YVdG8MAB2Q";
    const second =
      "BHZ_wYx4LYtN1nlw0VQ5BfIgD7b7DUfC_4Z-22Ogw0SG9MvT7DzKluOVfsWD0aNcz7xEJ9EM3qd1CqcyukmBE24";

    const firstBytes = applicationServerKey(first);
    const firstBuffer = firstBytes.buffer.slice(
      firstBytes.byteOffset,
      firstBytes.byteOffset + firstBytes.byteLength,
    );

    expect(matchesApplicationServerKey(firstBuffer, first)).toBe(true);
    expect(matchesApplicationServerKey(firstBuffer, second)).toBe(false);
    expect(matchesApplicationServerKey(null, first)).toBe(false);
  });
});

describe("Web Push effective status contract", () => {
  it("keeps denied and unconfigured as distinct recovery states", () => {
    const serverConfigured = {
      configured: true,
      publicKey: "public-key",
      subscribed: false,
    };
    const serverUnconfigured = {
      configured: false,
      publicKey: null,
      subscribed: false,
    };
    expect(
      derivePushStatus(
        {
          supported: true,
          permission: "denied",
          hasLocalSubscription: false,
          keyMatches: null,
        },
        serverConfigured,
      ),
    ).toBe("denied");
    expect(
      derivePushStatus(
        {
          supported: true,
          permission: "default",
          hasLocalSubscription: false,
          keyMatches: null,
        },
        serverUnconfigured,
      ),
    ).toBe("unconfigured");
    expect(
      derivePushStatus(
        {
          supported: true,
          permission: "denied",
          hasLocalSubscription: false,
          keyMatches: null,
        },
        serverUnconfigured,
      ),
    ).toBe("unconfigured");
  });

  it("requires both browser subscription and server subscription for enabled", () => {
    expect(
      derivePushStatus(
        {
          supported: true,
          permission: "granted",
          hasLocalSubscription: true,
          keyMatches: true,
        },
        { configured: true, publicKey: "key", subscribed: true },
      ),
    ).toBe("enabled");
    expect(
      derivePushStatus(
        {
          supported: true,
          permission: "granted",
          hasLocalSubscription: false,
          keyMatches: null,
        },
        { configured: true, publicKey: "key", subscribed: true },
      ),
    ).toBe("disabled");
    expect(
      derivePushStatus(
        {
          supported: true,
          permission: "granted",
          hasLocalSubscription: true,
          keyMatches: true,
        },
        { configured: true, publicKey: "key", subscribed: false },
      ),
    ).toBe("disabled");
  });

  it("reads browser capability without requesting permission", () => {
    const capability = readBrowserPushCapability();
    expect(capability).toEqual(
      expect.objectContaining({
        supported: expect.any(Boolean),
        permission: expect.stringMatching(/^(unsupported|default|granted|denied)$/u),
      }),
    );
  });
});
