import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createLibrarySelectionBatchesRepositoryDbMock } = await import(
    "./helpers/library-selection-batches-repository-harness"
  );
  return createLibrarySelectionBatchesRepositoryDbMock();
});
vi.mock("../packages/db/src/repositories/initiating-session", async () => {
  const { librarySelectionBatchesRepositoryState } = await import(
    "./helpers/library-selection-batches-repository-harness"
  );
  return { lockInitiatingSession: librarySelectionBatchesRepositoryState.session };
});
vi.mock("../packages/db/src/repositories/entitlements", async () => {
  const { librarySelectionBatchesRepositoryState } = await import(
    "./helpers/library-selection-batches-repository-harness"
  );
  return { lockUserDownloadAccess: librarySelectionBatchesRepositoryState.access };
});

import { LibrarySelectionBatchesRepository } from "../packages/db/src/repositories/library-selection-batches";
import {
  installLibrarySelectionBatchesRepositoryHooks,
  librarySelectionBatchesRepositoryChoice as choice,
  librarySelectionBatchesRepositoryPreviewRows as previewRows,
  librarySelectionBatchesRepositoryState as state,
  librarySelectionBatchesRepositoryText as text,
} from "./helpers/library-selection-batches-repository-harness";

const repo = new LibrarySelectionBatchesRepository();

installLibrarySelectionBatchesRepositoryHooks();

it("previews current selected builds in a read-only bounded snapshot without mutation", async () => {
  state.rows = previewRows();
  const result = await repo.preview("usr_a", "lcol_a", choice);
  expect(result).toMatchObject({
    changedCount: 1,
    items: [{ targetBuildId: "bld_a", next: { revision: 1, mode: "fixed", buildId: "bld_a" } }],
  });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  expect(text()).toContain("pref.mode='fixed' THEN pref.build_id");
  expect(text()).not.toContain("insert into");
  expect(state.access).not.toHaveBeenCalled();
  expect(state.rows).toHaveLength(0);
});

it("rejects foreign collections before inspecting members", async () => {
  state.rows = [[], [], [["usr_a"]], []];
  await expect(repo.preview("usr_a", "lcol_foreign", choice)).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(text()).not.toContain('"library_collection_items"');
});

it("rejects non-member IDs before revealing their metadata", async () => {
  const rows = previewRows();
  rows[4] = [];
  state.rows = rows;
  await expect(repo.preview("usr_a", "lcol_a", choice)).rejects.toMatchObject({
    code: "SELECTION_BATCH_CHANGED",
  });
  expect(text()).not.toContain("p.title");
  expect(text()).not.toContain('FROM "products"');
});

it("rejects archived collections before previewing selections", async () => {
  const pre = previewRows();
  pre[3] = [["lcol_a", "Core", "archived", 4]];
  state.rows = pre;
  await expect(repo.preview("usr_a", "lcol_a", choice)).rejects.toMatchObject({
    code: "COLLECTION_ARCHIVED",
  });
});
