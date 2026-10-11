import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";
import { AppError } from "@nexus/domain";
import { profilePrivacyCopy } from "../apps/web/src/lib/profile-privacy-copy";
const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  rate: vi.fn(),
  own: vi.fn(),
  update: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mocks.session },
}));
vi.mock("../apps/web/src/lib/services/profile-privacy-service", () => ({
  profilePrivacyService: { own: mocks.own, update: mocks.update },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mocks.rate }));
import { GET, PATCH } from "../apps/web/src/app/api/account/privacy/route";
const actor = { id: "actor", role: "user" };
const input = {
  showActivity: false,
  showProfessionalContacts: false,
  expectedUpdatedAt: "2026-10-10T00:00:00.000Z",
};
const preferences = {
  id: "actor",
  username: "member",
  showActivity: false,
  showProfessionalContacts: false,
  updatedAt: "2026-10-10T00:00:00.001Z",
};
function request(method = "GET", body?: unknown, query = "", headers = {}) {
  return new NextRequest(`https://nexus.test/api/account/privacy${query}`, {
    method,
    headers: {
      cookie: "nexus_session=test;nexus_locale=ru",
      "content-type": "application/json",
      ...headers,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}
beforeEach(() => {
  vi.clearAllMocks();
  mocks.session.mockResolvedValue(actor);
  mocks.rate.mockResolvedValue({ success: true });
  mocks.own.mockResolvedValue(preferences);
  mocks.update.mockResolvedValue(preferences);
});
it("reads and saves only the live session actor and returns private confirmation headers", async () => {
  const read = await GET(request());
  expect(await read.json()).toEqual({ preferences });
  expect(mocks.own).toHaveBeenCalledWith(actor);
  const save = await PATCH(request("PATCH", input));
  expect(await save.json()).toEqual({ success: true, preferences });
  expect(mocks.update).toHaveBeenCalledWith(actor, input);
  for (const response of [read, save]) {
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("x-request-id")).toBeTruthy();
  }
});
it("denies anonymous reads and writes before accessing preferences", async () => {
  mocks.session.mockResolvedValue(null);
  for (const response of [await GET(request()), await PATCH(request("PATCH", input))]) {
    expect(response.status).toBe(401);
    expect((await response.json()).error).toBe(profilePrivacyCopy("ru").signIn);
  }
  expect(mocks.own).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});
it.each(["?userId=victim", "?id=actor", "?showActivity=false", "?q=a&q=b"])(
  "rejects injected scope or read filters %s",
  async (query) => {
    expect((await GET(request("GET", undefined, query))).status).toBe(400);
    expect((await PATCH(request("PATCH", input, query))).status).toBe(400);
    expect(mocks.own).not.toHaveBeenCalled();
    expect(mocks.update).not.toHaveBeenCalled();
  },
);
it.each([
  { ...input, actorId: "victim" },
  { ...input, role: "admin" },
  { ...input, expectedUpdatedAt: "invalid" },
  { ...input, showActivity: "false" },
  { showActivity: false, expectedUpdatedAt: input.expectedUpdatedAt },
])("rejects incomplete commands and authority injection %j", async (body) => {
  expect((await PATCH(request("PATCH", body))).status).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
it("requires same-site bounded JSON and rejects malformed JSON without writes", async () => {
  expect(
    (await PATCH(request("PATCH", input, "", { "sec-fetch-site": "cross-site" }))).status,
  ).toBe(403);
  expect((await PATCH(request("PATCH", input, "", { "content-type": "text/plain" }))).status).toBe(
    415,
  );
  expect((await PATCH(request("PATCH", { ...input, secret: "x".repeat(5000) }))).status).toBe(413);
  expect(
    (
      await PATCH(
        new NextRequest("https://nexus.test/api/account/privacy", {
          method: "PATCH",
          headers: { cookie: "nexus_session=test", "content-type": "application/json" },
          body: "{",
        }),
      )
    ).status,
  ).toBe(400);
  expect(mocks.update).not.toHaveBeenCalled();
});
it.each(["en", "ru"] as const)(
  "localizes stale and uncertain saves without exposing internal details in %s",
  async (locale) => {
    const headers = { cookie: `nexus_session=test;nexus_locale=${locale}` };
    mocks.update.mockRejectedValue(new AppError("private SQL", 409, "CONFLICT"));
    const conflict = await PATCH(request("PATCH", input, "", headers));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({
      code: "CONFLICT",
      error: profilePrivacyCopy(locale).conflict,
    });
    mocks.update.mockRejectedValue(new Error("private SQL"));
    const uncertain = await PATCH(request("PATCH", input, "", headers));
    expect(uncertain.status).toBe(503);
    expect((await uncertain.json()).error).toBe(profilePrivacyCopy(locale).uncertain);
    mocks.own.mockRejectedValue(new Error("private SQL"));
    expect((await (await GET(request("GET", undefined, "", headers))).json()).error).toBe(
      profilePrivacyCopy(locale).unavailable,
    );
  },
);
it("rate-limits reads and mutations before preferences work", async () => {
  mocks.rate.mockResolvedValue({ success: false });
  expect((await GET(request())).status).toBe(429);
  expect((await PATCH(request("PATCH", input))).status).toBe(429);
  expect(mocks.rate).toHaveBeenCalledWith("search", actor.id);
  expect(mocks.rate).toHaveBeenCalledWith("profileEditing", actor.id);
  expect(mocks.own).not.toHaveBeenCalled();
  expect(mocks.update).not.toHaveBeenCalled();
});
