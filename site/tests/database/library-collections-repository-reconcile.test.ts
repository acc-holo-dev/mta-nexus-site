import { beforeEach, expect, it, vi } from "vitest";
import { libraryCollectionCommandSchema } from "../../packages/validation/src/library-collections";

vi.mock("../../packages/db/src/client", async () => {
  const { createLibraryCollectionsRepositoryDbMock } = await import(
    "../helpers/library-collections-repository-harness"
  );
  return createLibraryCollectionsRepositoryDbMock();
});

import { LibraryCollectionsRepository } from "../../packages/db/src/repositories/library-collections";
import {
  collection,
  collectionRow,
  input,
  insertedReceipt,
  prefix,
  record,
  recordRow,
  requestId,
  resetLibraryCollectionsRepositoryState,
  sqlText,
  libraryCollectionsRepositoryState as state,
} from "../helpers/library-collections-repository-harness";

const repo = new LibraryCollectionsRepository();

const reconcile = {
  requestId,
  action: "reconcile-items" as const,
  expectedRevision: 1,
  addProductIds: ["prd_new"],
  removeProductIds: ["prd_old"],
};
const reconciliationRows = (valid = true, expiresAt: string | null = null) => [
  ...prefix(),
  [collectionRow()],
  [[1]],
  [["prd_old"]],
  [[200]],
  [["prd_new"]],
  [["ent_new", expiresAt]],
  [["prd_old"]],
  [],
  [collectionRow({ revision: 2 })],
  [insertedReceipt(reconcile, { ...collection, revision: 2 })],
  [],
  [{ valid }],
];

beforeEach(() => {
  resetLibraryCollectionsRepositoryState();
});

it("reconciles a full collection atomically, requires exact prior membership and checks expiry after required audit", async () => {
  state.rows = reconciliationRows(true, "2026-10-14T00:00:00.000Z");
  expect(await repo.command(input(reconcile))).toMatchObject({
    receipt: { command: reconcile, collection: { ...collection, revision: 2 } },
  });
  expect(state.rows).toHaveLength(0);
  const queries = state.queries,
    remove = queries.findIndex((q) => q.sql.startsWith('delete from "library_collection_items"')),
    add = queries.findIndex((q) => q.sql.startsWith('insert into "library_collection_items"')),
    audit = queries.findIndex((q) => q.sql.startsWith('insert into "audit_events"'));
  expect(remove).toBeGreaterThan(0);
  expect(add).toBeGreaterThan(remove);
  expect(audit).toBeGreaterThan(add);
  const expiryCheck = queries.findIndex(
    (query) =>
      query.sql.includes("clock_timestamp()") &&
      query.params.some(
        (param) =>
          param instanceof Date &&
          param.getTime() === new Date("2026-10-14T00:00:00.000Z").getTime(),
      ),
  );
  expect(expiryCheck).toBeGreaterThan(audit);
  expect(queries.at(-1)?.sql).toContain('from "sessions"');
  expect(expiryCheck).toBeLessThan(queries.length - 1);
  expect(queries.find((q) => q.sql.includes('insert into "audit_events"'))?.params).toContain(
    JSON.stringify({
      requestId,
      receiptId: "lcr_a",
      revision: 2,
      addProductIds: ["prd_new"],
      removeProductIds: ["prd_old"],
    }),
  );
});
it("refuses stale addition/removal prestate before any membership, receipt or audit writes", async () => {
  for (const present of [[], [["prd_old"], ["prd_new"]]]) {
    state.queries = [];
    state.rows = [...prefix(), [collectionRow()], [[1]], present];
    await expect(repo.command(input(reconcile))).rejects.toMatchObject({
      code: "COLLECTION_CONFLICT",
    });
    expect(sqlText()).not.toMatch(/insert into|delete from|update /iu);
  }
});
it("rejects net capacity overflow and lost addition access before removal", async () => {
  state.rows = [...prefix(), [collectionRow()], [[1]], [], [[200]]];
  await expect(repo.command(input({ ...reconcile, removeProductIds: [] }))).rejects.toMatchObject({
    code: "COLLECTION_ITEM_LIMIT",
  });
  expect(sqlText()).not.toContain('delete from "library_collection_items"');
  state.queries = [];
  state.rows = [
    ...prefix(),
    [collectionRow()],
    [[1]],
    [["prd_old"]],
    [[200]],
    [["prd_new"]],
    [],
    [],
  ];
  await expect(repo.command(input(reconcile))).rejects.toMatchObject({ statusCode: 404 });
  expect(sqlText()).not.toContain('delete from "library_collection_items"');
});
it("propagates required audit failure and late finite expiry so the whole real transaction rolls back", async () => {
  state.rows = reconciliationRows(false);
  await expect(repo.command(input(reconcile))).rejects.toMatchObject({
    code: "COLLECTION_ACCESS_CHANGED",
  });
  expect(state.queries.at(-2)?.sql).toContain('insert into "audit_events"');
  state.queries = [];
  state.rows = reconciliationRows();
  state.failAudit = true;
  await expect(repo.command(input(reconcile))).rejects.toThrow();
  expect(state.queries.at(-1)?.sql).toContain('insert into "audit_events"');
});
it("reconciles removal-only orphan references without product or grant reads", async () => {
  const command = { ...reconcile, addProductIds: [] };
  state.rows = [
    ...prefix(),
    [collectionRow()],
    [[1]],
    [["prd_old"]],
    [[200]],
    [["prd_old"]],
    [collectionRow({ revision: 2 })],
    [insertedReceipt(command, { ...collection, revision: 2 })],
    [],
  ];
  await repo.command(input(command));
  expect(state.rows).toHaveLength(0);
  expect(sqlText()).not.toMatch(/from "products"|from "entitlements"|from "licenses"/iu);
  const auditIndex = state.queries.findIndex((query) =>
    query.sql.startsWith('insert into "audit_events"'),
  );
  expect(auditIndex).toBeGreaterThan(-1);
  expect(auditIndex).toBeLessThan(state.queries.length - 1);
  expect(state.queries.at(-1)?.sql).toContain('from "sessions"');
});
it("replays original reconciliation evidence without current grant/member checks and rejects changed UUID reuse", async () => {
  const original = record(libraryCollectionCommandSchema.parse(reconcile), {
    ...collection,
    revision: 2,
  });
  state.rows = [
    ...prefix().slice(0, 4),
    [recordRow(original)],
    [collectionRow({ revision: 9, status: "archived", name: "Later" })],
  ];
  expect(await repo.command(input(reconcile))).toMatchObject({
    replayed: true,
    receipt: { command: reconcile, collection: { ...collection, revision: 2 } },
  });
  expect(sqlText()).not.toContain('from "library_collection_items"');
  state.rows = [...prefix().slice(0, 4), [recordRow(original)]];
  await expect(
    repo.command(input({ ...reconcile, removeProductIds: ["prd_other"] })),
  ).rejects.toMatchObject({ code: "COLLECTION_REQUEST_REUSED" });
});
