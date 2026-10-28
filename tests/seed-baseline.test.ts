import assert from "node:assert/strict";
import { getTableName, type SQL } from "drizzle-orm";
import { PgDialect, type PgTable } from "drizzle-orm/pg-core";
import { beforeEach, expect, it, vi } from "vitest";

type Row = { id: string; [key: string]: unknown };
const state = vi.hoisted(() => ({ rows: {} as Record<string, Row[]>, failAudit: false, locks: 0 }));
vi.mock("../packages/db/src/client", () => ({
  db: {
    transaction: async (work: (tx: unknown) => Promise<unknown>) => {
      const rows = structuredClone(state.rows);
      const params = (condition: SQL) => new PgDialect().sqlToQuery(condition).params;
      const tx = {
        execute: async () => {
          state.locks++;
        },
        select: () => ({
          from: (table: PgTable) => ({
            where: (condition: SQL) => ({
              for: async () =>
                (rows[getTableName(table)] ?? []).filter((row) =>
                  params(condition).includes(row.id),
                ),
            }),
          }),
        }),
        insert: (table: PgTable) => ({
          values: (input: Row | Row[]) => {
            const name = getTableName(table);
            if (name === "audit_events" && state.failAudit) throw new Error("audit unavailable");
            rows[name] ??= [];
            const target = rows[name];
            const inserted: Row[] = [];
            for (const row of Array.isArray(input) ? input : [input]) {
              if (target.some((current) => current.id === row.id)) continue;
              if (row.slug && target.some((current) => current.slug === row.slug))
                throw new Error("slug collision");
              target.push(structuredClone(row));
              inserted.push(row);
            }
            return Object.assign(Promise.resolve(inserted), {
              onConflictDoNothing: () => ({ returning: async () => inserted }),
            });
          },
        }),
        update: (table: PgTable) => ({
          set: (values: Record<string, unknown>) => ({
            where: async (condition: SQL) => {
              for (const row of rows[getTableName(table)] ?? [])
                if (params(condition).includes(row.id)) Object.assign(row, values);
            },
          }),
        }),
      };
      const result = await work(tx);
      state.rows = rows;
      return result;
    },
  },
}));

import { seedBaseline } from "../packages/db/src/seed-baseline";
import { createSeedData } from "../packages/db/src/seed-data";

function fixtures() {
  return createSeedData("test-password-hash", {
    inventory: {
      storageKey: "builds/prd_inv_pro/v3.2.0.zip",
      sha256Hash: "a".repeat(64),
      fileSizeBytes: 512,
    },
    drift: {
      storageKey: "builds/prd_drift_physics/v2.1.4.zip",
      sha256Hash: "b".repeat(64),
      fileSizeBytes: 600,
    },
  });
}
beforeEach(() => {
  state.rows = {};
  state.failAudit = false;
  state.locks = 0;
});

it("inserts the baseline once and does not audit a no-op rerun", async () => {
  expect(await seedBaseline(fixtures())).toEqual({
    inserted: 13,
    repairedBuilds: 0,
    repairedMedia: 0,
  });
  expect(await seedBaseline(fixtures())).toEqual({
    inserted: 0,
    repairedBuilds: 0,
    repairedMedia: 0,
  });
  expect(state.rows.audit_events).toHaveLength(1);
  expect(state.locks).toBe(2);
});

it("ships a baseline with no auto-fetched remote media", () => {
  const data = fixtures();
  const remote = /^https?:\/\//iu;
  const values = [
    ...data.users.map((row) => Reflect.get(row, "avatarUrl")),
    ...data.organizations.flatMap((row) => [Reflect.get(row, "logoUrl")]),
    ...data.servers.flatMap((row) => [Reflect.get(row, "bannerUrl"), Reflect.get(row, "logoUrl")]),
    ...data.products.flatMap((row) => [Reflect.get(row, "thumbnailUrl"), ...row.screenshots]),
    ...data.content.map((row) => Reflect.get(row, "coverImageUrl")),
  ].filter((value): value is string => typeof value === "string");

  expect(values.filter((value) => remote.test(value))).toEqual([]);
});

