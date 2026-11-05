import { mtaVersionSchema, resourceCompatibilitySchema } from "@nexus/validation";
import { beforeEach, expect, it, vi } from "vitest";
import {
  confirmedCompatibility,
  confirmedVariantCommand,
} from "../apps/web/src/lib/resource-management-confirmation";

vi.mock("../packages/db/src/client", async () => {
  const { createResourceManagementDbMock } = await import("./helpers/resource-management-harness");
  return createResourceManagementDbMock();
});

import { ResourceCompatibilityRepository } from "../packages/db/src/repositories/resource-compatibility";
import { products } from "../packages/db/src/schema";
import {
  input,
  parent,
  resetResourceManagementState,
  revision,
  row,
  save,
  resourceManagementState as state,
  updated,
} from "./helpers/resource-management-harness";

const compatibility = new ResourceCompatibilityRepository();

beforeEach(() => {
  resetResourceManagementState();
});

it("retains the existing MTA version contract and normalizes strict dependency input", () => {
  for (const version of ["1.6.0", "1.6.0-9.22279.0"])
    expect(mtaVersionSchema.safeParse(version).success).toBe(true);
  const parsed = resourceCompatibilitySchema.parse({
    expectedUpdatedAt: revision,
    compatibility: { dependencies: [" Resource-A "] },
  });
  expect(parsed.compatibility.dependencies).toEqual(["resource-a"]);
  for (const compatibility of [
    { mtaMinVersion: "garbage", dependencies: [] },
    { dependencies: ["resource-a", "Resource-A"] },
    { dependencies: ["https://nexus.test/private"] },
    { dependencies: [], status: "published" },
  ])
    expect(
      resourceCompatibilitySchema.safeParse({ expectedUpdatedAt: revision, compatibility }).success,
    ).toBe(false);
});
it("saves requirements atomically with authority, millisecond CAS and audit", async () => {
  state.results = [
    [row(products, parent)],
    [[input.actorId, "developer"]],
    [["prd_a", updated, { dependencies: ["resource-b"] }]],
    [],
  ];
  expect(
    await compatibility.update({
      ...input,
      expectedUpdatedAt: revision,
      compatibility: { dependencies: ["resource-b"] },
    }),
  ).toMatchObject({ id: "prd_a", updatedAt: new Date(updated) });
  const sql = state.queries.map((query) => query.sql).join("\n");
  expect(sql).toContain("interval '1 millisecond'");
  expect(sql).toContain('insert into "audit_events"');
  expect(sql).not.toContain('update "builds"');
});
it.each([
  {
    expectedUpdatedAt: updated,
    compatibility: { dependencies: [] },
    code: "PRODUCT_METADATA_CONFLICT",
  },
  {
    expectedUpdatedAt: revision,
    compatibility: { dependencies: ["resource-a"] },
    code: "RESOURCE_DEPENDENCY_SELF",
  },
])("rejects invalid compatibility without mutating publication ($code)", async (command) => {
  state.results = [[row(products, parent)], [[input.actorId, "developer"]]];
  await expect(compatibility.update({ ...input, ...command })).rejects.toMatchObject({
    code: command.code,
  });
  expect(
    state.queries.every(
      (query) => !query.sql.startsWith("update") && !query.sql.startsWith("insert"),
    ),
  ).toBe(true);
});
it("denies suspended-resource requirements changes", async () => {
  state.results = [
    [row(products, { ...parent, status: "suspended" })],
    [[input.actorId, "developer"]],
  ];
  await expect(
    compatibility.update({
      ...input,
      expectedUpdatedAt: revision,
      compatibility: { dependencies: [] },
    }),
  ).rejects.toMatchObject({ code: "PRODUCT_STATE_CHANGED" });
});
it("confirms exactly the requested group identity/revision and saved compatibility", () => {
  expect(
    confirmedVariantCommand(
      { productId: "prd_a", groupId: "vgrp_new", revision: 1 },
      "prd_a",
      save,
    ),
  ).toBe(true);
  expect(
    confirmedVariantCommand(
      { productId: "prd_b", groupId: "vgrp_new", revision: 1 },
      "prd_a",
      save,
    ),
  ).toBe(false);
  expect(
    confirmedVariantCommand(
      { productId: "prd_a", groupId: "vgrp_new", revision: 2 },
      "prd_a",
      save,
    ),
  ).toBe(false);
  const deps = { dependencies: ["resource-b"] };
  expect(
    confirmedCompatibility(
      { product: { id: "prd_a", updatedAt: updated, compatibility: deps } },
      "prd_a",
      revision,
      deps,
    ),
  ).toBe(true);
  expect(
    confirmedCompatibility(
      { product: { id: "prd_a", updatedAt: revision, compatibility: deps } },
      "prd_a",
      revision,
      deps,
    ),
  ).toBe(false);
  expect(
    confirmedCompatibility(
      { product: { id: "prd_a", updatedAt: updated, compatibility: { dependencies: [] } } },
      "prd_a",
      revision,
      deps,
    ),
  ).toBe(false);
});
