import { beforeEach, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ page: vi.fn(), command: vi.fn() }));
vi.mock("@nexus/db", () => ({
  notificationRepository: { pageInbox: state.page, setInboxReadState: state.command },
}));

import { notificationInboxService } from "../apps/web/src/lib/services/notification-inbox-service";

const filters = { query: "", state: "all" as const, category: "all" as const };
const item = {
  id: "one",
  title: "Publication reaction",
  message: "Publication post: reaction.",
  link: "/articles/post",
  data: null,
  truncated: false,
  category: "content",
  isRead: false,
  createdAt: "2026-10-11T00:00:00.123456Z",
};
beforeEach(() => {
  vi.clearAllMocks();
  state.page.mockResolvedValue({
    items: [item],
    unreadCount: 1,
    olderCursor: "older",
    newerCursor: null,
  });
});
it("uses the current account and existing localized notification formatter without exposing raw data", async () => {
  const page = await notificationInboxService.page("actor", filters, "ru");
  expect(state.page).toHaveBeenCalledWith("actor", filters);
  expect(page.items[0].title).toBe("Реакция на публикацию");
  expect(page.items[0].message).toContain("Читатель");
  expect(page.items[0]).not.toHaveProperty("data");
  expect(page.items[0]).not.toHaveProperty("recipientId");
  expect(page.items[0].createdAt).toBe(item.createdAt);
});
it.each([
  "javascript:alert(1)",
  "//evil.test/x",
  "/\\evil.test",
  " /articles/post",
  "/articles/\npost",
])("removes unsafe stored destination %s", async (link) => {
  state.page.mockResolvedValue({
    items: [{ ...item, link }],
    unreadCount: 1,
    olderCursor: null,
    newerCursor: null,
  });
  expect((await notificationInboxService.page("actor", filters, "en")).items[0].link).toBeNull();
});
it.each(["/articles/post?comment=one#reply", "https://example.test/article"])(
  "preserves safe destination %s",
  async (link) => {
    state.page.mockResolvedValue({
      items: [{ ...item, link }],
      unreadCount: 1,
      olderCursor: null,
      newerCursor: null,
    });
    expect((await notificationInboxService.page("actor", filters, "en")).items[0].link).toBe(link);
  },
);
it("bounds Unicode output and explains truncation of localized structured data", async () => {
  state.page.mockResolvedValue({
    items: [
      {
        ...item,
        title: "Old",
        message: "Stored",
        data: {
          kind: "build_review",
          decision: "approve",
          resourceTitle: "😀".repeat(9000),
          version: "1",
          notes: "",
        },
      },
    ],
    unreadCount: 1,
    olderCursor: null,
    newerCursor: null,
  });
  const page = await notificationInboxService.page("actor", filters, "en");
  expect(Array.from(page.items[0].message)).toHaveLength(8192);
  expect(page.items[0].truncated).toBe(true);
  expect(page.items[0].message).not.toContain("\uFFFD");
});
it("rejects an unbounded command before the repository", async () => {
  await expect(
    notificationInboxService.command("actor", { isRead: true, items: [] }),
  ).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  expect(state.command).not.toHaveBeenCalled();
});
it.each(["ru", "en"] as const)(
  "exports a localized explicit own page in %s without private payloads, destination tokens or cursor context",
  async (locale) => {
    const window = { from: "2026-10-06T00:00:00.123456Z", until: "2026-10-13T00:00:00.123456Z" };
    state.page.mockResolvedValue({
      items: [
        {
          ...item,
          recipientId: "PRIVATE_RECIPIENT",
          link: "/destination?secret=PRIVATE_LINK",
          data: { PRIVATE_PUSH_DATA: "secret" },
        },
      ],
      window,
      unreadCount: 1,
      olderCursor: "PRIVATE_CONTEXT",
      newerCursor: null,
    });
    const query = { ...filters, period: "7" as const, at: window.until };
    const result = await notificationInboxService.exportPage("actor", query, locale);
    expect(state.page).toHaveBeenCalledExactlyOnceWith("actor", query);
    expect(state.command).not.toHaveBeenCalled();
    expect(result).toMatchObject({
      version: 1,
      scope: "notification-inbox-page",
      locale,
      filters: { ...filters, period: "7" },
      window,
      hasOlder: true,
      hasNewer: false,
    });
    expect(result.items[0].title).toBe(
      locale === "ru" ? "Реакция на публикацию" : "Publication reaction",
    );
    expect(Object.keys(result.items[0])).toEqual([
      "id",
      "title",
      "message",
      "category",
      "isRead",
      "createdAt",
      "truncated",
    ]);
    expect(JSON.stringify(result)).not.toMatch(/PRIVATE|recipientId|link|data|unreadCount|Cursor/);
  },
);
it("exports a valid empty page without inventing notices or a selected-only scope", async () => {
  state.page.mockResolvedValue({
    items: [],
    unreadCount: 99,
    olderCursor: null,
    newerCursor: "next",
  });
  expect(await notificationInboxService.exportPage("actor", filters, "en")).toMatchObject({
    items: [],
    window: null,
    hasOlder: false,
    hasNewer: true,
    filters: { period: "all" },
  });
});
it("requires the bounded canonical page contract before exporting unexpected repository data", async () => {
  state.page.mockResolvedValue({
    items: Array.from({ length: 26 }, (_, n) => ({ ...item, id: String(n) })),
    unreadCount: 26,
    olderCursor: null,
    newerCursor: null,
  });
  await expect(notificationInboxService.exportPage("actor", filters, "en")).rejects.toThrow();
});
it("retains Unicode/truncation proof within the byte budget and rejects worst-case JSON escaping above one MiB", async () => {
  state.page.mockResolvedValue({
    items: Array.from({ length: 25 }, (_, n) => ({
      ...item,
      id: String(n),
      title: "😀".repeat(512),
      message: "😀".repeat(8192),
    })),
    unreadCount: 25,
    olderCursor: null,
    newerCursor: null,
  });
  const unicode = await notificationInboxService.exportPage("actor", filters, "en");
  expect(Buffer.byteLength(JSON.stringify(unicode), "utf8")).toBeLessThanOrEqual(1024 * 1024);
  expect(JSON.stringify(unicode)).not.toContain("\uFFFD");
  state.page.mockResolvedValue({
    items: Array.from({ length: 25 }, (_, n) => ({
      ...item,
      id: String(n),
      title: "Legacy",
      message: "\u0001".repeat(8192),
    })),
    unreadCount: 25,
    olderCursor: null,
    newerCursor: null,
  });
  await expect(notificationInboxService.exportPage("actor", filters, "en")).rejects.toMatchObject({
    statusCode: 413,
    code: "EXPORT_TOO_LARGE",
  });
});
