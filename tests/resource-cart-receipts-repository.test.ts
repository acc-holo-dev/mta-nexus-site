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

import { resourceCartRepository as cart } from "../packages/db/src/repositories/resource-cart";
import {
  installResourceCartReceiptsRepositoryHooks,
  resourceCartReceiptsRepositoryAcquireRows as acquireRows,
  resourceCartReceiptsRepositoryInput as input,
  resourceCartReceiptsRepositoryRequestId as requestId,
  resourceCartReceiptsRepositoryRow as row,
  resourceCartReceiptsRepositoryState as state,
} from "./helpers/resource-cart-receipts-repository-harness";

installResourceCartReceiptsRepositoryHooks();

async function preview() {
  state.rows = [[row]];
  const result = await cart.review("usr_a");
  state.queries = [];
  if (!result.reviewDigest) throw new Error("Missing review");
  return result.reviewDigest;
}

it("reviews only the actor's narrow current public evidence in a stable snapshot", async () => {
  state.rows = [[row]];
  const result = await cart.review("usr_a");
  expect(result.items[0]).not.toHaveProperty("metadataRevision");
  expect(result.reviewDigest).toMatch(/^[a-f0-9]{64}$/u);
  expect(state.queries[0].params).toContain("usr_a");
  expect(state.queries[0].sql).toContain("artifact.file_size_bytes between 1 and 67108864");
  expect(state.queries[0].sql).not.toContain("storage_key");
  expect(state.options[0]).toMatchObject({
    isolationLevel: "repeatable read",
    accessMode: "read only",
  });
});
it("records exact reviewed evidence, result and receipt key atomically without financial operations", async () => {
  const reviewDigest = await preview();
  state.rows = acquireRows();
  expect(await cart.acquire({ ...input, reviewDigest })).toMatchObject({
    requestId,
    acquired: [{ productId: "prd_a", alreadyClaimed: false }],
  });
  expect(state.queries[4].sql).toContain("for no key update");
  expect(state.queries[6].sql).toContain("for share");
  expect(state.claim).toHaveBeenCalledOnce();
  const persisted = state.queries.at(-1);
  if (!persisted) throw new Error("Missing receipt insert");
  expect(persisted.sql).toContain('insert into "resource_cart_acquisitions"');
  expect(persisted.params).toContain(reviewDigest);
  const snapshot = persisted.params.find(
    (value) => typeof value === "string" && value.includes('"accessSource"'),
  );
  expect(JSON.parse(String(snapshot))).toEqual([
    expect.objectContaining({
      title: "Original title",
      buildId: "bld_a",
      version: "1.0.0",
      sha256Hash: "a".repeat(64),
      accessSource: "entitlement",
      recordedExpiresAt: null,
    }),
  ]);
  expect(
    state.queries.some(
      (query) =>
        /"(orders|payments|ledger_entries|licenses)"/.test(query.sql.split(" where ")[0]) &&
        query.sql.startsWith("insert"),
    ),
  ).toBe(false);
});
it.each(["metadataRevision", "buildId", "sha256Hash"])(
  "a changed %s stops acquisition before any grant",
  async (field) => {
    const reviewDigest = await preview();
    state.rows = acquireRows({ ...row, [field]: "changed" });
    await expect(cart.acquire({ ...input, reviewDigest })).rejects.toMatchObject({
      code: "RESOURCE_CART_REVIEW_CHANGED",
    });
    expect(state.claim).not.toHaveBeenCalled();
    expect(state.queries.some((query) => query.sql.startsWith("insert"))).toBe(false);
  },
);
it("rechecks after the selected build lock and preserves finite legacy access facts", async () => {
  const reviewDigest = await preview();
  state.rows = acquireRows(row, { ...row, available: false });
  await expect(cart.acquire({ ...input, reviewDigest })).rejects.toMatchObject({
    code: "RESOURCE_CART_REVIEW_CHANGED",
  });
  expect(state.claim).not.toHaveBeenCalled();
  state.rows = acquireRows();
  state.queries = [];
  state.claim.mockResolvedValueOnce([
    {
      accessSource: "license",
      alreadyClaimed: true,
      entitlement: null,
      license: { expiresAt: new Date("2026-11-01T00:00:00Z") },
    },
  ]);
  await cart.acquire({ ...input, reviewDigest });
  expect(String(state.queries.at(-1)?.params)).toContain("2026-11-01T00:00:00.000Z");
});
it("exact receipt replay survives a cleared cart and refuses a different review", async () => {
  const result = {
    kind: "free_resource_acquisition",
    acquired: [{ productId: "prd_a", alreadyClaimed: false }],
    requestId,
  };
  state.rows = [
    [],
    [[["prd_a"], result, "a".repeat(64)]],
    [["usr_a"]],
    [["ses", "2099-01-01T00:00:00Z"]],
  ];
  expect(await cart.acquire({ ...input, reviewDigest: "a".repeat(64) })).toEqual(result);
  expect(state.queries).toHaveLength(4);
  state.rows = [
    [],
    [[["prd_a"], result, "a".repeat(64)]],
    [["usr_a"]],
    [["ses", "2099-01-01T00:00:00Z"]],
  ];
  await expect(cart.acquire({ ...input, reviewDigest: "b".repeat(64) })).rejects.toMatchObject({
    code: "RESOURCE_CART_REQUEST_CONFLICT",
  });
  expect(state.claim).not.toHaveBeenCalled();
});
