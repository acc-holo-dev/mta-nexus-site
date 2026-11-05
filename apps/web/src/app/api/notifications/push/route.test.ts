import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../../../../../../../tests/browser-mutation-headers";

const state = vi.hoisted(() => ({
  endpoints: [
    "https://push.example.net/subscriptions/current",
    "https://push.example.net/subscriptions/other",
  ],
}));

vi.mock("@nexus/config", () => ({
  readWebPushVapidConfig: vi.fn(() => ({
    publicKey: "vapid-public-key",
    privateKey: "private-key",
    subject: "mailto:ops@nexus.example.com",
  })),
}));

vi.mock("@nexus/db", () => ({
  webPushSubscriptionRepository: {
    listForSession: vi.fn(async () =>
      state.endpoints.map((endpoint, index) => ({
        id: `wps_${index}`,
        userId: "usr_1",
        sessionId: "ses_1",
        endpoint,
      })),
    ),
    upsertAuthenticated: vi.fn(),
    removeAuthenticated: vi.fn(),
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: vi.fn(async () => ({ success: true })),
  generateId: vi.fn((prefix: string) => `${prefix}_test`),
}));

vi.mock("../../../../lib/services/auth-service", () => ({
  authService: {
    getSession: vi.fn(async () => ({ id: "usr_1" })),
    getSessionIdentity: vi.fn(async () => ({ user: { id: "usr_1" }, sessionId: "ses_1" })),
    getCurrentSessionId: vi.fn(async () => "ses_1"),
  },
}));

vi.mock("../../../../lib/web-push-subscription", () => ({
  parseWebPushSubscription: vi.fn(),
}));

vi.mock("../../../../lib/services/web-push-endpoint-policy", () => ({
  parseWebPushEndpoint: vi.fn((value: string) => new URL(value)),
}));

import { webPushSubscriptionRepository } from "@nexus/db";
import { UnauthorizedError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { parseWebPushSubscription } from "../../../../lib/web-push-subscription";
import { DELETE, GET, POST } from "./route";

function fingerprint(endpoint: string) {
  return createHash("sha256").update(endpoint, "utf8").digest("hex");
}

function request(endpointHash?: string) {
  const url = new URL("https://nexus.test/api/notifications/push");
  if (endpointHash) url.searchParams.set("endpointHash", endpointHash);
  const result = new NextRequest(url);
  result.cookies.set("nexus_session", "session-token");
  return result;
}

describe("Web Push exact subscription status", () => {
  it("reports subscribed only for the current browser endpoint fingerprint", async () => {
    const matching = await GET(request(fingerprint(state.endpoints[0])));
    expect(matching.status).toBe(200);
    expect(matching.headers.get("Cache-Control")).toBe("private, no-store");
    expect(await matching.json()).toEqual({
      actorId: "usr_1",
      sessionId: "ses_1",
      configured: true,
      publicKey: "vapid-public-key",
      subscribed: true,
    });

    const different = await GET(
      request(fingerprint("https://push.example.net/subscriptions/not-this-browser")),
    );
    expect(different.status).toBe(200);
    expect(await different.json()).toMatchObject({
      subscribed: false,
    });
  });

  it("does not infer subscription state when the browser has no local endpoint", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      configured: true,
      subscribed: false,
    });
  });

  it("rejects malformed endpoint fingerprints before repository lookup", async () => {
    const response = await GET(request("not-a-sha256"));
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: "Invalid Web Push endpoint fingerprint",
    });
  });
});

describe("Web Push mutation body boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
  });
  afterEach(() => vi.unstubAllEnvs());

  it.each([
    ["POST", POST],
    ["DELETE", DELETE],
  ] as const)(
    "rejects non-JSON and oversized %s bodies before storage",
    async (method, handler) => {
      const makeRequest = (contentType: string, body: string) =>
        new NextRequest("https://nexus.test/api/notifications/push", {
          method,
          headers: {
            ...browserMutationHeaders(),
            "content-type": contentType,
            cookie: "nexus_session=session-token",
          },
          body,
        });
      const wrongMedia = await handler(makeRequest("text/plain", "{}"));
      expect(wrongMedia.status).toBe(415);
      expect(await wrongMedia.json()).toMatchObject({ code: "UNSUPPORTED_MEDIA_TYPE" });

      const oversized = await handler(
        makeRequest("application/json", JSON.stringify({ value: "x".repeat(16384) })),
      );
      expect(oversized.status).toBe(413);
      expect(await oversized.json()).toMatchObject({ code: "REQUEST_BODY_TOO_LARGE" });
      expect(oversized.headers.get("cache-control")).toBe("private, no-store");
      expect(webPushSubscriptionRepository.upsertAuthenticated).not.toHaveBeenCalled();
      expect(webPushSubscriptionRepository.removeAuthenticated).not.toHaveBeenCalled();
    },
  );

  it.each([
    ["POST", POST],
    ["DELETE", DELETE],
  ] as const)(
    "returns private 401 if the initiating session is no longer valid during %s",
    async (method, handler) => {
      vi.mocked(parseWebPushSubscription).mockReturnValue({
        endpoint: state.endpoints[0],
        p256dh: "key",
        auth: "auth",
        expirationAt: null,
      });
      const mutate =
        method === "POST"
          ? webPushSubscriptionRepository.upsertAuthenticated
          : webPushSubscriptionRepository.removeAuthenticated;
      vi.mocked(mutate).mockRejectedValueOnce(new UnauthorizedError("Authentication required"));
      const result = await handler(
        new NextRequest("https://nexus.test/api/notifications/push", {
          method,
          headers: {
            ...browserMutationHeaders(),
            cookie: "nexus_session=secret-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            expectedActorId: "usr_1",
            expectedSessionId: "ses_1",
            endpoint: state.endpoints[0],
          }),
        }),
      );
      expect(result.status).toBe(401);
      expect(result.headers.get("cache-control")).toBe("private, no-store");
      expect(JSON.stringify(await result.json())).not.toContain("secret-token");
      expect(mutate).toHaveBeenCalledOnce();
    },
  );

  it.each([
    ["POST", POST],
    ["DELETE", DELETE],
  ] as const)(
    "rejects stale actor or session identity before %s storage",
    async (method, handler) => {
      const call = (body: unknown) =>
        handler(
          new NextRequest("https://nexus.test/api/notifications/push", {
            method,
            headers: {
              ...browserMutationHeaders(),
              cookie: "nexus_session=session-token",
              "content-type": "application/json",
            },
            body: JSON.stringify(body),
          }),
        );
      for (const body of [
        { expectedActorId: "usr_old", expectedSessionId: "ses_1", endpoint: state.endpoints[0] },
        { expectedActorId: "usr_1", expectedSessionId: "ses_old", endpoint: state.endpoints[0] },
      ]) {
        const response = await call(body);
        expect(response.status).toBe(409);
        expect(response.headers.get("cache-control")).toBe("private, no-store");
        expect(await response.json()).toMatchObject({ code: "PUSH_IDENTITY_CHANGED" });
      }
      expect((await call({ endpoint: state.endpoints[0] })).status).toBe(400);
      expect(webPushSubscriptionRepository.upsertAuthenticated).not.toHaveBeenCalled();
      expect(webPushSubscriptionRepository.removeAuthenticated).not.toHaveBeenCalled();
    },
  );
});
