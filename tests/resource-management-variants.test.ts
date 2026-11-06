import { sameResourcePublisher } from "@nexus/domain";
import { resourceVariantCommandSchema } from "@nexus/validation";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("../packages/db/src/client", async () => {
  const { createResourceManagementDbMock } = await import("./helpers/resource-management-harness");
  return createResourceManagementDbMock();
});

import { ResourceVariantsRepository } from "../packages/db/src/repositories/resource-variants";
import {
  actor,
  parent,
  resetResourceManagementState,
  save,
  resourceManagementState as state,
} from "./helpers/resource-management-harness";

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
