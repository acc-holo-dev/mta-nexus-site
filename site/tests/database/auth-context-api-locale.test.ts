import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authContextApiCopy } from "../../src/features/accounts/auth-context-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  getSessionIdentity: vi.fn(),
  switchContext: vi.fn(),
  rate: vi.fn(),
  listOwnedByUser: vi.fn(),
  listUserMemberships: vi.fn(),
  findSummariesByIds: vi.fn(),
  findUserContext: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
    getSessionIdentity: mocks.getSessionIdentity,
    switchContext: mocks.switchContext,
    listOwnedOrganizations: mocks.listOwnedByUser,
    listUserMemberships: mocks.listUserMemberships,
    findOrganizationSummariesByIds: mocks.findSummariesByIds,
    findUserOrganizationContext: mocks.findUserContext,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
}));

import { GET, POST } from "../../src/app/api/auth/context/route";

function getRequest(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/auth/context", {
    headers: { cookie: `nexus_session=tok;nexus_locale=${locale}` },
  });
}

function postRequest(locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest("https://nexus.test/api/auth/context", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("auth context API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getSession.mockResolvedValue({ id: "usr_ctx", displayName: "Ctx" });
    mocks.getSessionIdentity.mockResolvedValue({
      user: { id: "usr_ctx" },
      sessionId: "sess",
    });
    mocks.rate.mockResolvedValue({ success: true });
    mocks.listOwnedByUser.mockResolvedValue([]);
    mocks.listUserMemberships.mockResolvedValue([]);
    mocks.findSummariesByIds.mockResolvedValue([]);
  });

  it("returns bilingual GET 401 from nexus_locale", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const ru = await GET(getRequest("ru"));
    expect(ru.status).toBe(401);
    expect(await ru.json()).toMatchObject({
      error: authContextApiCopy("ru").authenticationRequired,
    });
  });

  it("returns bilingual POST ACTOR_CHANGED from nexus_locale", async () => {
    const en = await POST(
      postRequest("en", { contextId: "personal", expectedActorId: "usr_other" }),
    );
    expect(en.status).toBe(409);
    expect(await en.json()).toMatchObject({
      code: "ACTOR_CHANGED",
      error: authContextApiCopy("en").accountChanged,
    });

    const ru = await POST(
      postRequest("ru", { contextId: "personal", expectedActorId: "usr_other" }),
    );
    expect(ru.status).toBe(409);
    expect(await ru.json()).toMatchObject({
      code: "ACTOR_CHANGED",
      error: authContextApiCopy("ru").accountChanged,
    });
    expect(mocks.switchContext).not.toHaveBeenCalled();
  });
});
