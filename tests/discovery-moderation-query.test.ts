import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createDiscoveryModerationQueryDbMock } = await import(
    "./helpers/discovery-moderation-query-harness"
  );
  return createDiscoveryModerationQueryDbMock();
});

import { publicDirectoryRepository as directory } from "../packages/db/src/repositories/public-directory";
import {
  discoveryModerationQueryState as state,
  discoveryModerationQueryTime as time,
  installDiscoveryModerationQueryHooks,
} from "./helpers/discovery-moderation-query-harness";

installDiscoveryModerationQueryHooks();

it.each(["pageServers", "pageCreators", "pageOrganizations"] as const)(
  "%s retains existing public gates, escaping and bounded keyset predicates without offset",
  async (method) => {
    await directory[method]({
      keyset: true,
      query: "%_",
      verified: true,
      language: "ru",
      region: "EU",
      gameMode: "RP",
      cursor: { createdAt: time, id: "anchor" },
    });
    const query = state.queries[0];
    expect(query.sql).not.toContain("offset");
    expect(query.sql).toContain("US");
    expect(query.sql).toMatch(/\) < \(/u);
    expect(query.params).toEqual(expect.arrayContaining(["%\\%\\_%", time, "anchor", true, 25]));
    expect(query.sql.split(" from ")[0]).not.toMatch(
      /owner_id|organization_id|email|password|current_players|endpoint_revision/u,
    );
    if (method === "pageServers")
      expect(query.params).toEqual(
        expect.arrayContaining(["public", "active", "%ru%", "%EU%", "%RP%"]),
      );
    if (method === "pageCreators")
      expect(query.params).toEqual(expect.arrayContaining(["developer", "admin"]));
  },
);
it("returns twenty-four exact tied keys and strips internal time fields from public identity rows", async () => {
  state.rows = [
    Array.from({ length: 25 }, (_, i) => [
      `user-${i}`,
      `user${i}`,
      "User",
      null,
      null,
      false,
      time,
    ]),
  ];
  const page = await directory.pageCreators({ keyset: true });
  expect(page.items).toHaveLength(24);
  expect(page.hasMore).toBe(true);
  expect(page.nextCursor).toEqual({ createdAt: time, id: "user-23" });
  expect(page.previousCursor).toBeNull();
  expect(JSON.stringify(page.items)).not.toContain("cursorTime");
});
it("queries the nearest newer neighbors ascending and restores descending display order", async () => {
  state.rows = [
    Array.from({ length: 25 }, (_, i) => [`org-${i}`, "Team", `team-${i}`, null, null, true, time]),
  ];
  const page = await directory.pageOrganizations({
    keyset: true,
    cursor: { createdAt: time, id: "anchor", direction: "newer" },
  });
  expect(state.queries[0].sql).toMatch(/\) > \(/u);
  expect(state.queries[0].sql).toMatch(/created_at.+asc.+id.+asc/u);
  expect(page.items[0].id).toBe("org-23");
  expect(page.nextCursor?.id).toBe("org-0");
  expect(page.previousCursor?.id).toBe("org-23");
});
it("does not emit continuation on an empty stream page", async () => {
  const page = await directory.pageCreators({
    keyset: true,
    cursor: { createdAt: time, id: "gone" },
  });
  expect(page).toMatchObject({ items: [], hasMore: false, nextCursor: null, previousCursor: null });
});
