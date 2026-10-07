import { eq, sql } from "drizzle-orm";
import { expect, it, vi } from "vitest";
import type { db as Database } from "../packages/db/src/client";
import {
  users,
  products,
  builds,
  auditEvents,
} from "../packages/db/src/schema";
import { createSeedData } from "../packages/db/src/seed-data";

type Transaction = Parameters<Parameters<typeof Database.transaction>[0]>[0];
const scope = vi.hoisted(() => ({ tx: null as Transaction | null }));
vi.mock("../packages/db/src/client", () => ({
  db: {
    transaction: (work: (tx: Transaction) => Promise<unknown>) => {
      if (!scope.tx) throw new Error("Isolated seed transaction not initialized");
      return scope.tx.transaction(work);
    },
  },
}));
import { seedBaseline } from "../packages/db/src/seed-baseline";

it("repeats and repairs the seed within isolated PostgreSQL tables", async () => {
  const { db } = await vi.importActual<typeof import("../packages/db/src/client")>(
    "../packages/db/src/client",
  );
  await db.transaction(async (tx) => {
    // LIKE copies indexes/checks but not foreign keys. These are disposable test tables.
    for (const name of [
      "users",
      "organizations",
      "servers",
      "products",
      "builds",
      "licenses",
      "content",
      "audit_events",
    ]) {
      await tx.execute(
        sql.raw(`CREATE TEMP TABLE "${name}" (LIKE public."${name}" INCLUDING ALL) ON COMMIT DROP`),
      );
    }
    scope.tx = tx;
    try {
      const data = createSeedData("test-hash", {
        inventory: {
          storageKey: "builds/prd_inv_pro/v3.2.0.zip",
          fileSizeBytes: 512,
          sha256Hash: "a".repeat(64),
        },
        drift: {
          storageKey: "builds/prd_drift_physics/v2.1.4.zip",
          fileSizeBytes: 600,
          sha256Hash: "b".repeat(64),
        },
      });
      expect(await seedBaseline(data)).toEqual({ inserted: 13, repairedBuilds: 0, repairedMedia: 0 });
      await tx
        .update(users)
        .set({ passwordHash: "changed", role: "user" })
        .where(eq(users.id, "usr_admin_001"));
      expect(await seedBaseline(data)).toEqual({ inserted: 0, repairedBuilds: 0, repairedMedia: 0 });

      await tx
        .update(users)
        .set({
          avatarUrl:
            "https://api.dicebear.com/7.x/bottts/svg?seed=nexus_admin",
        })
        .where(eq(users.id, "usr_admin_001"));
      await tx
        .update(users)
        .set({ avatarUrl: "https://media.example/custom.svg" })
        .where(eq(users.id, "usr_dev_001"));
      await tx
        .update(products)
        .set({
          thumbnailUrl:
            "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80",
          screenshots: [
            "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80",
          ],
        })
        .where(eq(products.id, "prd_inv_pro"));

      expect(
        await seedBaseline(data, { repairDemoMedia: true }),
      ).toEqual({
        inserted: 0,
        repairedBuilds: 0,
        repairedMedia: 2,
      });
      const [repairedAdmin] = await tx
        .select()
        .from(users)
        .where(eq(users.id, "usr_admin_001"));
      const [customDev] = await tx
        .select()
        .from(users)
        .where(eq(users.id, "usr_dev_001"));
      const [repairedProduct] = await tx
        .select()
        .from(products)
        .where(eq(products.id, "prd_inv_pro"));
      expect(repairedAdmin.avatarUrl).toBeNull();
      expect(customDev.avatarUrl).toBe(
        "https://media.example/custom.svg",
      );
      expect(repairedProduct).toMatchObject({
        thumbnailUrl: null,
        screenshots: [],
      });

      await tx
        .update(builds)
        .set({ fileSizeBytes: 999, status: "retired" })
        .where(eq(builds.id, "bld_inv_320"));
      await expect(seedBaseline(data)).rejects.toThrow("db:seed:repair");
      expect(await seedBaseline(data, { repairDemoBuilds: true })).toEqual({
        inserted: 0,
        repairedBuilds: 1,
        repairedMedia: 0,
      });
      const [build] = await tx.select().from(builds).where(eq(builds.id, "bld_inv_320"));
      expect(build).toMatchObject({ fileSizeBytes: 512, status: "retired" });
      const [user] = await tx.select().from(users).where(eq(users.id, "usr_admin_001"));
      expect(user).toMatchObject({ passwordHash: "changed", role: "user" });
      expect(await tx.select().from(auditEvents)).toHaveLength(3);
    } finally {
      scope.tx = null;
    }
  });
});
