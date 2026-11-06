import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createResourceCopyRepositoryDbMock } = await import(
    "./helpers/resource-copy-repository-harness"
  );
  return createResourceCopyRepositoryDbMock();
});

import {
  ResourceCopiesRepository,
  resourceCopyPreview,
} from "../packages/db/src/repositories/resource-copies";
import {
  installResourceCopyRepositoryHooks,
  resourceCopyRepositoryCommand,
  resourceCopyRepositoryInserts as inserts,
  resourceCopyRepositoryMetadata as metadata,
  resourceCopyRepositoryProduct as product,
  resourceCopyRepositoryRecord as record,
  resourceCopyRepositoryRow,
  resourceCopyRepositorySource as source,
  resourceCopyRepositorySourceId as sourceId,
  resourceCopyRepositoryState as state,
  resourceCopyRepositoryTargetId as targetId,
  resourceCopyRepositoryUser as user,
} from "./helpers/resource-copy-repository-harness";

const repo = new ResourceCopiesRepository();
const command = resourceCopyRepositoryCommand(resourceCopyPreview(source).reviewDigest);
const row = resourceCopyRepositoryRow(command);

installResourceCopyRepositoryHooks();

it("creates target, database-generated receipt and two audits in one transaction", async () => {
  state.rows = [
    [],
    [],
    [],
    [product()],
    [["usr_a", "developer"]],
    [],
    [user()],
    [],
    [[0]],
    [],
    [record(row)],
    [],
  ];
  const result = await repo.create("usr_a", sourceId, command);
  expect(result.replayed).toBe(false);
  expect(result.receipt.metadata).toEqual(metadata);
  expect(state.options).toEqual([{ isolationLevel: "read committed" }]);
  expect(inserts()).toHaveLength(3);
  const target = inserts()[0];
  expect(target.sql).toContain('"products"');
  expect(target.params).toContain("unlimited");
  expect(target.params).toContain("draft");
  expect(target.params).toContain(true);
  expect(target.params).toContain("usr_a");
  const saved = inserts()[1];
  expect(saved.sql).toContain('"resource_draft_copies"');
  expect(saved.sql).toContain("default");
  expect(saved.params).not.toContain(JSON.stringify(row.snapshot));
  expect(inserts()[2].params).toContain("product.created");
  expect(inserts()[2].params).toContain("product.draft_copied");
  expect(state.queries.filter((q) => q.sql.includes("pg_advisory_xact_lock"))).toHaveLength(2);
  expect(state.queries.some((q) => /builds|payments|licenses|entitlements/.test(q.sql))).toBe(
    false,
  );
});

it("replays exact requests after source edits only while both resources remain manageable", async () => {
  state.rows = [
    [],
    [],
    [],
    [product({ ...source, status: "suspended", description: "Changed description" })],
    [["usr_a", "user"]],
    [record(row)],
    [product({ ...source, id: targetId, status: "published" })],
    [["usr_a", "user"]],
  ];
  expect((await repo.create("usr_a", sourceId, command)).replayed).toBe(true);
  expect(inserts()).toHaveLength(0);
});

it("refuses reused keys with changed target details before inserting anything", async () => {
  state.rows = [[], [], [], [product()], [["usr_a", "developer"]], [record(row)]];
  await expect(
    repo.create("usr_a", sourceId, { ...command, title: "Other title" }),
  ).rejects.toMatchObject({ code: "RESOURCE_COPY_REQUEST_CONFLICT" });
  expect(inserts()).toHaveLength(0);
});

it("refuses lost target access on replay", async () => {
  state.rows = [
    [],
    [],
    [],
    [product()],
    [["usr_a", "developer"]],
    [record(row)],
    [product({ ...source, id: targetId, authorId: "usr_other" })],
    [["usr_a", "developer"]],
  ];
  await expect(repo.create("usr_a", sourceId, command)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(inserts()).toHaveLength(0);
});

it("refuses lost source authority without reading existing receipts", async () => {
  state.rows = [
    [],
    [],
    [],
    [product({ ...source, authorId: "usr_other" })],
    [["usr_a", "developer"]],
  ];
  await expect(repo.create("usr_a", sourceId, command)).rejects.toMatchObject({
    code: "NOT_FOUND",
  });
  expect(state.queries.some((q) => q.sql.includes('from "resource_draft_copies"'))).toBe(false);
});

it("uses live creation capability, not an earlier signed-in role", async () => {
  state.rows = [[], [], [], [product()], [["usr_a", "user"]], [], [user("user", false)]];
  await expect(repo.create("usr_a", sourceId, command)).rejects.toMatchObject({
    code: "RESOURCE_COPY_CREATE_FORBIDDEN",
  });
  expect(inserts()).toHaveLength(0);
});

it("requires review of the current source before creation", async () => {
  state.rows = [
    [],
    [],
    [],
    [product({ ...source, description: "Changed description" })],
    [["usr_a", "developer"]],
    [],
    [user()],
  ];
  await expect(repo.create("usr_a", sourceId, command)).rejects.toMatchObject({
    code: "RESOURCE_COPY_SOURCE_CHANGED",
  });
  expect(inserts()).toHaveLength(0);
});

it("counts all immutable receipts under a source-wide quota lock", async () => {
  state.rows = [[], [], [], [product()], [["usr_a", "developer"]], [], [user()], [], [[50]]];
  await expect(repo.create("usr_a", sourceId, command)).rejects.toMatchObject({
    code: "RESOURCE_COPY_LIMIT",
  });
  expect(inserts()).toHaveLength(0);
});

it("keeps organization publisher identity when a delegated manager creates a copy", async () => {
  state.rows = [
    [],
    [],
    [],
    [product({ ...source, authorId: "usr_other", organizationId: "org_a" })],
    [["usr_owner"]],
    [["usr_a", "developer"]],
    [["member", ["manage_products"]]],
    [],
    [user()],
    [],
    [[0]],
    [],
    [record(row)],
    [],
  ];
  expect(
    (
      await repo.create("usr_a", sourceId, {
        ...command,
        reviewDigest: resourceCopyPreview({
          ...source,
          authorId: "usr_other",
          organizationId: "org_a",
        }).reviewDigest,
      })
    ).publisherId,
  ).toBe("usr_other");
  expect(inserts()[0].params).toContain("org_a");
  expect(inserts()[0].params).toContain("usr_other");
});
