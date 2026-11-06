import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createLibraryCollectionInventoryDbMock } = await import(
    "./helpers/library-collection-inventory-harness"
  );
  return createLibraryCollectionInventoryDbMock();
});

import { readLibraryCollectionInventory } from "../packages/db/src/repositories/library-collection-inventory";
import {
  installLibraryCollectionInventoryHooks,
  libraryCollectionInventoryMemberships as memberships,
  libraryCollectionInventoryPrefix as prefix,
  libraryCollectionInventoryQuery as query,
  libraryCollectionInventoryRows as rows,
  libraryCollectionInventoryState as state,
  libraryCollectionInventorySummary as summary,
  libraryCollectionInventoryText as text,
} from "./helpers/library-collection-inventory-harness";

installLibraryCollectionInventoryHooks();

it("reports one own version choice across active and archived memberships and withholds inaccessible preference metadata", async () => {
  const items = [
    {
      ...rows()[0],
      mode: "fixed",
      revision: 3,
      state: "update_available",
      selectedBuildId: "bld_old",
      selectedVersion: "1.0.0",
    },
    {
      ...rows()[1],
      mode: "fixed",
      revision: 7,
      state: "update_available",
      latestBuildId: "PRIVATE",
      latestVersion: "PRIVATE",
      selectedBuildId: "PRIVATE",
      selectedVersion: "PRIVATE",
    },
  ];
  state.rows = [
    ...prefix(),
    [{ ...summary, releaseLatest: 0, releasePinned: 1, releaseUpdates: 1, attention: 2 }],
    items,
    memberships(),
  ];
  const report = await readLibraryCollectionInventory("usr_a", { ...query, release: "attention" });
  expect(report.releaseCounts).toEqual({
    latest: 0,
    pinned: 1,
    updates: 1,
    selectionUnavailable: 0,
    attention: 2,
  });
  expect(report.items[0]?.release).toEqual({
    state: "update_available",
    mode: "fixed",
    revision: 3,
    canReviewRequirements: true,
    latest: { buildId: "bld_latest", version: "2.0.0" },
    effective: { buildId: "bld_old", version: "1.0.0" },
  });
  expect(report.items[0]?.memberships).toHaveLength(2);
  expect(report.items[1]?.release).toBeNull();
  expect(JSON.stringify(report)).not.toContain("PRIVATE");
  expect(text()).toContain("pref.user_id=");
  expect(text()).toMatch(/ORDER BY "builds"\."created_at" DESC,"builds"\."id" DESC/u);
  expect(text()).not.toMatch(/storage_key|sha256_hash|file_size_bytes|select \*/iu);
});
it("does not replace a withdrawn fixed build with the safe latest build", async () => {
  state.rows = [
    ...prefix(),
    [
      {
        ...summary,
        total: 1,
        releaseLatest: 0,
        releasePinned: 1,
        selectionUnavailable: 1,
        attention: 2,
      },
    ],
    [{ ...rows()[0], mode: "fixed", revision: 4, state: "selection_unavailable" }],
    memberships().slice(0, 2),
  ];
  const report = await readLibraryCollectionInventory("usr_a", {
    ...query,
    filter: "available",
    release: "selection-unavailable",
  });
  expect(report.items[0]?.available).toBe(true);
  expect(report.items[0]?.release).toMatchObject({
    state: "selection_unavailable",
    effective: null,
    latest: { buildId: "bld_latest" },
  });
  expect(text()).toContain("available AND state='selection_unavailable'");
  expect(text()).toContain('"builds"."id"=pref.build_id');
});
it.each([
  { mode: "fixed", revision: 0 },
  { mode: "admin" },
  { revision: 2147483648 },
  { latestBuildId: "../private" },
  { latestVersion: "version\u0000" },
  { state: "update_available" },
  {
    mode: "fixed",
    revision: 2,
    state: "pinned",
    selectedBuildId: "bld_latest",
    selectedVersion: "different",
  },
])("rejects corrupt accessible release proof before returning any plan: %j", async (invalid) => {
  state.rows = [...prefix(), [summary], [{ ...rows()[0], ...invalid }], memberships().slice(0, 2)];
  await expect(readLibraryCollectionInventory("usr_a", query)).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
});
it("rejects contradictory aggregate version counts", async () => {
  state.rows = [...prefix(), [{ ...summary, releaseUpdates: 1 }]];
  await expect(readLibraryCollectionInventory("usr_a", query)).rejects.toMatchObject({
    code: "COLLECTION_SNAPSHOT_INVALID",
  });
  expect(state.queries).toHaveLength(4);
});
