import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { adminActionsApiCopy } from "../../src/features/moderation/admin-actions-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  can: vi.fn(),
  rate: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("@nexus/security", async () => {
  const actual = await vi.importActual<typeof import("@nexus/security")>("@nexus/security");
  return {
    ...actual,
    can: mocks.can,
    consumeRateLimit: mocks.rate,
  };
});

import { POST } from "../../src/app/api/admin/actions/route";

function request(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/admin/actions", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "application/json",
    },
    body: "{}",
  });
}

describe("admin actions API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getSession.mockResolvedValue(null);
    mocks.can.mockReturnValue(false);
    mocks.rate.mockResolvedValue({ success: true });
  });

  it("returns bilingual forbidden from nexus_locale", async () => {
    const ru = await POST(request("ru"));
    expect(ru.status).toBe(403);
    expect(await ru.json()).toMatchObject({
      error: adminActionsApiCopy("ru").forbidden,
    });

    mocks.getSession.mockResolvedValueOnce({
      id: "usr_mod",
      email: "mod@nexus.test",
      role: "moderator",
    });
    mocks.can.mockReturnValueOnce(true);
    mocks.rate.mockResolvedValueOnce({ success: false });
    const en = await POST(request("en"));
    expect(en.status).toBe(429);
    expect(await en.json()).toMatchObject({
      error: adminActionsApiCopy("en").rate,
    });
  });
});
