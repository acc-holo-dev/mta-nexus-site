import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authSessionsApiCopy } from "../../src/features/accounts/auth-sessions-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSessionIdentity: vi.fn(),
  listSessions: vi.fn(),
  revokeOtherSessions: vi.fn(),
  revokeSession: vi.fn(),
  rate: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSessionIdentity: mocks.getSessionIdentity,
    listSessions: mocks.listSessions,
    revokeOtherSessions: mocks.revokeOtherSessions,
    revokeSession: mocks.revokeSession,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
}));

import { DELETE, GET } from "../../src/app/api/auth/sessions/route";

function getRequest(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/auth/sessions", {
    headers: { cookie: `nexus_session=tok;nexus_locale=${locale}` },
  });
}

function deleteRequest(locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest("https://nexus.test/api/auth/sessions", {
    method: "DELETE",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("auth sessions API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getSessionIdentity.mockResolvedValue({
      user: { id: "usr_sessions" },
      sessionId: "sess_current",
    });
    mocks.listSessions.mockResolvedValue([]);
    mocks.rate.mockResolvedValue({ success: true });
  });

  it("returns bilingual GET 401 / 503 from nexus_locale", async () => {
    mocks.getSessionIdentity.mockResolvedValueOnce(null);
    const unauthorizedRu = await GET(getRequest("ru"));
    expect(unauthorizedRu.status).toBe(401);
    expect(await unauthorizedRu.json()).toMatchObject({
      error: authSessionsApiCopy("ru").authenticationRequired,
    });

    mocks.getSessionIdentity.mockRejectedValueOnce(new Error("db down"));
    const downRu = await GET(getRequest("ru"));
    expect(downRu.status).toBe(503);
    expect(await downRu.json()).toMatchObject({
      error: authSessionsApiCopy("ru").listUnavailable,
    });
  });

  it("returns bilingual DELETE account-changed from nexus_locale", async () => {
    const en = await DELETE(deleteRequest("en", { expectedActorId: "usr_other", allOther: true }));
    expect(en.status).toBe(409);
    expect(await en.json()).toMatchObject({
      error: authSessionsApiCopy("en").accountChanged,
    });

    const ru = await DELETE(deleteRequest("ru", { expectedActorId: "usr_other", allOther: true }));
    expect(ru.status).toBe(409);
    expect(await ru.json()).toMatchObject({
      error: authSessionsApiCopy("ru").accountChanged,
    });
  });
});
