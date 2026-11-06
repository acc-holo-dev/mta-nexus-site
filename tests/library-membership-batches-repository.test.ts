import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createLibraryMembershipBatchesRepositoryDbMock } = await import(
    "./helpers/library-membership-batches-repository-harness"
  );
  return createLibraryMembershipBatchesRepositoryDbMock();
});

vi.mock("../packages/db/src/repositories/library-collection-command", async (original) => {
  const { libraryMembershipBatchesRepositoryState } = await import(
    "./helpers/library-membership-batches-repository-harness"
  );
  return {
    ...(await original<
      typeof import("../packages/db/src/repositories/library-collection-command")
    >()),
    prepareLibraryCollectionCommand: async (...args: unknown[]) => {
      const result = await libraryMembershipBatchesRepositoryState.apply(...args);
      return { replayed: result.replayed, write: async () => result };
    },
  };
});

import { applyLibraryMembershipBatch } from "../packages/db/src/repositories/library-membership-batches";
import {
  installLibraryMembershipBatchesRepositoryHooks,
  libraryMembershipBatchesRepositoryChange as change,
  libraryMembershipBatchesRepositoryDate as date,
  libraryMembershipBatchesRepositoryInput as input,
  libraryMembershipBatchesRepositoryPrefix as prefix,
  libraryMembershipBatchesRepositoryState as state,
  libraryMembershipBatchesRepositoryText as sqlText,
} from "./helpers/library-membership-batches-repository-harness";

installLibraryMembershipBatchesRepositoryHooks();

it("uses one owner-locked transaction for remove-only orphan changes and records one parent audit", async () => {
  state.rows = [...prefix(), [["lcol_a", "active", 2]], [["prd_a"]], [["lmb_a", date]], []];
  const result = await applyLibraryMembershipBatch(input());
  expect(result).toMatchObject({
    replayed: false,
    receipt: {
      productId: "prd_a",
      children: [
        {
          collection: { id: "lcol_a", revision: 3 },
          command: { action: "remove", productId: "prd_a" },
        },
      ],
    },
  });
  expect(state.apply).toHaveBeenCalledOnce();
  expect(state.options).toHaveLength(1);
  expect(sqlText()).toContain("pg_advisory_xact_lock");
  expect(sqlText()).not.toContain('from "products"');
  expect(sqlText()).not.toContain('from "entitlements"');
  const auditIndex = state.queries.findIndex((query) =>
    query.params.includes("library.memberships_changed"),
  );
  expect(auditIndex).toBeGreaterThan(-1);
  expect(state.queries.at(-1)?.sql).toContain('from "sessions"');
  expect(auditIndex).toBeLessThan(state.queries.length - 1);
});

it("prechecks all reviewed revisions and memberships before applying any child", async () => {
  const second = { ...change, collectionId: "lcol_b" };
  state.rows = [...prefix(), [["lcol_a", "active", 2]], [["prd_a"]], [["lcol_b", "active", 9]]];
  await expect(applyLibraryMembershipBatch(input([second, change]))).rejects.toMatchObject({
    code: "COLLECTION_CONFLICT",
  });
  expect(state.apply).not.toHaveBeenCalled();
  expect(state.queries[6]?.params[0]).toBe("lcol_a");
});

it.each(["foreign", "archived", "changed-membership", "quota"])(
  "rejects %s group proof before mutation",
  async (kind) => {
    state.rows =
      kind === "quota"
        ? [...prefix().slice(0, 5), [[5000]]]
        : [
            ...prefix(),
            kind === "foreign" ? [] : [["lcol_a", kind === "archived" ? "archived" : "active", 2]],
            kind === "changed-membership" ? [] : [["prd_a"]],
          ];
    await expect(applyLibraryMembershipBatch(input())).rejects.toMatchObject({
      code:
        kind === "foreign"
          ? "NOT_FOUND"
          : kind === "archived"
            ? "COLLECTION_ARCHIVED"
            : kind === "quota"
              ? "COLLECTION_HISTORY_LIMIT"
              : "COLLECTION_CONFLICT",
    });
    expect(state.apply).not.toHaveBeenCalled();
  },
);

it("locks add access at database time and rejects expiry after all children instead of inserting a parent", async () => {
  const add = { ...change, wasInCollection: false, inCollection: true };
  state.rows = [
    ...prefix(),
    [["lcol_a", "active", 2]],
    [],
    [["prd_a"]],
    [["ent_a", date]],
    [{ valid: false }],
  ];
  await expect(applyLibraryMembershipBatch(input([add]))).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.apply).toHaveBeenCalledOnce();
  expect(sqlText()).toContain("clock_timestamp()");
  expect(sqlText()).not.toContain('insert into "library_membership_batch_receipts"');
});

it("rejects child replay and propagates required parent audit failure", async () => {
  state.rows = [...prefix(), [["lcol_a", "active", 2]], [["prd_a"]]];
  state.apply.mockResolvedValueOnce({ replayed: true, receipt: {} });
  await expect(applyLibraryMembershipBatch(input())).rejects.toMatchObject({
    code: "COLLECTION_REQUEST_REUSED",
  });
  state.rows = [...prefix(), [["lcol_a", "active", 2]], [["prd_a"]], [["lmb_a", date]], []];
  state.failAudit = true;
  await expect(applyLibraryMembershipBatch(input())).rejects.toThrow();
});
