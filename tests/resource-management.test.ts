import { sameResourcePublisher } from "@nexus/domain";
import {
  mtaVersionSchema,
  resourceCompatibilitySchema,
  resourceVariantCommandSchema,
} from "@nexus/validation";
import { getTableColumns } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vitest";
import {
  confirmedCompatibility,
  confirmedVariantCommand,
} from "../apps/web/src/lib/resource-management-confirmation";

const state = vi.hoisted(() => ({
  queries: [] as { sql: string; params: unknown[] }[],
  results: [] as unknown[][][],
  options: [] as unknown[],
}));
vi.mock("../packages/db/src/client", async () => {
  const { drizzle } = await import("drizzle-orm/pg-proxy");
  const database = drizzle(async (sql, params) => {
    state.queries.push({ sql, params });
    return { rows: state.results.shift() ?? [] };
  });
  return {
    db: new Proxy(database, {
      get(target, key) {
        if (key === "transaction")
          return async (callback: (tx: typeof database) => unknown, options?: unknown) => {
            state.options.push(options);
            return callback(database);
          };
        const value = Reflect.get(target, key);
        return typeof value === "function" ? value.bind(target) : value;
      },
    }),
  };
});

import type { Build, ResourceVariantCommand } from "@nexus/domain";
import { BuildReviewDownloadRepository } from "../packages/db/src/repositories/build-review-download";
import { ResourceCompatibilityRepository } from "../packages/db/src/repositories/resource-compatibility";
import { ResourceVariantsRepository } from "../packages/db/src/repositories/resource-variants";
import { builds, products, productVariantGroups } from "../packages/db/src/schema";

const variants = new ResourceVariantsRepository(),
  compatibility = new ResourceCompatibilityRepository(),
  review = new BuildReviewDownloadRepository();
const revision = "2026-10-10T00:00:00.000Z",
  updated = "2026-10-10T00:00:00.001Z";
const actor = { id: "usr_a", role: "developer" as const };
const input = { productId: "prd_a", actorId: actor.id, groupId: "vgrp_new", auditId: "aud_a" };
const save: ResourceVariantCommand = {
  action: "save",
  expectedGroupId: null,
  expectedRevision: 0,
  title: "Resource editions",
  variants: [
    { productId: "prd_a", label: "Base" },
    { productId: "prd_b", label: "Lite" },
  ],
  reason: "Group related resources",
};
function row(
  table: typeof products | typeof builds | typeof productVariantGroups,
  values: Record<string, unknown>,
) {
  return Object.keys(getTableColumns(table)).map((key) => values[key] ?? null);
}
const parent = {
  id: "prd_a",
  authorId: actor.id,
  organizationId: null,
  price: 0,
  slug: "resource-a",
  status: "published",
  updatedAt: revision,
  compatibility: {},
};
const artifact = {
  id: "bld_a",
  productId: "prd_a",
  version: "1.0.0",
  status: "pending_review",
  scanStatus: "clean",
  scanner: "scanner",
  scannedAt: new Date(revision),
  storageKey: "private/artifact.zip",
  sha256Hash: "a".repeat(64),
  fileSizeBytes: 4,
  fileName: "artifact.zip",
  mimeType: "application/zip",
  isSigned: false,
  createdAt: new Date(revision),
} as Build;
beforeEach(() => {
  state.queries = [];
  state.results = [];
  state.options = [];
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
    [[actor.id, "developer"]],
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
  state.results = [[row(products, parent)], [[actor.id, "developer"]]];
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
  state.results = [[row(products, { ...parent, status: "suspended" })], [[actor.id, "developer"]]];
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
it("authorizes reviewer evidence with live role and exact artifact before the audit commits", async () => {
  state.results = [
    [["prd_a"]],
    [["moderator"]],
    [row(builds, artifact as unknown as Record<string, unknown>)],
    [],
  ];
  await review.authorize({ actorId: "usr_mod", auditId: "aud_a", expected: artifact });
  expect(state.queries.map((query) => query.sql).join("\n")).toMatch(
    /products[\s\S]*for share[\s\S]*users[\s\S]*for share[\s\S]*builds[\s\S]*for share[\s\S]*insert into "audit_events"/,
  );
});
it("denies a reviewer whose role was revoked while opening storage", async () => {
  state.results = [[["prd_a"]], [["user"]]];
  await expect(
    review.authorize({ actorId: "usr_mod", auditId: "aud_a", expected: artifact }),
  ).rejects.toMatchObject({ statusCode: 403 });
  expect(state.queries.every((query) => !query.sql.startsWith("insert"))).toBe(true);
});
it.each([
  { status: "retired" },
  { storageKey: "private/changed.zip" },
  { scanStatus: "malicious" },
  { scanner: "different" },
  { scannedAt: new Date(updated) },
  { sha256Hash: "b".repeat(64) },
  { productId: "prd_b" },
])("denies changed reviewer evidence ($status $scanStatus $storageKey)", async (changed) => {
  state.results = [[["prd_a"]], [["moderator"]], [row(builds, { ...artifact, ...changed })]];
  await expect(
    review.authorize({ actorId: "usr_mod", auditId: "aud_a", expected: artifact }),
  ).rejects.toMatchObject({ code: "BUILD_STATE_CHANGED" });
  expect(state.queries.every((query) => !query.sql.startsWith("insert"))).toBe(true);
});
