import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationMarkReadApiCopy } from "../../src/features/notifications/notification-mark-read-api-copy";
import {
  browserMutationHeaders,
  stubBrowserMutationOrigin,
} from "../helpers/browser-mutation-headers";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  rate: vi.fn(),
  markAsRead: vi.fn(),
  markAllAsRead: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("@nexus/db", () => ({
  notificationRepository: {
    markAsRead: mocks.markAsRead,
    markAllAsRead: mocks.markAllAsRead,
  },
}));

vi.mock("@nexus/security", () => ({
  consumeRateLimit: mocks.rate,
}));

import { POST } from "../../src/app/api/notifications/mark-read/route";

function request(locale: "en" | "ru", body: string) {
  return new NextRequest("https://nexus.test/api/notifications/mark-read", {
    method: "POST",
    headers: {
      ...browserMutationHeaders(),
      cookie: `nexus_session=tok;nexus_locale=${locale}`,
      "content-type": "text/plain",
    },
    body,
  });
}

describe("notification mark-read API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    stubBrowserMutationOrigin();
    mocks.getSession.mockResolvedValue({ id: "usr_n" });
    mocks.rate.mockResolvedValue({ success: true });
  });

  it("returns bilingual auth and invalid-target errors from nexus_locale", async () => {
    mocks.getSession.mockResolvedValueOnce(null);
    const unauth = await POST(request("ru", "{}"));
    expect(unauth.status).toBe(401);
    expect(await unauth.json()).toMatchObject({
      error: notificationMarkReadApiCopy("ru").unauthorized,
    });

    const invalid = await POST(request("en", "not-json"));
    expect(invalid.status).toBe(400);
    expect(await invalid.json()).toMatchObject({
      error: notificationMarkReadApiCopy("en").invalidTarget,
    });
  });
});
