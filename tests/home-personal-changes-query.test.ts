import { expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ inbox: vi.fn(), watches: vi.fn(), follows: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("../apps/web/node_modules/server-only/index.js", () => ({}));
vi.mock("@nexus/db", () => ({
  notificationRepository: { pageInbox: state.inbox },
  resourceReleaseWatchesRepository: { page: state.watches },
}));
vi.mock("../apps/web/src/lib/services/follow-workspace-service", () => ({
  followWorkspaceService: { page: state.follows },
}));

import { loadPersonalChangesSummary } from "../apps/web/src/lib/home-personal-changes";

it("reads one inbox snapshot to classify localized personal changes", async () => {
  state.inbox.mockResolvedValueOnce({
    items: [
      {
        id: "notice_1",
        title: "Release",
        message: "A new release",
        link: "/market/resource",
        category: "system",
        isRead: false,
        createdAt: "2026-10-11T00:00:00.000000Z",
        truncated: false,
        data: { kind: "resource_release", privateMarker: "do-not-expose" },
      },
    ],
    unreadCount: 1,
    olderCursor: null,
    newerCursor: null,
  });
  state.watches.mockResolvedValueOnce({ items: [] });
  state.follows.mockResolvedValueOnce({ items: [] });

  const result = await loadPersonalChangesSummary("actor", "en", false);

  expect(state.inbox).toHaveBeenCalledExactlyOnceWith("actor", {
    query: "",
    state: "unread",
    category: "all",
  });
  expect(result.status).toBe("ok");
  expect(result.items).toEqual([
    expect.objectContaining({ id: "notice_1", reason: "releaseWatch", href: "/market/resource" }),
  ]);
  expect(JSON.stringify(result)).not.toContain("do-not-expose");
});
