import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ session: vi.fn(), exportPage: vi.fn(), rate: vi.fn() }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../apps/web/src/lib/services/notification-inbox-service", () => ({
  notificationInboxService: { exportPage: state.exportPage },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));

import { GET } from "../apps/web/src/app/api/notifications/inbox/export/route";

const at = "2026-10-13T00:00:00.123456Z";
const report = {
  version: 1,
  scope: "notification-inbox-page",
  items: [],
  hasOlder: false,
  hasNewer: false,
};
const request = (query = "", locale = "ru") =>
  new NextRequest(`https://nexus.test/api/notifications/inbox/export${query}`, {
    headers: { cookie: `nexus_session=token; nexus_locale=${locale}` },
  });
beforeEach(() => {
  vi.resetAllMocks();
  state.session.mockResolvedValue({ id: "actor" });
  state.rate.mockResolvedValue({ success: true });
  state.exportPage.mockResolvedValue(report);
});
it.each(["ru", "en"])(
  "exports only the authenticated account and current filters in %s with private download headers",
  async (locale) => {
    const response = await GET(
      request(`?period=7&at=${at}&q=topic&state=read&category=content`, locale),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(report);
    expect(state.exportPage).toHaveBeenCalledExactlyOnceWith(
      "actor",
      { query: "topic", state: "read", category: "content", period: "7", at, cursor: undefined },
      locale,
    );
    expect(state.rate).toHaveBeenCalledExactlyOnceWith("search", "notification-inbox:actor");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(response.headers.get("vary")).toBe("Cookie");
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="nexus-notification-page.json"',
    );
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  },
);
it("requires a current session before private data or rate-key lookup", async () => {
  state.session.mockResolvedValue(null);
  const response = await GET(request());
  expect(response.status).toBe(401);
  expect(response.headers.get("content-disposition")).toBeNull();
  expect(state.exportPage).not.toHaveBeenCalled();
  expect(state.rate).not.toHaveBeenCalled();
});
it.each([
  "?recipientId=foreign",
  "?format=csv",
  "?period=7&period=30",
  "?period=1",
  `?at=${at}`,
  "?cursor=%7B%7D",
])("rejects unsupported or foreign-scope query %s before data reads", async (query) => {
  const response = await GET(request(query));
  expect(response.status).toBe(400);
  expect(response.headers.get("content-disposition")).toBeNull();
  expect(state.exportPage).not.toHaveBeenCalled();
});
it("shares the history read rate budget and does not export on saturation", async () => {
  state.rate.mockResolvedValue({ success: false });
  const response = await GET(request());
  expect(response.status).toBe(429);
  expect(state.exportPage).not.toHaveBeenCalled();
  expect(response.headers.get("content-disposition")).toBeNull();
});
it.each([
  [413, "EXPORT_TOO_LARGE"],
  [400, "INVALID_CURSOR"],
] as const)(
  "returns a redacted localized %s/%s failure without a downloadable success",
  async (status, code) => {
    state.exportPage.mockRejectedValue(new AppError("PRIVATE_SQL", status, code));
    const response = await GET(request());
    expect(response.status).toBe(status);
    expect(response.headers.get("content-disposition")).toBeNull();
    const body = await response.json();
    expect(body.code).toBe(code);
    expect(body.error).toContain(code === "EXPORT_TOO_LARGE" ? "слишком велика" : "Некорректные");
    expect(JSON.stringify(body)).not.toContain("PRIVATE_SQL");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  },
);
it("does not turn a database failure into an empty exported inbox", async () => {
  state.exportPage.mockRejectedValue(Error("PRIVATE_SQL"));
  const response = await GET(request());
  expect(response.status).toBe(503);
  expect(response.headers.get("content-disposition")).toBeNull();
  const body = await response.json();
  expect(body).not.toHaveProperty("items");
  expect(JSON.stringify(body)).not.toContain("PRIVATE_SQL");
});
