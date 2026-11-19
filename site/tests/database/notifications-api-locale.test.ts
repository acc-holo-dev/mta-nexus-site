import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { notificationsApiCopy } from "../../src/features/notifications/notifications-api-copy";

const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  listByUser: vi.fn(),
  countUnread: vi.fn(),
}));

vi.mock("../../src/lib/services/accounts/auth-service", () => ({
  authService: {
    getSession: mocks.getSession,
  },
}));

vi.mock("@nexus/db", () => ({
  notificationRepository: {
    listByUser: mocks.listByUser,
    countUnread: mocks.countUnread,
  },
}));

import { GET } from "../../src/app/api/notifications/route";

function request(locale: "en" | "ru") {
  return new NextRequest("https://nexus.test/api/notifications", {
    headers: { cookie: `nexus_session=tok;nexus_locale=${locale}` },
  });
}

describe("notifications list API locale envelope", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getSession.mockResolvedValue({ id: "usr_n" });
    mocks.listByUser.mockResolvedValue([]);
    mocks.countUnread.mockResolvedValue(0);
  });

  it("returns bilingual fetch-failed 500 from nexus_locale", async () => {
    mocks.listByUser.mockRejectedValueOnce(new Error("db unavailable"));
    const ru = await GET(request("ru"));
    expect(ru.status).toBe(500);
    const ruBody = await ru.json();
    expect(ruBody).toMatchObject({
      error: notificationsApiCopy("ru").fetchFailed,
    });
    expect(JSON.stringify(ruBody)).not.toContain("db unavailable");

    mocks.listByUser.mockRejectedValueOnce(new Error("db unavailable"));
    const en = await GET(request("en"));
    expect(en.status).toBe(500);
    const enBody = await en.json();
    expect(enBody).toMatchObject({
      error: notificationsApiCopy("en").fetchFailed,
    });
    expect(JSON.stringify(enBody)).not.toContain("db unavailable");
  });
});
