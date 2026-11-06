import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createResourceReleaseWatchesRepositoryDbMock } = await import(
    "./helpers/resource-release-watches-repository-harness"
  );
  return createResourceReleaseWatchesRepositoryDbMock();
});

import { resourceReleaseWatchesRepository as repo } from "../packages/db/src/repositories/resource-release-watches";
import {
  installResourceReleaseWatchesRepositoryHooks,
  resourceReleaseWatchesRepositoryState as state,
} from "./helpers/resource-release-watches-repository-harness";

installResourceReleaseWatchesRepositoryHooks();

it("bounds list counts and suppresses unavailable metadata without exposing progress or account IDs", async () => {
  state.rows = [[[26, 23, 3, 4]], []];
  expect(await repo.page("usr_a", 2, "enabled")).toMatchObject({
    counts: { all: 26, enabled: 23 },
    page: 2,
    pageSize: 20,
  });
  const query = state.queries.at(-1);
  if (!query) throw new Error("Missing watch list");
  expect(query.params).toContain("usr_a");
  expect(query.params.slice(-2)).toEqual([20, 20]);
  expect(query.sql).toContain("case when");
  expect(query.sql).toContain("entitlements");
  expect(query.sql).toContain("scanner");
  const projection = query.sql.slice(0, query.sql.indexOf(' from "resource_release_watches" left'));
  expect(projection).not.toContain('"resource_release_watches"."last_sequence"');
  expect(projection).not.toContain("storage_key");
});

it("searches literal accessible titles using one database-time snapshot", async () => {
  state.rows = [[[0, 0, 0, 0]], []];
  await repo.page("usr_a", 1, "all", String.raw`a%_\z`);
  for (const query of state.queries) {
    expect(query.sql).toContain("transaction_timestamp()");
    expect(query.sql).toContain("ilike");
    expect(query.params).toContain(String.raw`%a\%\_\\z%`);
  }
});

it("reports the account-wide active count independently of searched watch totals", async () => {
  state.rows = [[[1, 0, 1, 0, 98]], []];
  const result = await repo.page("usr_a", 1, "disabled", "Core");
  expect(result).toMatchObject({
    activeWatchCount: 98,
    counts: { all: 1, enabled: 0, disabled: 1 },
  });
  expect(state.queries).toHaveLength(2);
  expect(state.queries[0].sql).toContain("active.user_id=");
  expect(state.queries[0].sql).toContain("active.enabled=true");
});
