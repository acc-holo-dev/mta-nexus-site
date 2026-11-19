import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { verificationApiCopy } from "../../src/features/trust/verification-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  rate: vi.fn(),
  listByRequester: vi.fn(),
  findById: vi.fn(),
  listUserMemberships: vi.fn(),
  findPendingForTarget: vi.fn(),
  createRequest: vi.fn(),
  generateId: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("@nexus/db", () => ({
  verificationRepository: {
    listByRequester: mocks.listByRequester,
    findPendingForTarget: mocks.findPendingForTarget,
    createRequest: mocks.createRequest,
  },
  organizationRepository: {
    findById: mocks.findById,
    listUserMemberships: mocks.listUserMemberships,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
  generateId: mocks.generateId,
}));

import { GET, POST } from "../../src/app/api/verification/route";

function getRequest(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/verification", {
    headers: { cookie: `nexus_session=tok;nexus_locale=${locale}` },
  });
}

function postRequest(locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest("https://nexus.test/api/verification", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("verification API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getSession.mockResolvedValue({ id: "usr_ver", isVerified: false });
    mocks.rate.mockResolvedValue({ success: true });
    mocks.generateId.mockReturnValue("aud_1");
  });

  it("returns bilingual GET unauthorized from nexus_locale", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const unauth = await GET(getRequest("ru"));
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({
      error: verificationApiCopy("ru").unauthorized,
    });
    expect(mocks.listByRequester).not.toHaveBeenCalled();
  });

  it("returns bilingual POST server-challenge required from nexus_locale", async () => {
    const response = await POST(postRequest("en", { targetType: "server", targetId: "srv_1" }));
    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      code: "SERVER_CONTROL_CHALLENGE_REQUIRED",
      error: verificationApiCopy("en").serverChallengeRequired,
    });
  });

  it("returns bilingual POST own-profile-only from nexus_locale", async () => {
    const response = await POST(postRequest("ru", { targetType: "user", targetId: "usr_other" }));
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      error: verificationApiCopy("ru").ownProfileOnly,
    });
  });
});