it("repairs only exact legacy demo media and preserves custom replacements", async () => {
  await seedBaseline(fixtures());

  const user = state.rows.users.find((row) => row.id === "usr_admin_001");
  const customUser = state.rows.users.find((row) => row.id === "usr_dev_001");
  const organization = state.rows.organizations.find((row) => row.id === "org_horizon");
  const server = state.rows.servers.find((row) => row.id === "srv_drift_01");
  const product = state.rows.products.find((row) => row.id === "prd_inv_pro");
  const article = state.rows.content.find((row) => row.id === "cnt_art_001");
  assert.ok(user && customUser && organization && server && product && article);

  user.avatarUrl = "https://api.dicebear.com/7.x/bottts/svg?seed=nexus_admin";
  customUser.avatarUrl = "https://media.example/custom.svg";
  organization.logoUrl = "https://api.dicebear.com/7.x/shapes/svg?seed=horizon-interactive";
  server.bannerUrl =
    "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=1200&q=80";
  server.logoUrl = "https://api.dicebear.com/7.x/identicon/svg?seed=sa-drift-paradise";
  product.thumbnailUrl =
    "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80";
  product.screenshots = [
    "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80",
  ];
  article.coverImageUrl =
    "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80";

  expect(
    await seedBaseline(fixtures(), {
      repairDemoMedia: true,
    }),
  ).toEqual({
    inserted: 0,
    repairedBuilds: 0,
    repairedMedia: 5,
  });

  expect(state.rows.users.find((row) => row.id === "usr_admin_001")?.avatarUrl).toBeNull();
  expect(state.rows.users.find((row) => row.id === "usr_dev_001")?.avatarUrl).toBe(
    "https://media.example/custom.svg",
  );
  expect(state.rows.organizations.find((row) => row.id === "org_horizon")?.logoUrl).toBeNull();
  expect(state.rows.servers.find((row) => row.id === "srv_drift_01")).toMatchObject({
    bannerUrl: null,
    logoUrl: null,
  });
  expect(state.rows.products.find((row) => row.id === "prd_inv_pro")).toMatchObject({
    thumbnailUrl: null,
    screenshots: [],
  });
  expect(state.rows.content.find((row) => row.id === "cnt_art_001")?.coverImageUrl).toBeNull();
  expect(state.rows.audit_events).toHaveLength(2);
});

it("preserves passwords, roles, edited content and retired builds on rerun", async () => {
  await seedBaseline(fixtures());
  Object.assign(state.rows.users[0], { passwordHash: "changed", role: "user" });
  state.rows.products[0].title = "My edited resource";
  state.rows.builds[0].status = "retired";
  state.rows.servers[0].organizationId = null;
  await seedBaseline(fixtures());
  expect(state.rows.users[0]).toMatchObject({ passwordHash: "changed", role: "user" });
  expect(state.rows.products[0].title).toBe("My edited resource");
  expect(state.rows.builds[0].status).toBe("retired");
});

it("rolls back all database writes when the audit fails", async () => {
  state.failAudit = true;
  await expect(seedBaseline(fixtures())).rejects.toThrow("audit unavailable");
  expect(state.rows).toEqual({});
});

it("refuses occupied identities and unrelated slug collisions without partial writes", async () => {
  state.rows.users = [{ id: "usr_admin_001", email: "other@example.com", username: "other" }];
  const before = structuredClone(state.rows);
  await expect(seedBaseline(fixtures())).rejects.toThrow("identity conflict");
  expect(state.rows).toEqual(before);
  state.rows = { products: [{ id: "unrelated", slug: "nexus-grid-inventory-pro" }] };
  const collision = structuredClone(state.rows);
  await expect(seedBaseline(fixtures())).rejects.toThrow("slug collision");
  expect(state.rows).toEqual(collision);
});

it("requires explicit metadata repair and preserves the moderation state", async () => {
  await seedBaseline(fixtures());
  Object.assign(state.rows.builds[0], {
    fileSizeBytes: 999,
    sha256Hash: "legacy",
    status: "retired",
  });
  await expect(seedBaseline(fixtures())).rejects.toThrow("db:seed:repair");
  expect(state.rows.builds[0].fileSizeBytes).toBe(999);
  expect(await seedBaseline(fixtures(), { repairDemoBuilds: true })).toEqual({
    inserted: 0,
    repairedBuilds: 1,
    repairedMedia: 0,
  });
  expect(state.rows.builds[0]).toMatchObject({
    fileSizeBytes: 512,
    sha256Hash: "a".repeat(64),
    status: "retired",
  });
  expect(state.rows.audit_events).toHaveLength(2);
});

it("does not repair a build with different provenance", async () => {
  await seedBaseline(fixtures());
  state.rows.builds[0].scanner = "another-scanner";
  await expect(seedBaseline(fixtures(), { repairDemoBuilds: true })).rejects.toThrow(
    "identity conflict",
  );
});

it("does not recreate a demo build for a modified product", async () => {
  await seedBaseline(fixtures());
  state.rows.builds.shift();
  state.rows.products[0].currentVersion = "4.0.0";
  await expect(seedBaseline(fixtures())).rejects.toThrow("modified product");
  expect(state.rows.builds).toHaveLength(1);
});
