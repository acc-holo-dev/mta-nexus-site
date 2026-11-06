import { NextRequest } from "next/server";
import { expect, it, vi } from "vitest";
import { userPlatformError } from "../apps/web/src/lib/user-platform-copy";
import { browserMutationHeaders } from "./browser-mutation-headers";

vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { createUserPlatformHttpAuthMock } = await import("./helpers/user-platform-http-harness");
  return createUserPlatformHttpAuthMock();
});
vi.mock("@nexus/db", async () => {
  const { createUserPlatformHttpDbMock } = await import("./helpers/user-platform-http-harness");
  return createUserPlatformHttpDbMock();
});
vi.mock("@nexus/security", async () => {
  const { createUserPlatformHttpSecurityMock } = await import(
    "./helpers/user-platform-http-harness"
  );
  return createUserPlatformHttpSecurityMock();
});

import {
  GET as profileGet,
  PATCH as profilePatch,
} from "../apps/web/src/app/api/account/profile/route";
import {
  installUserPlatformHttpHooks,
  userPlatformHttpMocks as mocks,
  userPlatformHttpNow as now,
  userPlatformHttpState as state,
} from "./helpers/user-platform-http-harness";

function request(method: string, body?: unknown, locale = "en", headers = {}) {
  return new NextRequest("http://nexus.test/api/account/profile", {
    method,
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=test; nexus_locale=${locale}`,
      "content-type": "application/json",
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

installUserPlatformHttpHooks();

it.each(["en", "ru"])("uses private cache and a safe account projection in %s", async (locale) => {
  const response = await profileGet(request("GET", undefined, locale));
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(await response.json()).toEqual({
    profile: {
      id: "usr_author",
      username: "author",
      displayName: "Writer",
      bio: "",
      avatarUrl: "",
      updatedAt: now.toISOString(),
    },
  });
});
it("allows only the editable profile fields and the session account", async () => {
  const fields = {
    displayName: "New name",
    bio: "New bio",
    avatarUrl: "https://images.example.test/avatar.png",
    expectedActorId: "usr_author",
    expectedUpdatedAt: now.toISOString(),
  };
  const response = await profilePatch(request("PATCH", fields));
  expect(response.status).toBe(200);
  expect(mocks.profile).toHaveBeenCalledWith(
    "usr_author",
    now,
    {
      displayName: fields.displayName,
      bio: fields.bio,
      avatarUrl: fields.avatarUrl,
    },
    "aud_generated",
    "test",
  );
  const data = await response.json();
  expect(data.profile).toMatchObject({ displayName: "New name", bio: "New bio" });
  expect(data.profile).not.toHaveProperty("email");
  expect(data.profile).not.toHaveProperty("passwordHash");
  expect((await profilePatch(request("PATCH", { ...fields, role: "admin" }))).status).toBe(422);
});
it("returns a conflict when profile version no longer matches", async () => {
  mocks.profile.mockResolvedValue(null);
  const response = await profilePatch(
    request("PATCH", {
      displayName: "Writer",
      bio: "",
      avatarUrl: "",
      expectedActorId: "usr_author",
      expectedUpdatedAt: now.toISOString(),
    }),
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "CONFLICT" });
});
it.each(["en", "ru"])(
  "rejects a switched account even when profile versions match in %s",
  async (locale) => {
    const original = await profileGet(request("GET", undefined, locale));
    const { profile } = await original.json();
    state.user = { ...state.user, id: "usr_other", username: "other", updatedAt: now };
    const response = await profilePatch(
      request(
        "PATCH",
        {
          displayName: "Draft from first account",
          bio: "",
          avatarUrl: "",
          expectedActorId: profile.id,
          expectedUpdatedAt: profile.updatedAt,
        },
        locale,
      ),
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.code).toBe("ACCOUNT_CHANGED");
    expect(body.error).toBe(userPlatformError(locale as "en" | "ru", "ACCOUNT_CHANGED"));
    expect(mocks.profile).not.toHaveBeenCalled();
  },
);
it("fails closed for old clients without the account precondition", async () => {
  const response = await profilePatch(
    request("PATCH", {
      displayName: "Draft",
      bio: "",
      avatarUrl: "",
      expectedUpdatedAt: now.toISOString(),
    }),
  );
  expect(response.status).toBe(422);
  expect(mocks.profile).not.toHaveBeenCalled();
});
