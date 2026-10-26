import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { browserMutationHeaders, stubBrowserMutationOrigin } from "./browser-mutation-headers";

const state = vi.hoisted(() => ({
  session: vi.fn(),
  page: vi.fn(),
  command: vi.fn(),
  rate: vi.fn(),
}));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: state.session },
}));
vi.mock("../apps/web/src/lib/services/notification-inbox-service", () => ({
  notificationInboxService: { page: state.page, command: state.command },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: state.rate }));

import { GET, PATCH } from "../apps/web/src/app/api/notifications/inbox/route";

const value = { isRead: true, items: [{ id: "owned", expectedIsRead: false }] };
const request = (
  method = "GET",
  body?: unknown,
  headers: Record<string, string> = {},
  query = "",
) =>
  new NextRequest(`https://nexus.test/api/notifications/inbox${query}`, {
    method,
    headers: {
      ...(method === "GET" ? {} : browserMutationHeaders()),
      cookie: "nexus_session=token; nexus_locale=ru",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
      ...headers,
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
beforeEach(() => {
  vi.clearAllMocks();
  stubBrowserMutationOrigin();
  state.session.mockResolvedValue({ id: "actor" });
  state.rate.mockResolvedValue({ success: true });
  state.page.mockResolvedValue({ items: [], unreadCount: 0, olderCursor: null, newerCursor: null });
  state.command.mockResolvedValue({ ids: ["owned"], isRead: true });
});
afterEach(() => {
  vi.unstubAllEnvs();
});
it("authenticates the history and keeps its response private with filters and locale", async () => {
  const response = await GET(
    request("GET", undefined, {}, "?q=word&state=unread&category=content"),
  );
  expect(response.status).toBe(200);
  expect(response.headers.get("cache-control")).toBe("private, no-store");
  expect(response.headers.get("vary")).toBe("Cookie");
  expect(state.page).toHaveBeenCalledWith(
    "actor",
    {
      query: "word",
      state: "unread",
      category: "content",
      period: "all",
      at: undefined,
      cursor: undefined,
    },
    "ru",
  );
});
it.each(["GET", "PATCH"])("requires a current session for %s", async (method) => {
  state.session.mockResolvedValue(null);
  const response = await (method === "GET" ? GET(request()) : PATCH(request("PATCH", value)));
  expect(response.status).toBe(401);
  expect(await response.text()).toContain("Войдите");
  expect(state.page).not.toHaveBeenCalled();
  expect(state.command).not.toHaveBeenCalled();
});
it("rejects cross-site commands before rate limiting or persistence", async () => {
  expect((await PATCH(request("PATCH", value, { "sec-fetch-site": "cross-site" }))).status).toBe(
    403,
  );
  expect(state.command).not.toHaveBeenCalled();
  expect(state.rate).not.toHaveBeenCalled();
});
it("passes only the authenticated recipient and a bounded explicit command", async () => {
  const response = await PATCH(request("PATCH", value));
  expect(response.status).toBe(200);
  expect(state.command).toHaveBeenCalledWith("actor", value);
});
it.each([
  null,
  {},
  { ...value, recipientId: "foreign" },
  { ...value, items: [] },
  { ...value, items: [{ id: "owned", expectedIsRead: "false" }] },
  {
    ...value,
    items: Array.from({ length: 26 }, (_, n) => ({ id: String(n), expectedIsRead: false })),
  },
])("refuses unsafe command %j", async (body) => {
  expect((await PATCH(request("PATCH", body))).status).toBe(400);
  expect(state.command).not.toHaveBeenCalled();
});
it("requires JSON and enforces a streamed byte limit before parsing", async () => {
  expect((await PATCH(request("PATCH", value, { "content-type": "text/plain" }))).status).toBe(415);
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode(" ".repeat(32769)));
      controller.close();
    },
  });
  const req = new NextRequest("https://nexus.test/api/notifications/inbox", {
    method: "PATCH",
    headers: {
      ...browserMutationHeaders(),
      "content-type": "application/json",
      cookie: "nexus_session=token; nexus_locale=ru",
    },
    body,
    duplex: "half",
  } as ConstructorParameters<typeof NextRequest>[1]);
  const response = await PATCH(req);
  expect(response.status).toBe(413);
  expect(await response.text()).toContain("Некорректные");
  expect(state.command).not.toHaveBeenCalled();
});
it("does not accept command query strings or malformed JSON", async () => {
  expect((await PATCH(request("PATCH", value, {}, "?scope=all"))).status).toBe(400);
  expect(
    (
      await PATCH(
        new NextRequest("https://nexus.test/api/notifications/inbox", {
          method: "PATCH",
          headers: {
            ...browserMutationHeaders(),
            "content-type": "application/json",
            cookie: "nexus_session=token",
          },
          body: "{",
        }),
      )
    ).status,
  ).toBe(400);
  expect(state.command).not.toHaveBeenCalled();
});
it.each(["GET", "PATCH"])("rate limits %s without reading or writing the inbox", async (method) => {
  state.rate.mockResolvedValue({ success: false });
  const response = await (method === "GET" ? GET(request()) : PATCH(request("PATCH", value)));
  expect(response.status).toBe(429);
  expect(state.page).not.toHaveBeenCalled();
  expect(state.command).not.toHaveBeenCalled();
});
it.each([
  [400, "INVALID_CURSOR"],
  [409, "NOTIFICATION_STATE_CHANGED"],
  [404, "NOT_FOUND"],
])("localizes failure %s/%s and hides internal details", async (status, code) => {
  state.command.mockRejectedValue(new AppError("PRIVATE_SQL", status, code));
  const response = await PATCH(request("PATCH", value));
  expect(response.status).toBe(status);
  const text = await response.text();
  expect(text).not.toContain("PRIVATE_SQL");
  expect(text).toContain(code);
});
it("returns a recoverable failure without pretending the inbox is empty", async () => {
  state.page.mockRejectedValue(new Error("PRIVATE_SQL"));
  const response = await GET(request());
  expect(response.status).toBe(503);
  const text = await response.text();
  expect(text).not.toContain("PRIVATE_SQL");
  expect(text).not.toContain("items");
});
