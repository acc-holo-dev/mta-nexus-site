import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createDiscoveryFollowQueryDbMock } = await import(
    "./helpers/discovery-follow-query-harness"
  );
  return createDiscoveryFollowQueryDbMock();
});

import { publicDirectoryRepository as directory } from "../packages/db/src/repositories/public-directory";
import {
  discoveryFollowQueryState as state,
  installDiscoveryFollowQueryHooks,
} from "./helpers/discovery-follow-query-harness";

installDiscoveryFollowQueryHooks();

it.each(["pageCreators", "pageOrganizations", "pageServers"] as const)(
  "%s filters before bounded stable pagination",
  async (method) => {
    await directory[method]({
      page: 3,
      query: "%_",
      verified: true,
      sort: "name",
      language: "ru",
      region: "EU",
      gameMode: "RP",
    });
    const query = state.queries[0];
    expect(query.params).toContain("%\\%\\_%");
    expect(query.params).toContain(true);
    expect(query.params.slice(-2)).toEqual([25, 48]);
    expect(query.sql).toMatch(/order by .+ asc, .+ asc limit/u);
    if (method === "pageServers") {
      expect(query.params).toEqual(
        expect.arrayContaining(["public", "active", "%ru%", "%EU%", "%RP%"]),
      );
      expect(query.sql).toContain("jsonb_array_elements_text");
    } else
      expect(query.sql.split(" from ")[0]).not.toMatch(
        /email|password|owner_id|two_factor|active_context/u,
      );
  },
);
it("includes creator/admin roles and clamps internal page inputs", async () => {
  await directory.pageCreators({ page: 20000 });
  expect(state.queries[0].params).toEqual(expect.arrayContaining(["developer", "admin", 23976]));
  expect(state.queries[0].sql).toMatch(/created_at.+desc.+id.+desc/u);
});
it("uses a sentinel rather than a count or unbounded creator read", async () => {
  state.rows = [
    Array.from({ length: 25 }, (_, index) => [
      `u${index}`,
      `user${index}`,
      "User",
      null,
      null,
      false,
    ]),
  ];
  const result = await directory.pageCreators({ page: 2 });
  expect(result.items).toHaveLength(24);
  expect(result.hasMore).toBe(true);
  expect(state.queries).toHaveLength(1);
});
