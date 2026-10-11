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
