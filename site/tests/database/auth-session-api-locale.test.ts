import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authSessionApiCopy } from "../../src/features/accounts/auth-session-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  logout: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
    logout: mocks.logout,
  },
}));

import { DELETE, GET } from "../../src/app/api/auth/session/route";

function getRequest(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/auth/session", {
    headers: { cookie: `nexus_session=tok;nexus_locale=${locale}` },
  });
}

function deleteRequest(locale: "en" | "ru", body: Record<string, unknown>) {
  return new NextRequest("https://nexus.test/api/auth/session", {
    method: "DELETE",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

describe("auth session API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getSession.mockResolvedValue({ id: "usr_session", displayName: "Sess" });
    mocks.logout.mockResolvedValue(undefined);
  });

  it("returns bilingual GET 503 when session read fails", async () => {
    mocks.getSession.mockRejectedValueOnce(new Error("db down"));
    const ru = await GET(getRequest("ru"));
    expect(ru.status).toBe(503);
    expect(await ru.json()).toMatchObject({
      error: authSessionApiCopy("ru").checkUnavailable,
    });
  });

  it("returns bilingual DELETE ACTOR_CHANGED from nexus_locale", async () => {
    const en = await DELETE(deleteRequest("en", { expectedActorId: "usr_other" }));
    expect(en.status).toBe(409);
    expect(await en.json()).toMatchObject({
      code: "ACTOR_CHANGED",
      error: authSessionApiCopy("en").accountChanged,
    });

    const ru = await DELETE(deleteRequest("ru", { expectedActorId: "usr_other" }));
    expect(ru.status).toBe(409);
    expect(await ru.json()).toMatchObject({
      code: "ACTOR_CHANGED",
      error: authSessionApiCopy("ru").accountChanged,
    });
    expect(mocks.logout).not.toHaveBeenCalled();
  });
});
