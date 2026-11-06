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
  librarySelectionBatchesRepositoryCollection as c,
  librarySelectionBatchesRepositoryCommand as command,
  librarySelectionBatchesRepositoryCommandRows as commandRows,
  librarySelectionBatchesRepositoryInput as input,
  librarySelectionBatchesRepositoryPreviewRows as previewRows,
  librarySelectionBatchesRepositoryRecord as record,
  librarySelectionBatchesRepositoryRecordRow as recordRow,
  librarySelectionBatchesRepositoryRow as row,
  librarySelectionBatchesRepositoryState as state,
  librarySelectionBatchesRepositoryText as text,
} from "./helpers/library-selection-batches-repository-harness";

const repo = new LibrarySelectionBatchesRepository();

installLibrarySelectionBatchesRepositoryHooks();

async function digest() {
  state.rows = previewRows();
  const preview = await repo.preview("usr_a", "lcol_a", choice);
  state.queries = [];
  state.options = [];
  return preview.previewDigest;
}

it("applies exact reviewed selections with receipt and mandatory per-resource and batch audits", async () => {
  const d = await digest();
  state.rows = [...commandRows(), [["prd_a"]], [], [recordRow(record(d))], []];
  const result = await repo.command(input(d));
  expect(result).toMatchObject({
    replayed: false,
    receipt: { snapshot: { items: [{ next: { revision: 1, mode: "fixed", buildId: "bld_a" } }] } },
  });
  expect(state.options).toEqual([{ isolationLevel: "read committed" }]);
  expect(state.session).toHaveBeenCalledWith(expect.anything(), "usr_a", "browser-token");
  const firstWrite = state.queries.findIndex((q) => q.sql.includes("insert into"));
  expect(
    state.queries
      .slice(state.sessionQueryCount, firstWrite)
      .map((q) => q.sql)
      .join("\n"),
  ).not.toMatch(/for (?:share|update)|pg_advisory_xact_lock/iu);
  expect(state.queries[2].params).toEqual(["library-collections:usr_a"]);
  expect(state.queries[3].params).toEqual(["library-selection:usr_a:prd_a"]);
  expect(text()).toContain('"resource_library_selections"."revision"=excluded.revision-1');
  expect(state.queries.filter((q) => q.sql.includes('insert into "audit_events"'))).toHaveLength(2);
  expect(text()).not.toMatch(/insert into "(?:entitlements|licenses|payments|ledger_entries)"/u);
  expect(state.rows).toHaveLength(0);
});

it("replays an immutable prior operation without reading grants or mutating selections again", async () => {
  const d = await digest();
  state.rows = [[], [], [], [], [["usr_a"]], [c], [recordRow(record(d))]];
  expect(await repo.command(input(d))).toMatchObject({ replayed: true });
  expect(state.access).not.toHaveBeenCalled();
  expect(text()).not.toContain("insert into");
});

it("rejects a reused UUID bound to another collection or command", async () => {
  const d = await digest(),
    prior = record(d);
  prior.commandDigest = "0".repeat(64);
  state.rows = [[], [], [], [], [["usr_a"]], [c], [recordRow(prior)]];
  await expect(repo.command(input(d))).rejects.toMatchObject({
    code: "SELECTION_BATCH_REQUEST_REUSED",
  });
  expect(text()).not.toContain("insert into");
});

it("invalidates a stale review before any write", async () => {
  const d = await digest(),
    rows = commandRows();
  rows[17] = [{ ...row, revision: 1, mode: "fixed", buildId: "bld_a" }];
  state.rows = rows;
  await expect(repo.command(input(d))).rejects.toMatchObject({ code: "SELECTION_BATCH_CHANGED" });
  expect(text()).not.toContain("insert into");
});

it("refuses revoked or expired access after locking", async () => {
  const d = await digest();
  state.rows = commandRows();
  state.access.mockResolvedValue({
    source: "entitlement",
    expiresAt: new Date("2026-10-11T00:00:00Z"),
  });
  await expect(repo.command(input(d))).rejects.toMatchObject({
    code: "SELECTION_BATCH_UNAVAILABLE",
  });
  expect(text()).not.toContain("insert into");
});

it("refuses withdrawn builds before changing any selection", async () => {
  const d = await digest(),
    rows = commandRows();
  rows[15] = [];
  state.rows = rows;
  await expect(repo.command(input(d))).rejects.toMatchObject({ code: "SELECTION_BATCH_CHANGED" });
  expect(text()).not.toContain("insert into");
});

it("rejects saturated selection-batch history before mutating", async () => {
  state.rows = [[], [], [], [], [["usr_a"]], [c], [], [[5000]]];
  await expect(repo.command(input("a".repeat(64)))).rejects.toMatchObject({
    code: "SELECTION_BATCH_LIMIT",
  });
});

it("rolls out of the command without a receipt if the guarded upsert fails", async () => {
  const d = await digest();
  state.rows = [...commandRows(), []];
  await expect(repo.command(input(d))).rejects.toMatchObject({ code: "SELECTION_BATCH_CHANGED" });
  expect(text()).not.toContain('insert into "library_selection_batch_receipts"');
});

it("rejects direct invalid commands before opening a transaction", async () => {
  await expect(
    repo.command({
      ...input("a".repeat(64)),
      command: { ...command("a".repeat(64)), userId: "other" } as ReturnType<typeof command>,
    }),
  ).rejects.toMatchObject({ statusCode: 400 });
  expect(state.queries).toHaveLength(0);
});

it.each([false, true])(
  "requires the initiating session for a command (replay=%s)",
  async (replay) => {
    const d = await digest();
    state.rows = replay
      ? [[], [], [], [], [["usr_a"]], [c], [recordRow(record(d))]]
      : commandRows();
    state.session.mockRejectedValue(new Error("Session revoked"));
    await expect(repo.command(input(d))).rejects.toThrow("Session revoked");
    expect(text()).not.toContain("insert into");
  },
);

it("refreshes finite access and evidence after the initiating session wait", async () => {
  const d = await digest(),
    rows = commandRows();
  state.access.mockResolvedValue({
    source: "entitlement",
    expiresAt: new Date("2026-10-12T00:00:01Z"),
  });
  rows[21] = [{ observedAt: "2026-10-12T00:00:02Z" }];
  state.rows = rows;
  await expect(repo.command(input(d))).rejects.toMatchObject({
    code: "SELECTION_BATCH_UNAVAILABLE",
  });
  expect(state.session).toHaveBeenCalledOnce();
  expect(state.access).toHaveBeenCalledOnce();
  const sessionOrder = state.session.mock.invocationCallOrder[0];
  expect(state.access.mock.invocationCallOrder[0]).toBeLessThan(sessionOrder);
  expect(text()).not.toContain("insert into");
});

it("rejects changed safe-build evidence discovered after the session wait", async () => {
  const d = await digest(),
    rows = commandRows();
  rows[22] = [{ ...row, targetBuildId: "bld_new" }];
  state.rows = rows;
  await expect(repo.command(input(d))).rejects.toMatchObject({ code: "SELECTION_BATCH_CHANGED" });
  expect(text()).not.toContain("insert into");
});
