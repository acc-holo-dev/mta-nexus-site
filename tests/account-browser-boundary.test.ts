import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const authService = vi.hoisted(() => ({
  getSession: vi.fn(async () => ({ id: "usr_owner", role: "user" })),
}));
const consumeRateLimit = vi.hoisted(() => vi.fn(async () => ({ success: true })));
const publicProfileService = vi.hoisted(() => ({
  update: vi.fn(async () => ({ id: "usr_owner", displayName: "Owner" })),
}));
const profilePrivacyService = vi.hoisted(() => ({
  own: vi.fn(async () => ({ id: "usr_owner", showActivity: true })),
  update: vi.fn(async () => ({ id: "usr_owner", showActivity: false })),
}));
const verificationWorkspaceService = vi.hoisted(() => ({
  ownProfile: vi.fn(async () => ({ id: "usr_owner" })),
  updateProfile: vi.fn(async () => ({ id: "usr_owner", specialties: ["Lua"] })),
}));

vi.mock("../apps/web/src/lib/services/auth-service", () => ({ authService }));
vi.mock("@nexus/security", () => ({ consumeRateLimit }));
vi.mock("../apps/web/src/lib/services/public-profile-service", () => ({
  publicProfileService,
  editableProfile: (user: { id: string }) => ({ id: user.id }),
}));
vi.mock("../apps/web/src/lib/services/profile-privacy-service", () => ({
  profilePrivacyService,
}));
vi.mock("../apps/web/src/lib/services/verification-workspace-service", () => ({
  verificationWorkspaceService,
}));

import {
  GET as profileGet,
  PATCH as profilePatch,
} from "../apps/web/src/app/api/account/profile/route";
import {
  GET as privacyGet,
  PATCH as privacyPatch,
} from "../apps/web/src/app/api/account/privacy/route";
import { PATCH as developerPatch } from "../apps/web/src/app/api/account/developer/route";

const profileBody = {
  displayName: "Owner",
  bio: "Public bio",
  avatarUrl: "",
  expectedUpdatedAt: "2026-10-10T12:00:00.000Z",
};
const privacyBody = {
  showActivity: false,
  showProfessionalContacts: false,
  expectedUpdatedAt: "2026-10-10T00:00:00.000Z",
};
const developerBody = {
  specialties: ["Lua"],
  githubUrl: "https://github.com/example",
  discordTag: "dev",
  expectedUpdatedAt: "2026-10-10T00:00:00.000Z",
};

const mutations = [
  ["profile", profilePatch, profileBody, () => publicProfileService.update],
  ["privacy", privacyPatch, privacyBody, () => profilePrivacyService.update],
  ["developer", developerPatch, developerBody, () => verificationWorkspaceService.updateProfile],
] as const;

function request(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
) {
  return new NextRequest(`https://nexus.test/api/account/${path}`, {
    method: "PATCH",
    headers: {
      cookie: "nexus_session=current",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function expectNoAccountWork() {
  expect(authService.getSession).not.toHaveBeenCalled();
  expect(consumeRateLimit).not.toHaveBeenCalled();
  expect(publicProfileService.update).not.toHaveBeenCalled();
  expect(profilePrivacyService.update).not.toHaveBeenCalled();
  expect(verificationWorkspaceService.updateProfile).not.toHaveBeenCalled();
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NODE_ENV", "production");
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://nexus.test");
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("account handlers enforce the browser boundary independently of Proxy", () => {
  it.each(mutations)(
    "rejects a missing Origin on %s before session, rate limit, or body reads",
    async (path, handler, body) => {
      const input = request(path, body);
      const response = await handler(input);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(response.headers.get("cache-control")).toBe("private, no-store");
      expect(response.headers.get("x-request-id")).toBeTruthy();
      expect(input.bodyUsed).toBe(false);
      expectNoAccountWork();
    },
  );

  it.each(mutations)(
    "rejects a cross-site Origin on %s even with a bearer token",
    async (path, handler, body) => {
      const input = request(path, body, {
        origin: "https://evil.test",
        authorization: "Bearer forged",
      });
      const response = await handler(input);
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({ code: "CSRF_REJECTED" });
      expect(input.bodyUsed).toBe(false);
      expectNoAccountWork();
    },
  );

  it.each(mutations)(
    "accepts a same-origin %s mutation and performs the account write",
    async (path, handler, body, write) => {
      const response = await handler(
        request(path, body, { origin: "https://nexus.test", "sec-fetch-site": "same-origin" }),
      );
      expect(response.status).toBe(200);
      expect(authService.getSession).toHaveBeenCalledOnce();
      expect(consumeRateLimit).toHaveBeenCalled();
      expect(write()).toHaveBeenCalledOnce();
    },
  );

  it("still allows safe account reads that omit Origin", async () => {
    const profile = await profileGet(
      new NextRequest("https://nexus.test/api/account/profile", {
        headers: { cookie: "nexus_session=current" },
      }),
    );
    const privacy = await privacyGet(
      new NextRequest("https://nexus.test/api/account/privacy", {
        headers: { cookie: "nexus_session=current" },
      }),
    );
    expect(profile.status).toBe(200);
    expect(privacy.status).toBe(200);
    expect(authService.getSession).toHaveBeenCalledTimes(2);
  });
});
