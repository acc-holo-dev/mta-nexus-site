import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/repositories/entitlements", async (importOriginal) => {
  const { resourceCartReceiptsRepositoryState } = await import(
    "./helpers/resource-cart-receipts-repository-harness"
  );
  return {
    ...(await importOriginal<typeof import("../packages/db/src/repositories/entitlements")>()),
    claimFreeResourcesInTransaction: resourceCartReceiptsRepositoryState.claim,
  };
});
vi.mock("../packages/db/src/client", async () => {
  const { createResourceCartReceiptsRepositoryDbMock } = await import(
    "./helpers/resource-cart-receipts-repository-harness"
  );
  return createResourceCartReceiptsRepositoryDbMock();
});

import { resourceCartReceiptsRepository as receipts } from "../packages/db/src/repositories/resource-cart-receipts";
import {
  installResourceCartReceiptsRepositoryHooks,
  resourceCartReceiptsRepositoryRequestId as requestId,
  resourceCartReceiptsRepositoryRow as row,
  resourceCartReceiptsRepositoryState as state,
} from "./helpers/resource-cart-receipts-repository-harness";

installResourceCartReceiptsRepositoryHooks();

it("keeps frozen receipt metadata while separately checking current exact-version access", async () => {
  const {
    metadataRevision: _revision,
    available: _available,
    alreadyOwned: _owned,
    ...evidence
  } = row;
  const snapshot = [
    { ...evidence, alreadyClaimed: false, accessSource: "entitlement", recordedExpiresAt: null },
  ];
  state.rows = [
    [[requestId, "2026-10-11T00:00:00Z", ["prd_a"], snapshot, "a".repeat(64)]],
    [{ productId: "prd_a", buildId: "bld_a", hasCurrentAccess: false, downloadable: false }],
  ];
  const result = await receipts.detail("usr_a", requestId);
  expect(result.items[0]).toMatchObject({ title: "Original title", downloadable: false });
  expect(state.queries[0].params).toEqual(["usr_a", requestId, 1]);
  expect(state.queries[1].sql).toContain('snapshot."sha256Hash"');
  expect(state.queries[1].sql).not.toContain('"products"."title"');
});
it("legacy receipts do not invent historical versions or query current catalog metadata", async () => {
  state.rows = [[[requestId, "2026-10-11T00:00:00Z", ["prd_a"], null, null]]];
  expect(await receipts.detail("usr_a", requestId)).toMatchObject({
    reviewed: false,
    items: [],
    legacyProductCount: 1,
  });
  expect(state.queries).toHaveLength(1);
});
it("bounds filtered receipt history in one account and returns no result payload", async () => {
  state.rows = [[[41]], []];
  await receipts.page("usr_a", { page: 99, days: 7, evidence: "reviewed" });
  expect(state.queries[1].params.at(-2)).toBe(20);
  expect(state.queries[1].params.at(-1)).toBe(40);
  expect(state.queries[1].sql).not.toContain('"result"');
  expect(state.queries[0].params).toContain("usr_a");
});
