import { expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createResourceCommerceRepositoryDbMock } = await import(
    "./helpers/resource-commerce-repository-harness"
  );
  return createResourceCommerceRepositoryDbMock();
});

import { BuildRepository } from "../packages/db/src/repositories/builds";
import { OrderRepository } from "../packages/db/src/repositories/orders";
import { ProductLifecycleRepository } from "../packages/db/src/repositories/product-lifecycle";
import {
  installResourceCommerceRepositoryHooks,
  resourceCommerceRepositoryCommand as command,
  resourceCommerceRepositoryProductRow as productRow,
  resourceCommerceRepositoryRevision as revision,
  resourceCommerceRepositoryState as state,
} from "./helpers/resource-commerce-repository-harness";

const lifecycle = new ProductLifecycleRepository();

installResourceCommerceRepositoryHooks();

it("checks current authority, updates the revision, and audits an archive", async () => {
  state.results = [
    [productRow()],
    [["usr_a", "developer"]],
    [productRow({ status: "archived", updatedAt: "2026-10-10T00:00:00.001Z" })],
    [],
  ];
  expect(await lifecycle.transition(command)).toMatchObject({ id: "prd_a", status: "archived" });
  expect(state.queries[0].sql).toContain("for no key update");
  expect(state.queries[1].sql).toContain("for share");
  expect(state.queries[2].sql).toContain("interval '1 millisecond'");
  expect(state.queries[3].params).toContain("product.archive");
});

it.each(["suspended", "archived"])("cannot archive a %s resource", async (status) => {
  state.results = [[productRow({ status })], [["usr_a", "developer"]]];
  await expect(lifecycle.transition(command)).rejects.toMatchObject({
    code: "PRODUCT_STATE_CHANGED",
  });
  expect(state.queries.some((query) => query.sql.startsWith("update"))).toBe(false);
});

it("hides a resource from a former owner after current authority is checked", async () => {
  state.results = [[productRow({ authorId: "usr_other" })], [["usr_a", "developer"]]];
  await expect(lifecycle.transition(command)).rejects.toMatchObject({ code: "NOT_FOUND" });
  expect(state.queries).toHaveLength(2);
});

it("does not apply a stale publication command", async () => {
  state.results = [[productRow({ updatedAt: "2026-10-10T01:00:00Z" })], [["usr_a", "developer"]]];
  await expect(lifecycle.transition(command)).rejects.toMatchObject({
    code: "PRODUCT_METADATA_CONFLICT",
  });
  expect(state.queries.some((query) => query.sql.startsWith("update"))).toBe(false);
});

it("restores every former public version to draft without publishing the resource", async () => {
  state.results = [
    [productRow({ status: "archived" })],
    [["usr_a", "developer"]],
    [["bld_a"]],
    [],
    [productRow({ status: "draft" })],
    [],
  ];
  expect(await lifecycle.transition({ ...command, action: "restore" })).toMatchObject({
    status: "draft",
  });
  const update = state.queries.find((query) => query.sql.startsWith('update "builds"'));
  expect(update?.params).toEqual(["draft", "prd_a", "published", "pending_review"]);
  expect(update?.sql).not.toContain("quarantine");
});

it("requires a clean draft for resubmission and prevents archived moderation", async () => {
  state.results = [[productRow({ status: "draft" })], [["usr_a", "developer"]], []];
  await expect(lifecycle.transition({ ...command, action: "submit" })).rejects.toMatchObject({
    code: "RESOURCE_REVIEW_BUILD_REQUIRED",
  });
  expect(state.queries[2].sql).toContain('"builds"."scan_status"');
  state.queries = [];
  state.results = [
    [["prd_a"]],
    [["prd_a", "archived", "usr_a", null]],
    [["moderator"]],
    [["ses_staff", "2099-01-01T00:00:00.000Z"]],
  ];
  await expect(
    new BuildRepository().moderatePending(
      "bld_a",
      "approve",
      {
        id: "aud_a",
        actorId: "usr_moderator",
        actorType: "user",
        action: "build.approved",
        targetId: "bld_a",
        targetType: "build",
      },
      1,
      "staff-session",
    ),
  ).rejects.toMatchObject({ code: "PRODUCT_STATE_CHANGED" });
  expect(state.queries.some((query) => query.sql.startsWith("update"))).toBe(false);
});

it("does not read line items for another buyer's order", async () => {
  expect(await new OrderRepository().buyerDetails("ord_other", "usr_a")).toBeNull();
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].params).toEqual(["ord_other", "usr_a", 1]);
  expect(state.queries[0].sql).not.toContain("payments");
});

it("reads receipt amounts and current access in a bounded, read-only snapshot", async () => {
  state.results = [
    [["ord_a", "NX-001", "completed", 4500, "USD", revision.toISOString(), revision.toISOString()]],
    [[21]],
    [["itm_a", "prd_a", 4500, "USD", "Public resource", "public-resource", true]],
  ];
  const result = await new OrderRepository().buyerDetails("ord_a", "usr_a", 2);
  expect(result).toMatchObject({
    order: { totalAmount: 4500 },
    items: [{ hasCurrentAccess: true }],
    page: 2,
    totalPages: 2,
  });
  expect(state.options[0]).toEqual({ isolationLevel: "repeatable read", accessMode: "read only" });
  const query = state.queries[2];
  expect(query.sql).toContain("case when");
  expect(query.sql).toContain("coalesce");
  expect(query.sql).toContain('"entitlements"."permission" = \'product.download\'');
  expect(query.params.slice(-3)).toEqual(["ord_a", 20, 20]);
  expect(query.sql).not.toContain('"licenses"."key"');
});
