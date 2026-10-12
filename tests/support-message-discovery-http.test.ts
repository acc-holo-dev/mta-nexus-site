import { AppError } from "@nexus/domain";
import { NextRequest } from "next/server";
import { beforeEach, expect, it, vi } from "vitest";

const mock = vi.hoisted(() => ({ session: vi.fn(), rate: vi.fn(), page: vi.fn() }));
vi.mock("../apps/web/src/lib/services/auth-service", () => ({
  authService: { getSession: mock.session },
}));
vi.mock("@nexus/security", () => ({ consumeRateLimit: mock.rate }));
vi.mock("@nexus/db", () => ({ supportMessageDiscoveryRepository: { page: mock.page } }));

import { GET as download } from "../apps/web/src/app/api/support/[id]/messages/export/route";
import { GET } from "../apps/web/src/app/api/support/[id]/messages/route";
import { supportMessageCopy } from "../apps/web/src/lib/support-message-discovery-copy";

const id = `sup_${"a".repeat(24)}`,
  messageId = `spm_${"b".repeat(24)}`,
  stamp = "2026-10-12T00:00:00.123456Z",
  context = { params: Promise.resolve({ id }) };
const value = {
  supportCase: { id, subject: "Private conversation", status: "open" },
  items: [
    {
      id: messageId,
      authorRole: "requester",
      body: "Private text",
      truncated: false,
      createdAt: stamp,
    },
  ],
  until: stamp,
  olderCursor: null,
  newerCursor: null,
  focus: null,
};
const request = (query = "", locale = "ru") =>
  new NextRequest(`https://nexus.test/api/support/${id}/messages${query}`, {
    headers: { cookie: `nexus_session=test;nexus_locale=${locale}` },
  });
const privateResponse = (r: Response) => {
  expect(r.headers.get("cache-control")).toBe("private, no-store");
  expect(r.headers.get("vary")).toBe("Cookie");
  expect(r.headers.get("x-request-id")).toBeTruthy();
};
beforeEach(() => {
  vi.resetAllMocks();
  mock.session.mockResolvedValue({ id: "owner", role: "user" });
  mock.rate.mockResolvedValue({ success: true });
  mock.page.mockResolvedValue(value);
});
it("binds the read to the session actor and exact case, roles and literal search", async () => {
  const response = await GET(request("?group=staff&q=100%25_"), context);
  expect(response.status).toBe(200);
  privateResponse(response);
  expect(await response.json()).toEqual(value);
  expect(mock.page).toHaveBeenCalledExactlyOnceWith(
    id,
    "owner",
    { group: "staff", query: "100%_", until: undefined, focus: undefined, cursor: undefined },
    false,
  );
});
it("downloads only the displayed private page with preserved cutoff and safe headers", async () => {
  mock.page.mockResolvedValue({ ...value, focus: messageId });
  const response = await download(request(`?until=${stamp}&focus=${messageId}`), context);
  expect(response.status).toBe(200);
  privateResponse(response);
  expect(response.headers.get("content-disposition")).toBe(
    'attachment; filename="support-messages.json"',
  );
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(await response.json()).toEqual({ ...value, focus: messageId });
  expect(mock.page.mock.calls[0][2]).toMatchObject({ until: stamp, focus: messageId });
});
it.each(["?requesterId=victim", "?q=x&q=y", "?group=owner", "?cursor=bad", `?q=${"x".repeat(81)}`])(
  "rejects unsafe inputs before repository work %s",
  async (query) => {
    const response = await GET(request(query), context);
    expect(response.status).toBe(400);
    privateResponse(response);
    expect((await response.json()).error).toBe(supportMessageCopy("ru").invalid);
    expect(mock.page).not.toHaveBeenCalled();
  },
);
it("rejects anonymous access, invalid case identifiers and exhausted search rates", async () => {
  mock.session.mockResolvedValue(null);
  expect((await GET(request(), context)).status).toBe(401);
  mock.session.mockResolvedValue({ id: "owner" });
  expect((await GET(request(), { params: Promise.resolve({ id: "../secret" }) })).status).toBe(404);
  mock.rate.mockResolvedValue({ success: false });
  expect((await GET(request(), context)).status).toBe(429);
  expect(mock.page).not.toHaveBeenCalled();
});
it.each(["ru", "en"])(
  "localizes expired and missing message reads without error attachments in %s",
  async (locale) => {
    mock.page.mockRejectedValue(
      new AppError("private anchor details", 410, "SUPPORT_MESSAGES_EXPIRED"),
    );
    const response = await download(request("", locale), context);
    expect(response.status).toBe(410);
    privateResponse(response);
    expect(response.headers.get("content-disposition")).toBeNull();
    expect((await response.json()).error).toBe(supportMessageCopy(locale as "ru" | "en").expired);
    mock.page.mockRejectedValue(
      new AppError("private case details", 404, "SUPPORT_MESSAGE_NOT_FOUND"),
    );
    expect((await (await GET(request("", locale), context)).json()).error).toBe(
      supportMessageCopy(locale as "ru" | "en").missing,
    );
  },
);
it.each([
  { items: Array(21).fill(value.items[0]) },
  { items: [{ ...value.items[0], authorId: "private-id" }] },
  { items: [{ ...value.items[0], createdAt: "invalid" }] },
  { relatedId: "private-order" },
  { items: [{ ...value.items[0], body: "x".repeat(4001) }] },
])("fails closed on malformed or overbroad storage output %j", async (extra) => {
  mock.page.mockResolvedValue({ ...value, ...extra });
  const response = await download(request(), context);
  expect(response.status).toBe(503);
  expect(response.headers.get("content-disposition")).toBeNull();
  expect(await response.text()).not.toMatch(/private-id|private-order|ZodError/u);
});
it("does not expose unexpected storage errors", async () => {
  mock.page.mockRejectedValue(new Error("database credential secret"));
  const response = await GET(request(), context);
  expect(response.status).toBe(503);
  privateResponse(response);
  expect(await response.text()).not.toContain("credential");
});
