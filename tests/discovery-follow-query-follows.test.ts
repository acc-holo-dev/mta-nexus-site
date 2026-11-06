import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createDiscoveryFollowQueryDbMock } = await import(
    "./helpers/discovery-follow-query-harness"
  );
  return createDiscoveryFollowQueryDbMock();
});

import { followWorkspaceRepository as follows } from "../packages/db/src/repositories/follow-workspace";
import {
  discoveryFollowQueryFollowRow as followRow,
  discoveryFollowQueryStamp as stamp,
  discoveryFollowQueryState as state,
  installDiscoveryFollowQueryHooks,
} from "./helpers/discovery-follow-query-harness";

installDiscoveryFollowQueryHooks();

it("scopes follows to the session owner and pages with exact PostgreSQL microseconds", async () => {
  state.rows = [Array.from({ length: 21 }, (_, index) => followRow(`f${index}`))];
  const result = await follows.page("actor", {
    type: "organization",
    query: "%_",
    cursor: { createdAt: stamp, id: "cursor" },
  });
  expect(result.items).toHaveLength(20);
  expect(result.nextCursor).toEqual({ createdAt: stamp, id: "f19" });
  const query = state.queries[0];
  expect(query.sql).toContain('"follows"."follower_id" =');
  expect(query.params).toContain("actor");
  expect(query.sql).toContain('("follows"."created_at", "follows"."id") <');
  expect(query.params).toContain(stamp);
  expect(query.params).toContain("%\\%\\_%");
  expect(query.params.at(-1)).toBe(21);
  expect(query.sql.split(" from ")[0]).not.toMatch(/email|password|permission|storage_key/u);
});
it("hides inaccessible target metadata inside joins while preserving removable follow keys", async () => {
  state.rows = [[followRow("missing", null)]];
  const result = await follows.page("actor");
  expect(result.items[0]).toMatchObject({
    id: "missing",
    targetId: "org",
    title: null,
    handle: null,
  });
  const query = state.queries[0];
  expect(query.sql).toContain('left join "servers"');
  expect(query.sql).toContain('left join "products"');
  expect(query.params).toEqual(
    expect.arrayContaining([
      "public",
      "unlisted",
      "active",
      "inactive",
      "maintenance",
      "published",
      0,
    ]),
  );
  expect(query.sql).not.toContain('"servers"."visibility" <>');
});
it.each(["server", "organization", "user", "product"] as const)(
  "locks the fresh %s target and confirms the stored follow",
  async (type) => {
    state.rows = [[], [["target"]], [["new"]]];
    expect(await follows.setFollowing("actor", type, "target", true, "new")).toEqual({
      following: true,
      created: true,
    });
    expect(state.queries[0].sql).toContain("pg_advisory_xact_lock");
    expect(state.queries[0].params).toContain(JSON.stringify(["actor", type, "target"]));
    expect(state.queries[1].sql).toContain("for share");
    expect(state.queries[2].sql).toContain("on conflict do nothing");
    if (type === "server") expect(state.queries[1].params).not.toContain("private");
    if (type === "product")
      expect(state.queries[1].params).toEqual(expect.arrayContaining(["published", 0]));
  },
);
it("confirms a repeated command without inserting or notifying twice", async () => {
  state.rows = [[], [["target"]], [], [["existing"]]];
  expect(await follows.setFollowing("actor", "user", "target", true, "new")).toEqual({
    following: true,
    created: false,
  });
  expect(state.queries[3].params).toEqual(["actor", "user", "target", 1]);
});
it("rejects unavailable targets and unrelated insert conflicts without false success", async () => {
  state.rows = [[], []];
  await expect(
    follows.setFollowing("actor", "server", "target", true, "new"),
  ).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(2);
  state.rows = [[], [["target"]], [], []];
  await expect(
    follows.setFollowing("actor", "user", "target", true, "collision"),
  ).rejects.toMatchObject({ code: "UNCONFIRMED" });
});
it("removes only the actor's exact key even after a target disappears, idempotently", async () => {
  state.rows = [[], []];
  expect(await follows.setFollowing("actor", "server", "missing", false, "unused")).toEqual({
    following: false,
    created: false,
    notifyComments: false,
  });
  expect(state.queries).toHaveLength(2);
  expect(state.queries[1].sql).toContain('delete from "follows"');
  expect(state.queries[1].params).toEqual(["actor", "server", "missing"]);
});
it("denies self-follow before acquiring locks", async () => {
  await expect(follows.setFollowing("actor", "user", "actor", true, "new")).rejects.toMatchObject({
    code: "SELF_FOLLOW",
  });
  expect(state.queries).toHaveLength(0);
});
it("reads follow state for a whole bounded grid in one scoped query", async () => {
  state.rows = [[["target-1"]]];
  const ids = Array.from({ length: 60 }, (_, index) => `target-${index}`);
  expect(await follows.states("actor", "user", ids)).toEqual(["target-1"]);
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].params).toContain("actor");
  expect(state.queries[0].params).toContain("target-49");
  expect(state.queries[0].params).not.toContain("target-50");
  expect(state.queries[0].params.at(-1)).toBe(50);
});
