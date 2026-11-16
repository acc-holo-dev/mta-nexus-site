import { afterEach, beforeEach, expect, it, vi } from "vitest";

vi.mock("../../packages/db/src/client", async () => {
  const { createResourceReleaseControlRepositoryDbMock } = await import(
    "../helpers/resource-release-control-repository-harness"
  );
  return createResourceReleaseControlRepositoryDbMock();
});

import { ResourceLibrarySelectionsRepository } from "../../packages/db/src/repositories/resource-library-selections";
import { UserLibraryRepository } from "../../packages/db/src/repositories/user-library";
import {
  now,
  ownedRows,
  resetResourceReleaseControlRepositoryState,
  stamp,
  resourceReleaseControlRepositoryState as state,
} from "../helpers/resource-release-control-repository-harness";

const library = new ResourceLibrarySelectionsRepository();

beforeEach(() => {
  resetResourceReleaseControlRepositoryState();
  vi.useFakeTimers();
  vi.setSystemTime(now);
});
afterEach(() => vi.useRealTimers());

it("masks private metadata and filters updates in SQL before bounded pagination", async () => {
  state.results = [[{ all: 24, updates: 21, pinned: 21, unavailable: 3 }], []];
  const result = await library.page("usr_a' --", 2, "updates");
  expect(result).toMatchObject({ total: 21, page: 2, pageSize: 20 });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  const query = state.queries.at(-1);
  expect(query?.sql).toContain("THEN product.title END");
  expect(query?.sql).toContain('"licenses"."status" = \'active\'');
  expect(query?.sql).toContain('"entitlements"."expires_at" >');
  expect(query?.sql).toContain("WHERE state = 'update_available' ORDER BY");
  expect(query?.params.slice(-2)).toEqual([20, 20]);
  expect(query?.params).toContain("usr_a' --");
  expect(query?.sql).not.toContain("usr_a' --");
  expect(query?.sql).not.toContain('"licenses"."key"');
  expect(query?.sql).not.toContain('"builds"."storage_key"');
});
it("does not reveal titles or releases in a suspended buyer detail", async () => {
  state.results = [
    [["prd_a", "PRIVATE TITLE", "private-slug", "suspended"]],
    [["usr_a"]],
    [["ent_a", null]],
    [[2, "fixed", "bld_a", stamp]],
  ];
  expect(await library.detail("usr_a", "prd_a")).toMatchObject({
    product: { title: null, slug: null },
    selected: null,
    latest: null,
    versions: [],
  });
  expect(state.queries.some((q) => q.sql.includes('from "builds"'))).toBe(false);
});
it("projects reviewed archive identities for safe buyer choices without private file locations", async () => {
  const release = ["bld_a", "1.0.0", "Notes", stamp, "a".repeat(64), 100];
  state.results = [...ownedRows().slice(1), [], [release], [[1]], [release]];
  const detail = await library.detail("usr_a", "prd_a");
  expect(detail.versions[0]).toMatchObject({
    id: "bld_a",
    sha256Hash: "a".repeat(64),
    fileSizeBytes: 100,
  });
  const queries = state.queries.filter((q) => q.sql.includes('from "builds"'));
  expect(queries).toHaveLength(3);
  expect(queries[0]?.sql).toContain('"sha256_hash"');
  expect(queries[0]?.sql).toContain('"file_size_bytes"');
  expect(queries.every((q) => !q.sql.includes('"storage_key"'))).toBe(true);
});
it("main library reads a fixed cleared build and retains the unavailable state after withdrawal", async () => {
  state.results = [
    [{ all: 2, ready: 1, unavailable: 1 }],
    [
      {
        resourceId: "prd_a",
        title: "Title",
        slug: "slug",
        version: "1.0.0",
        downloadable: true,
        selectionMode: "fixed",
        buildId: "bld_a",
        addedAt: now,
      },
      {
        resourceId: "prd_b",
        title: null,
        slug: null,
        version: null,
        downloadable: false,
        selectionMode: "fixed",
        buildId: "withdrawn",
        addedAt: now,
      },
    ],
  ];
  const result = await new UserLibraryRepository().pageByUser("usr_a");
  expect(result.items[0]).toMatchObject({
    version: "1.0.0",
    buildId: "bld_a",
    selectionMode: "fixed",
    downloadable: true,
  });
  expect(result.items[1]).toMatchObject({
    version: null,
    buildId: null,
    selectionMode: "fixed",
    downloadable: false,
  });
  const sql = state.queries.at(-1)?.sql;
  expect(sql).toContain('"resource_library_selections"."mode"');
  expect(sql).toContain('"builds"."id" = "resource_library_selections"."build_id"');
});
