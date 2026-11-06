import { expect, it, vi } from "vitest";

vi.mock("../apps/web/src/lib/services/auth-service", async () => {
  const { userPlatformHttpState } = await import("./helpers/user-platform-http-harness");
  return {
    authService: { getSession: async () => userPlatformHttpState.user },
  };
});

vi.mock("@nexus/db", async () => {
  const { userPlatformHttpMocks } = await import("./helpers/user-platform-http-harness");
  return {
    authorContentRepository: {
      findAuthored: userPlatformHttpMocks.find,
      mutate: userPlatformHttpMocks.mutate,
      pageByAuthor: userPlatformHttpMocks.page,
    },
    contentRepository: { createWithAudit: userPlatformHttpMocks.create },
    userRepository: { updatePublicProfile: userPlatformHttpMocks.profile },
  };
});

vi.mock("@nexus/security", async () => {
  const { userPlatformHttpMocks } = await import("./helpers/user-platform-http-harness");
  return {
    consumeRateLimit: userPlatformHttpMocks.rate,
    generateId: (prefix: string) => `${prefix}_generated`,
  };
});

import {
  GET as profileGet,
  PATCH as profilePatch,
} from "../apps/web/src/app/api/account/profile/route";
import { DELETE as archive } from "../apps/web/src/app/api/workspace/content/[id]/route";
import { POST as create } from "../apps/web/src/app/api/workspace/content/route";
import { userPlatformError } from "../apps/web/src/lib/user-platform-copy";
import {
  installUserPlatformHttpLifecycle,
  userPlatformHttpContentContext as contentContext,
  userPlatformHttpContentInput,
  userPlatformHttpMocks,
  userPlatformHttpNow,
  userPlatformHttpRequest,
  userPlatformHttpState,
} from "./helpers/user-platform-http-harness";

installUserPlatformHttpLifecycle();

it.each(["en", "ru"])("uses private cache and a safe account projection in %s", async (locale) => {
  const response = await profileGet(userPlatformHttpRequest("GET", undefined, locale));
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
      updatedAt: userPlatformHttpNow.toISOString(),
    },
  });
});
it("allows only the editable profile fields and the session account", async () => {
  const fields = {
    displayName: "New name",
    bio: "New bio",
    avatarUrl: "https://images.example.test/avatar.png",
    expectedActorId: "usr_author",
    expectedUpdatedAt: userPlatformHttpNow.toISOString(),
  };
  const response = await profilePatch(userPlatformHttpRequest("PATCH", fields));
  expect(response.status).toBe(200);
  expect(userPlatformHttpMocks.profile).toHaveBeenCalledWith(
    "usr_author",
    userPlatformHttpNow,
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
  expect(
    (await profilePatch(userPlatformHttpRequest("PATCH", { ...fields, role: "admin" }))).status,
  ).toBe(422);
});
it("returns a conflict when profile version no longer matches", async () => {
  userPlatformHttpMocks.profile.mockResolvedValue(null);
  const response = await profilePatch(
    userPlatformHttpRequest("PATCH", {
      displayName: "Writer",
      bio: "",
      avatarUrl: "",
      expectedActorId: "usr_author",
      expectedUpdatedAt: userPlatformHttpNow.toISOString(),
    }),
  );
  expect(response.status).toBe(409);
  expect(await response.json()).toMatchObject({ code: "CONFLICT" });
});
it.each(["en", "ru"])(
  "rejects a switched account even when profile versions match in %s",
  async (locale) => {
    const original = await profileGet(userPlatformHttpRequest("GET", undefined, locale));
    const { profile } = await original.json();
    userPlatformHttpState.user = {
      ...userPlatformHttpState.user,
      id: "usr_other",
      username: "other",
      updatedAt: userPlatformHttpNow,
    };
    const response = await profilePatch(
      userPlatformHttpRequest(
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
    expect(userPlatformHttpMocks.profile).not.toHaveBeenCalled();
  },
);
it("fails closed for old clients without the account precondition", async () => {
  const response = await profilePatch(
    userPlatformHttpRequest("PATCH", {
      displayName: "Draft",
      bio: "",
      avatarUrl: "",
      expectedUpdatedAt: userPlatformHttpNow.toISOString(),
    }),
  );
  expect(response.status).toBe(422);
  expect(userPlatformHttpMocks.profile).not.toHaveBeenCalled();
});
it("enforces rates before reading or writing publication data", async () => {
  userPlatformHttpMocks.rate.mockResolvedValue({ success: false });
  expect((await create(userPlatformHttpRequest("POST", userPlatformHttpContentInput))).status).toBe(
    429,
  );
  expect((await archive(userPlatformHttpRequest("DELETE", {}, "ru"), contentContext)).status).toBe(
    429,
  );
  expect(userPlatformHttpMocks.create).not.toHaveBeenCalled();
  expect(userPlatformHttpMocks.mutate).not.toHaveBeenCalled();
});
it("rejects cross-site commands and non-JSON bodies", async () => {
  expect(
    (
      await create(
        userPlatformHttpRequest("POST", userPlatformHttpContentInput, "en", {
          "sec-fetch-site": "cross-site",
        }),
      )
    ).status,
  ).toBe(403);
  expect(
    (
      await create(
        userPlatformHttpRequest("POST", userPlatformHttpContentInput, "en", {
          "content-type": "text/plain",
        }),
      )
    ).status,
  ).toBe(415);
  expect(userPlatformHttpMocks.create).not.toHaveBeenCalled();
});
it("enforces the streamed byte ceiling independently of Content-Length", async () => {
  expect(
    (
      await create(
        userPlatformHttpRequest("POST", {
          ...userPlatformHttpContentInput,
          body: "a".repeat(140_000),
        }),
      )
    ).status,
  ).toBe(413);
  expect(userPlatformHttpMocks.create).not.toHaveBeenCalled();
});
