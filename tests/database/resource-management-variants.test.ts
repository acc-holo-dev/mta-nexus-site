import { sameResourcePublisher } from "@nexus/domain";
import { resourceVariantCommandSchema } from "@nexus/validation";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../../site/packages/db/src/client", async () => {
  const { createResourceManagementDbMock } = await import("../helpers/resource-management-harness");
  return createResourceManagementDbMock();
});

import { ResourceVariantsRepository } from "../../site/packages/db/src/repositories/resource-variants";
import { productVariantGroups } from "../../site/packages/db/src/schema";
import {
  actor,
  input,
  parent,
  resetResourceManagementState,
  revision,
  row,
  save,
  resourceManagementState as state,
} from "../helpers/resource-management-harness";

const variants = new ResourceVariantsRepository();

beforeEach(() => {
  resetResourceManagementState();
});

it("bounds variants, enforces unique normalized labels/IDs and rejects caller-controlled grant/pricing changes", () => {
  expect(resourceVariantCommandSchema.safeParse(save).success).toBe(true);
  expect(
    resourceVariantCommandSchema.safeParse({
      action: "remove",
      expectedGroupId: "vgrp_a",
      expectedRevision: 2_147_483_647,
      reason: "Remove the links",
    }).success,
  ).toBe(true);
  for (const extra of [
    { entitlements: ["product.download"] },
    { status: "published" },
    { authorId: "other" },
    { expectedRevision: 1 },
    { variants: Array.from({ length: 13 }, (_, i) => ({ productId: `prd_${i}`, label: `${i}` })) },
    {
      variants: [
        { productId: "prd_a", label: "Base" },
        { productId: "prd_a", label: "Lite" },
      ],
    },
    {
      variants: [
        { productId: "prd_a", label: "Base" },
        { productId: "prd_b", label: " base " },
      ],
    },
  ])
    expect(resourceVariantCommandSchema.safeParse({ ...save, ...extra }).success).toBe(false);
});
it("keeps publisher identity separate from historical author attribution for organization resources", () => {
  expect(sameResourcePublisher(parent, { authorId: actor.id, organizationId: null })).toBe(true);
  expect(sameResourcePublisher(parent, { authorId: actor.id, organizationId: "org_b" })).toBe(
    false,
  );
  expect(
    sameResourcePublisher(
      { authorId: "old", organizationId: "org_a" },
      { authorId: "new", organizationId: "org_a" },
    ),
  ).toBe(true);
  expect(
    sameResourcePublisher(
      { authorId: "old", organizationId: "org_a" },
      { authorId: "old", organizationId: null },
    ),
  ).toBe(false);
});
it("projects only live scanned public variants and requires a public anchor within one publisher", async () => {
  state.results = [[["vgrp_a", "Editions"]], [["prd_a", "Base", "Resource", "resource", "1.0.0"]]];
  expect(await variants.publicVariants("prd_a")).toEqual({
    title: "Editions",
    variants: [
      {
        productId: "prd_a",
        label: "Base",
        title: "Resource",
        slug: "resource",
        currentVersion: "1.0.0",
      },
    ],
  });
  expect(state.options).toEqual([{ isolationLevel: "repeatable read", accessMode: "read only" }]);
  const sql = state.queries.map((query) => query.sql).join("\n");
  expect(sql).toContain('"variant_anchor"."status"');
  expect(sql).toContain("btrim(");
  expect(sql).toContain("'clean'");
  expect(sql).toContain("'published'");
  expect(sql).toContain('"variant_anchor"."organization_id"');
  expect(sql).not.toMatch(/storage_key|quarantine_reason|password_hash|entitlements/);
});
it("never queries a private family from an unavailable starting resource", async () => {
  state.results = [[]];
  expect(await variants.publicVariants("prd_private")).toBeNull();
  expect(state.queries).toHaveLength(1);
});
it("scopes managed reads before discovering group membership", async () => {
  await expect(variants.managed("prd_private", actor)).rejects.toMatchObject({ statusCode: 404 });
  expect(state.queries).toHaveLength(1);
  expect(state.queries[0].sql).toContain("manage_products");
});
it("bounds candidates and excludes resources attached to another group", async () => {
  state.results = [[[actor.id, null]], [["vgrp_a"]], []];
  expect(await variants.candidates("prd_a", actor, Infinity)).toMatchObject({
    page: 1,
    hasMore: false,
  });
  const sql = state.queries[2].sql;
  expect(sql).toContain("not exists");
  expect(sql).toContain("manage_products");
  expect(state.queries[2].params).toContain(25);
  expect(state.queries[2].params).toContain("vgrp_a");
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
