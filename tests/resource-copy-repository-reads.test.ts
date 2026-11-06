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
  resourceCopyReceipt,
} from "../packages/db/src/repositories/resource-copies";
import {
  installResourceCopyRepositoryHooks,
  resourceCopyRepositoryCommand,
  resourceCopyRepositoryMetadata as metadata,
  resourceCopyRepositoryProduct as product,
  resourceCopyRepositoryReceiptId as receiptId,
  resourceCopyRepositoryRecord as record,
  resourceCopyRepositoryRow,
  resourceCopyRepositorySource as source,
  resourceCopyRepositorySourceId as sourceId,
  resourceCopyRepositoryState as state,
  resourceCopyRepositoryTargetId as targetId,
} from "./helpers/resource-copy-repository-harness";

const repo = new ResourceCopiesRepository();
const command = resourceCopyRepositoryCommand(resourceCopyPreview(source).reviewDigest);
const row = resourceCopyRepositoryRow(command);

installResourceCopyRepositoryHooks();

it("copies only whitelisted metadata and detects source changes without relying solely on timestamps", () => {
  const preview = resourceCopyPreview({
    ...source,
    compatibility: { ...metadata.compatibility, privateToken: "secret" },
  } as typeof source);
  expect(preview.metadata).toEqual(metadata);
  expect(JSON.stringify(preview)).not.toContain("secret");
  expect(
    resourceCopyPreview({ ...source, description: "Changed resource description" }).reviewDigest,
  ).not.toBe(preview.reviewDigest);
  expect(resourceCopyPreview({ ...source, organizationId: "org_a" }).reviewDigest).not.toBe(
    preview.reviewDigest,
  );
});

it.each([{ price: 20 }, { status: "suspended" }])("refuses restricted sources %j", (fields) =>
  expect(() => resourceCopyPreview({ ...source, ...fields } as typeof source)).toThrow(),
);

it("reads frozen terms while returning current target status separately", async () => {
  state.rows = [
    [],
    [],
    [product()],
    [["usr_a", "developer"]],
    [record(row)],
    [product({ ...source, id: targetId, title: "Later edited title", status: "archived" })],
    [["usr_a", "developer"]],
  ];
  const detail = await repo.detail("usr_a", sourceId, receiptId);
  expect(detail.receipt.target.title).toBe(command.title);
  expect(detail.targetStatus).toBe("archived");
  expect(state.options).toEqual([{ isolationLevel: "repeatable read" }]);
});

it("never forwards actor identities, request keys or arbitrary snapshot extras", () => {
  const result = resourceCopyReceipt({
    ...row,
    snapshot: { ...(row.snapshot as object), privateStorageKey: "secret" },
  });
  expect(Object.keys(result)).toEqual(["id", "createdAt", "source", "target", "metadata"]);
  expect(JSON.stringify(result)).not.toContain("secret");
  expect(() => resourceCopyReceipt({ ...row, snapshot: { version: 1 } })).toThrow();
});

it("bounds history to current managed targets and stable twenty-row pages", async () => {
  state.rows = [[], [], [product()], [["usr_a", "developer"]], [[0]], []];
  const result = await repo.page("usr_a", sourceId, 9999, 30);
  expect(result.page).toBe(1);
  expect(result.pageSize).toBe(20);
  expect(result.copies).toEqual([]);
  const query = state.queries.at(-1);
  if (!query) throw new Error("Missing history query");
  expect(query.sql).toContain('inner join "products"');
  expect(query.sql).toContain("manage_products");
  expect(query.sql).toContain('order by "resource_draft_copies"."created_at" desc');
});
