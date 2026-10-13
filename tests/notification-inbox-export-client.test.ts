import { expect, it, vi } from "vitest";
import {
  fetchNotificationInboxExport,
  INBOX_EXPORT_FILE_NAME,
  INBOX_EXPORT_MAX_BYTES,
} from "../apps/web/src/lib/notification-inbox-export-client";

const filters = {
  query: "topic",
  state: "unread" as const,
  category: "content" as const,
};
const report = {
  version: 1,
  scope: "notification-inbox-page",
  locale: "en",
  filters: { ...filters, period: "all" },
  window: null,
  items: [
    {
      id: "own",
      title: "Title",
      message: "Message",
      category: "content",
      isRead: false,
      createdAt: "2026-10-13T00:00:00.123456Z",
      truncated: false,
    },
  ],
  hasOlder: false,
  hasNewer: false,
};
const headers = {
  "content-type": "application/json; charset=utf-8",
  "content-disposition": `attachment; filename="${INBOX_EXPORT_FILE_NAME}"`,
};
function response(value: unknown = report, extra: Record<string, string | undefined> = {}) {
  return new Response(JSON.stringify(value), {
    headers: { ...headers, ...extra },
  });
}
function fetchReport(reply: Response, overrides = {}) {
  return fetchNotificationInboxExport(
    { ...filters, ...overrides },
    "en",
    new AbortController().signal,
    vi.fn().mockResolvedValue(reply),
  );
}
it.each(["en", "ru"] as const)(
  "downloads a strictly validated private %s report",
  async (locale) => {
    const value = { ...report, locale };
    const request = vi.fn().mockResolvedValue(response(value));
    const signal = new AbortController().signal;
    const blob = await fetchNotificationInboxExport(filters, locale, signal, request);
    expect(JSON.parse(await blob.text())).toEqual(value);
    expect(blob.type).toBe("application/json");
    expect(request).toHaveBeenCalledExactlyOnceWith(
      "/api/notifications/inbox/export?q=topic&state=unread&category=content",
      {
        cache: "no-store",
        credentials: "same-origin",
        redirect: "error",
        signal,
      },
    );
  },
);
it("preserves the database window and cursor in the requested export", async () => {
  const from = "2026-10-06T00:00:00.123456Z",
    until = "2026-10-13T00:00:00.123456Z";
  const cursor = {
    id: "own",
    createdAt: until,
    direction: "older" as const,
    context: "a".repeat(64),
    version: 1 as const,
    asOf: until,
  };
  const value = {
    ...report,
    filters: { ...report.filters, period: "7" },
    window: { from, until },
  };
  const request = vi.fn().mockResolvedValue(response(value));
  await fetchNotificationInboxExport(
    { ...filters, period: "7", at: until, cursor },
    "en",
    new AbortController().signal,
    request,
  );
  const url = new URL(request.mock.calls[0][0], "https://nexus.test");
  expect(url.searchParams.get("at")).toBe(until);
  expect(JSON.parse(url.searchParams.get("cursor") ?? "")).toEqual(cursor);
  await expect(fetchReport(response(value), { period: "7", at: from })).rejects.toMatchObject({
    code: "EXPORT_FAILED",
  });
});
it.each([
  [401, "UNAUTHORIZED"],
  [403, "FORBIDDEN"],
  [404, "NOT_FOUND"],
  [400, "VALIDATION_ERROR"],
  [413, "EXPORT_TOO_LARGE"],
  [429, "RATE_LIMIT_EXCEEDED"],
  [503, "EXPORT_FAILED"],
] as const)("never saves an HTTP %s error", async (status, code) => {
  await expect(fetchReport(new Response("PRIVATE_ERROR", { status }))).rejects.toMatchObject({
    code,
  });
});
it.each([
  { "content-type": "text/html" },
  { "content-disposition": "attachment; filename=other.json" },
  { "content-length": "no" },
  { "content-length": "9007199254740992" },
  { "content-length": "1" },
])("rejects incorrect download headers %j", async (extra) => {
  await expect(fetchReport(response(report, extra))).rejects.toMatchObject({
    code: "EXPORT_FAILED",
  });
});
it.each([
  { ...report, items: [{ ...report.items[0], isRead: true }] },
  { ...report, items: [{ ...report.items[0], category: "security" }] },
  { ...report, items: [report.items[0], report.items[0]] },
  { ...report, locale: "ru" },
  { ...report, scope: "other" },
  { ...report, filters: { ...report.filters, query: "different" } },
  { ...report, filters: { ...report.filters, period: "7" } },
  { ...report, recipientId: "foreign" },
  { ...report, items: [{ ...report.items[0], link: "/private" }] },
  { ...report, items: Array.from({ length: 26 }, () => report.items[0]) },
])("rejects mismatched or expanded report contracts", async (value) => {
  await expect(fetchReport(response(value))).rejects.toMatchObject({
    code: "EXPORT_FAILED",
  });
});
it("rejects malformed JSON and invalid UTF-8", async () => {
  for (const bytes of [new TextEncoder().encode("{"), new Uint8Array([255])])
    await expect(fetchReport(new Response(bytes, { headers }))).rejects.toMatchObject({
      code: "EXPORT_FAILED",
    });
});
it("bounds declared and streamed decoded bytes independently", async () => {
  await expect(
    fetchReport(
      response(report, {
        "content-length": String(INBOX_EXPORT_MAX_BYTES + 1),
      }),
    ),
  ).rejects.toMatchObject({ code: "EXPORT_TOO_LARGE" });
  const cancel = vi.fn();
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(new Uint8Array(INBOX_EXPORT_MAX_BYTES));
      controller.enqueue(new Uint8Array(1));
    },
    cancel,
  });
  await expect(
    fetchReport(
      new Response(body, {
        headers: {
          ...headers,
          "content-length": "1",
          "content-encoding": "gzip",
        },
      }),
    ),
  ).rejects.toMatchObject({ code: "EXPORT_TOO_LARGE" });
  expect(cancel).toHaveBeenCalledTimes(1);
});
it("ignores compressed wire lengths but enforces decoded structure", async () => {
  const blob = await fetchReport(
    response(report, { "content-length": "1", "content-encoding": "gzip" }),
  );
  expect(JSON.parse(await blob.text())).toEqual(report);
});
it("rejects redirects and partial success responses", async () => {
  const redirected = response();
  Object.defineProperty(redirected, "redirected", { value: true });
  await expect(fetchReport(redirected)).rejects.toMatchObject({
    code: "EXPORT_FAILED",
  });
  await expect(
    fetchReport(new Response(JSON.stringify(report), { headers, status: 206 })),
  ).rejects.toMatchObject({ code: "EXPORT_FAILED" });
});
it("cancels a stalled reader on navigation without offering a partial file", async () => {
  const active = new AbortController(),
    cancel = vi.fn();
  const request = vi
    .fn()
    .mockResolvedValue(new Response(new ReadableStream({ cancel }), { headers }));
  const pending = fetchNotificationInboxExport(filters, "en", active.signal, request);
  const result = expect(pending).rejects.toMatchObject({ name: "AbortError" });
  await new Promise((resolve) => setImmediate(resolve));
  active.abort();
  await result;
  expect(cancel).toHaveBeenCalledTimes(1);
});
it("does not request an already aborted export", async () => {
  const active = new AbortController(),
    request = vi.fn();
  active.abort();
  await expect(
    fetchNotificationInboxExport(filters, "en", active.signal, request),
  ).rejects.toMatchObject({ name: "AbortError" });
  expect(request).not.toHaveBeenCalled();
});
