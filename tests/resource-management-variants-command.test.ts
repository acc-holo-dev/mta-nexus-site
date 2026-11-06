import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createResourceManagementDbMock } = await import("./helpers/resource-management-harness");
  return createResourceManagementDbMock();
});

import { ResourceVariantsRepository } from "../packages/db/src/repositories/resource-variants";
import { productVariantGroups } from "../packages/db/src/schema";
import {
  actor,
  input,
  resetResourceManagementState,
  revision,
  row,
  save,
  resourceManagementState as state,
} from "./helpers/resource-management-harness";

const variants = new ResourceVariantsRepository();

beforeEach(() => {
  resetResourceManagementState();
});

it("creates a group with sorted product locks and durable audit, without touching grants/releases or money", async () => {
  state.results = [
    [],
    [
      ["prd_a", actor.id, null, 0],
      ["prd_b", actor.id, null, 0],
    ],
    [[actor.id, "developer"]],
    [],
    [],
    [],
    [],
    [],
    [],
  ];
  expect(await variants.command({ ...input, command: save })).toEqual({
    productId: "prd_a",
    groupId: "vgrp_new",
    revision: 1,
  });
  const sql = state.queries.map((query) => query.sql).join("\n");
  expect(state.queries[1].sql).toMatch(/order by "products"\."id" asc for no key update/);
  expect(state.queries[2].sql).toContain("for share");
  expect(sql).toContain('insert into "product_variant_members"');
  expect(sql).toContain('insert into "audit_events"');
  expect(sql).not.toMatch(
    /insert into "(entitlements|licenses|orders|payments|ledger_entries|builds)"|update "(products|builds)"/,
  );
});
it("checks anchor inclusion before opening a transaction", async () => {
  await expect(
    variants.command({
      ...input,
      command: { ...save, variants: [{ productId: "prd_b", label: "Lite" }] },
    }),
  ).rejects.toMatchObject({ code: "RESOURCE_VARIANTS_ANCHOR_MISSING" });
  expect(state.queries).toHaveLength(0);
});
it("rejects another publisher even when both products are locked", async () => {
  state.results = [
    [],
    [
      ["prd_a", actor.id, null, 0],
      ["prd_b", "usr_other", null, 0],
    ],
    [[actor.id, "developer"]],
    [],
    [],
  ];
  await expect(variants.command({ ...input, command: save })).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries.every((query) => !query.sql.startsWith("insert"))).toBe(true);
});
it("rechecks live management authority and aborts when an organization member loses permission", async () => {
  state.results = [
    [],
    [
      ["prd_a", "old_author", "org_a", 0],
      ["prd_b", "other_author", "org_a", 0],
    ],
    [["usr_owner"]],
    [[actor.id, "developer"]],
    [["member", []]],
  ];
  await expect(variants.command({ ...input, command: save })).rejects.toMatchObject({
    statusCode: 404,
  });
  expect(state.queries.map((query) => query.sql).join("\n")).toContain('"organization_members"');
  expect(state.queries.every((query) => !query.sql.startsWith("insert"))).toBe(true);
});
it("rejects group replacement with the same revision but another identity (delete/recreate)", async () => {
  state.results = [
    [["vgrp_recreated", 1]],
    [["prd_a"]],
    [
      ["prd_a", actor.id, null, 0],
      ["prd_b", actor.id, null, 0],
    ],
    [[actor.id, "developer"]],
    [
      row(productVariantGroups, {
        id: "vgrp_recreated",
        anchorProductId: "prd_a",
        title: "Other",
        revision: 1,
        createdAt: revision,
        updatedAt: revision,
      }),
    ],
  ];
  await expect(
    variants.command({
      ...input,
      command: { ...save, expectedGroupId: "vgrp_old", expectedRevision: 1 },
    }),
  ).rejects.toMatchObject({ code: "RESOURCE_VARIANTS_CONFLICT" });
  expect(
    state.queries.every(
      (query) => !query.sql.startsWith("delete") && !query.sql.startsWith("insert"),
    ),
  ).toBe(true);
});
it("rejects a product already occupied by another group before deleting existing links", async () => {
  state.results = [
    [],
    [
      ["prd_a", actor.id, null, 0],
      ["prd_b", actor.id, null, 0],
    ],
    [[actor.id, "developer"]],
    [],
    [],
    [["prd_b"]],
  ];
  await expect(variants.command({ ...input, command: save })).rejects.toMatchObject({
    code: "RESOURCE_VARIANTS_CONFLICT",
  });
  expect(
    state.queries.every(
      (query) => !query.sql.startsWith("delete") && !query.sql.startsWith("insert"),
    ),
  ).toBe(true);
});
it("rejects changed membership snapshots even if a guessed future revision matches after waiting", async () => {
  state.results = [
    [["vgrp_a", 1]],
    [["prd_a"]],
    [
      ["prd_a", actor.id, null, 0],
      ["prd_b", actor.id, null, 0],
    ],
    [[actor.id, "developer"]],
    [
      row(productVariantGroups, {
        id: "vgrp_a",
        anchorProductId: "prd_a",
        title: "Editions",
        revision: 2,
        createdAt: revision,
        updatedAt: revision,
      }),
    ],
  ];
  await expect(
    variants.command({
      ...input,
      command: { ...save, expectedGroupId: "vgrp_a", expectedRevision: 2 },
    }),
  ).rejects.toMatchObject({ code: "RESOURCE_VARIANTS_CONFLICT" });
  expect(
    state.queries.every(
      (query) => !query.sql.startsWith("delete") && !query.sql.startsWith("insert"),
    ),
  ).toBe(true);
});
it("replaces labels and order atomically and advances the group revision", async () => {
  state.results = [
    [["vgrp_a", 3]],
    [["prd_a"], ["prd_b"]],
    [
      ["prd_a", actor.id, null, 0],
      ["prd_b", actor.id, null, 0],
    ],
    [[actor.id, "developer"]],
    [
      row(productVariantGroups, {
        id: "vgrp_a",
        anchorProductId: "prd_a",
        title: "Editions",
        revision: 3,
        createdAt: revision,
        updatedAt: revision,
      }),
    ],
    [["vgrp_a"]],
    [],
    [],
    [],
    [],
    [],
  ];
  expect(
    await variants.command({
      ...input,
      command: {
        ...save,
        expectedGroupId: "vgrp_a",
        expectedRevision: 3,
        variants: [
          { productId: "prd_b", label: "Lite'); drop table licenses; --" },
          { productId: "prd_a", label: "Base" },
        ],
      },
    }),
  ).toMatchObject({ groupId: "vgrp_a", revision: 4 });
  const inserts = state.queries.filter((query) => query.sql.startsWith("insert"));
  expect(inserts[0].params).toContain("Lite'); drop table licenses; --");
  expect(inserts[0].sql).not.toContain("drop table");
  expect(state.queries.find((query) => query.sql.startsWith("update"))?.params).toContain(4);
});
it("removes only the group, leaving resource grants and publications intact", async () => {
  state.results = [
    [["vgrp_a", 4]],
    [["prd_a"]],
    [["prd_a", actor.id, null, 0]],
    [[actor.id, "developer"]],
    [
      row(productVariantGroups, {
        id: "vgrp_a",
        anchorProductId: "prd_a",
        title: "Editions",
        revision: 4,
        createdAt: revision,
        updatedAt: revision,
      }),
    ],
    [["vgrp_a"]],
    [],
    [],
  ];
  expect(
    await variants.command({
      ...input,
      command: {
        action: "remove",
        expectedGroupId: "vgrp_a",
        expectedRevision: 4,
        reason: "Remove the links",
      },
    }),
  ).toMatchObject({ groupId: null, revision: 0 });
  expect(
    state.queries.filter((query) => query.sql.startsWith("delete")).map((query) => query.sql),
  ).toEqual([expect.stringContaining('delete from "product_variant_groups"')]);
});
