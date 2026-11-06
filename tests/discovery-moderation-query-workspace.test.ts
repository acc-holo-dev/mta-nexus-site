import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createDiscoveryModerationQueryDbMock } = await import(
    "./helpers/discovery-moderation-query-harness"
  );
  return createDiscoveryModerationQueryDbMock();
});

import { communityModerationWorkspaceRepository as moderation } from "../packages/db/src/repositories/community-moderation-workspace";
import {
  discoveryModerationQueryContext as context,
  discoveryModerationQueryState as state,
  discoveryModerationQueryTime as time,
  installDiscoveryModerationQueryHooks,
} from "./helpers/discovery-moderation-query-harness";

installDiscoveryModerationQueryHooks();

it.each(["user", "developer", null])(
  "checks current staff role %s before reading any moderation content",
  async (role) => {
    state.rows = [role ? [[role]] : []];
    await expect(moderation.page("actor", { query: "" })).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    expect(state.queries).toHaveLength(1);
  },
);
it("reads only supported publication types after staff and scopes the exact microsecond queue to filters", async () => {
  state.rows = [
    [["moderator"]],
    Array.from({ length: 21 }, (_, i) => [
      `item-${i}`,
      `post-${i}`,
      "Draft",
      "post",
      "draft",
      "Preview",
      time,
      time,
      "writer",
      "Writer",
      null,
      time,
    ]),
  ];
  const point = context([1, "community-moderation", "actor", "%_", "draft", "post", "writer"]);
  const page = await moderation.page("actor", {
    query: "%_",
    status: "draft",
    type: "post",
    author: "Writer",
    cursor: { createdAt: time, id: "anchor", context: point },
  });
  expect(page.items).toHaveLength(20);
  expect(page.nextCursor).toEqual({ createdAt: time, id: "item-19" });
  expect(state.queries[1].params).toEqual(
    expect.arrayContaining(["draft", "post", "writer", "%\\%\\_%", time, "anchor", 21]),
  );
  expect(state.queries[1].sql).not.toMatch(/offset|product_id|email|password|owner_id/u);
  expect(state.queries[1].sql).toContain("350");
  expect(state.transactions).toEqual([
    { isolationLevel: "repeatable read", accessMode: "read only" },
  ]);
});
it.each(["page", "detail"] as const)(
  "rejects foreign %s cursors before publication or history access",
  async (mode) => {
    state.rows = [[["admin"]]];
    const cursor = { createdAt: time, id: "anchor", context: "a".repeat(64) };
    await expect(
      mode === "page"
        ? moderation.page("actor", { query: "", cursor })
        : moderation.detail("actor", "item", cursor),
    ).rejects.toMatchObject({ code: "INVALID_CURSOR" });
    expect(state.queries).toHaveLength(1);
  },
);
it("masks missing/nonpublication detail and reads no audit history", async () => {
  state.rows = [[["admin"]], []];
  await expect(moderation.detail("actor", "commercial")).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.queries).toHaveLength(2);
});
it("reads a bounded full preview and only retained publication decisions without raw audit or account data", async () => {
  state.rows = [
    [["moderator"]],
    [
      [
        "item",
        "draft",
        "Draft",
        "article",
        "draft",
        "Preview",
        time,
        time,
        "writer",
        "Writer",
        null,
        "Full draft body",
        false,
        ["Lua"],
        "Team",
        "team",
        null,
        null,
      ],
    ],
    [["audit", "content.archived", time, time, "published", "archived", "Private staff reason"]],
  ];
  const page = await moderation.detail("actor", "item");
  expect(page.item.body).toBe("Full draft body");
  expect(page.history[0].notes).toBe("Private staff reason");
  expect(state.queries[1].sql).toContain("100000");
  expect(state.queries[1].params).toEqual(expect.arrayContaining(["public", "active", "item"]));
  expect(state.queries[2].params).toEqual([
    "content",
    "item",
    "content.published",
    "content.archived",
    21,
  ]);
  expect(state.queries[2].sql).not.toMatch(/ip_address|user_agent|actor_id|reviewer_id/u);
  expect(state.queries[2].sql).toContain("2000");
  expect(page.nextCursor).toBeNull();
});
