import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

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
    upsertWithResult: vi.fn(),
    removeForSession: vi.fn(),
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

vi.mock(
  "../../../../lib/services/web-push-endpoint-policy",
  () => ({
    parseWebPushEndpoint: vi.fn((value: string) => new URL(value)),
  }),
);

import { NextRequest } from "next/server";
import { GET } from "./route";

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
      configured: true,
      publicKey: "vapid-public-key",
      subscribed: true,
    });

    const different = await GET(
      request(
        fingerprint(
          "https://push.example.net/subscriptions/not-this-browser",
        ),
      ),
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
