import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationPushApiCopy } from "../../src/features/notifications/notification-push-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSessionIdentity: vi.fn(),
  rate: vi.fn(),
  listForSession: vi.fn(),
  upsertAuthenticated: vi.fn(),
  removeAuthenticated: vi.fn(),
  generateId: vi.fn(),
  readVapid: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSessionIdentity: mocks.getSessionIdentity,
  },
}));

vi.mock("../../src/lib/services/notifications/notification-inbox-service", () => ({
  notificationInboxService: {
    listWebPushForSession: mocks.listForSession,
    upsertWebPushAuthenticated: mocks.upsertAuthenticated,
    removeWebPushAuthenticated: mocks.removeAuthenticated,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
  generateId: mocks.generateId,
}));

vi.mock("@nexus/config", () => ({
  readWebPushVapidConfig: mocks.readVapid,
}));

import { DELETE, GET, POST } from "../../src/app/api/notifications/push/route";

function getRequest(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/notifications/push", {
    headers: { cookie: `nexus_session=tok;nexus_locale=${locale}` },
  });
}

function postRequest(locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest("https://nexus.test/api/notifications/push", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function deleteRequest(locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest("https://nexus.test/api/notifications/push", {
    method: "DELETE",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("notification push API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getSessionIdentity.mockResolvedValue({
      user: { id: "usr_push" },
      sessionId: "ses_push",
    });
    mocks.rate.mockResolvedValue({ success: true });
    mocks.readVapid.mockReturnValue({ publicKey: "vapid_public" });
    mocks.generateId.mockReturnValue("wps_1");
  });

  it("returns bilingual GET auth error from nexus_locale", async () => {
    mocks.getSessionIdentity.mockResolvedValueOnce(null);
    const unauth = await GET(getRequest("ru"));
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({
      error: notificationPushApiCopy("ru").authenticationRequired,
    });
  });

  it("returns bilingual POST not-configured from nexus_locale", async () => {
    mocks.readVapid.mockReturnValueOnce(null);
    const response = await POST(
      postRequest("en", {
        expectedActorId: "usr_push",
        expectedSessionId: "ses_push",
      }),
    );
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({
      error: notificationPushApiCopy("en").notConfigured,
    });
  });

  it("returns bilingual DELETE identity-changed from nexus_locale", async () => {
    const response = await DELETE(
      deleteRequest("ru", {
        expectedActorId: "usr_other",
        expectedSessionId: "ses_push",
        endpoint: "https://push.example/endpoint",
      }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      code: "PUSH_IDENTITY_CHANGED",
      error: notificationPushApiCopy("ru").identityChanged,
    });
    expect(mocks.removeAuthenticated).not.toHaveBeenCalled();
  });
});
