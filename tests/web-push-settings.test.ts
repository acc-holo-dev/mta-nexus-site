import { describe, expect, it } from "vitest";
import { parsePushServerState } from "../apps/web/src/components/web-push-settings";

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
