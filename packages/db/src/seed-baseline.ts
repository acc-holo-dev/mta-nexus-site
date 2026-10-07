import { randomUUID } from "node:crypto";
import { eq, inArray, sql } from "drizzle-orm";
import { db } from "./client";
import {
  users,
  organizations,
  servers,
  products,
  builds,
  licenses,
  content,
  auditEvents,
} from "./schema";
import type { SeedData } from "./seed-data";

export interface SeedOptions {
  repairDemoBuilds?: boolean;
  repairDemoMedia?: boolean;
}

const LEGACY_USER_AVATARS: Record<string, string> = {
  usr_admin_001:
    "https://api.dicebear.com/7.x/bottts/svg?seed=nexus_admin",
  usr_dev_001:
    "https://api.dicebear.com/7.x/bottts/svg?seed=horizon_dev",
  usr_server_001:
    "https://api.dicebear.com/7.x/bottts/svg?seed=drift_king",
  usr_player_001:
    "https://api.dicebear.com/7.x/bottts/svg?seed=speedy_cj",
};

const LEGACY_ORGANIZATION_LOGOS: Record<string, string> = {
  org_horizon:
    "https://api.dicebear.com/7.x/shapes/svg?seed=horizon-interactive",
};

const LEGACY_SERVER_MEDIA: Record<
  string,
  { bannerUrl: string; logoUrl: string }
> = {
  srv_drift_01: {
    bannerUrl:
      "https://images.unsplash.com/photo-1542282088-72c9c27ed0cd?auto=format&fit=crop&w=1200&q=80",
    logoUrl:
      "https://api.dicebear.com/7.x/identicon/svg?seed=sa-drift-paradise",
  },
  srv_horizon_rp: {
    bannerUrl:
      "https://images.unsplash.com/photo-1514565131-fce0801e5785?auto=format&fit=crop&w=1200&q=80",
    logoUrl:
      "https://api.dicebear.com/7.x/identicon/svg?seed=horizon-roleplay",
  },
};

const LEGACY_PRODUCT_MEDIA: Record<
  string,
  { thumbnailUrl: string; screenshot: string }
> = {
  prd_inv_pro: {
    thumbnailUrl:
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=600&q=80",
    screenshot:
      "https://images.unsplash.com/photo-1550745165-9bc0b252726f?auto=format&fit=crop&w=1200&q=80",
  },
  prd_drift_physics: {
    thumbnailUrl:
      "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=600&q=80",
    screenshot:
      "https://images.unsplash.com/photo-1563720223185-11003d516935?auto=format&fit=crop&w=1200&q=80",
  },
};

const LEGACY_CONTENT_COVERS: Record<string, string> = {
  cnt_art_001:
    "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?auto=format&fit=crop&w=1200&q=80",
};

function isLegacySingleScreenshot(
  value: unknown,
  expected: string,
): boolean {
  return (
    Array.isArray(value) &&
    value.length === 1 &&
    value[0] === expected
  );
}

function assertIdentity(existing: { id: string }[], expected: { id: string }[], keys: string[]) {
  const fixtures = new Map(expected.map((row) => [row.id, row]));
  for (const row of existing) {
    const fixture = fixtures.get(row.id);
    if (
      !fixture ||
      keys.some((key) => (Reflect.get(row, key) ?? null) !== (Reflect.get(fixture, key) ?? null))
    ) {
      throw new Error(
        `Seed identity conflict for ${row.id}; existing records were not overwritten`,
      );
    }
  }
}

/** All database changes, including the audit event, commit together. */
export async function seedBaseline(data: SeedData, options: SeedOptions = {}) {
  return db.transaction(async (tx) => {
    await tx.execute(
      sql`SELECT pg_advisory_xact_lock(hashtextextended('nexus:baseline-seed:v1', 0))`,
    );
    let inserted = 0;
    let repairedBuilds = 0;
    let repairedMedia = 0;

    const existingUsers = await tx
      .select()
      .from(users)
      .where(
        inArray(
          users.id,
          data.users.map((row) => row.id),
        ),
      )
      .for("update");
    assertIdentity(existingUsers, data.users, ["email", "username"]);
    if (options.repairDemoMedia) {
      for (const row of existingUsers) {
        const legacy = LEGACY_USER_AVATARS[row.id];
        if (legacy && row.avatarUrl === legacy) {
          await tx
            .update(users)
            .set({ avatarUrl: null })
            .where(eq(users.id, row.id));
          repairedMedia++;
        }
      }
    }
    inserted += (
      await tx
        .insert(users)
        .values(data.users)
        .onConflictDoNothing({ target: users.id })
        .returning({ id: users.id })
    ).length;

    const existingOrganizations = await tx
      .select()
      .from(organizations)
      .where(
        inArray(
          organizations.id,
          data.organizations.map((row) => row.id),
        ),
      )
      .for("update");
    assertIdentity(existingOrganizations, data.organizations, ["slug", "ownerId"]);
    if (options.repairDemoMedia) {
      for (const row of existingOrganizations) {
        const legacy = LEGACY_ORGANIZATION_LOGOS[row.id];
        if (legacy && row.logoUrl === legacy) {
          await tx
            .update(organizations)
            .set({ logoUrl: null })
            .where(eq(organizations.id, row.id));
          repairedMedia++;
        }
      }
    }
    inserted += (
      await tx
        .insert(organizations)
        .values(data.organizations)
        .onConflictDoNothing({ target: organizations.id })
        .returning({ id: organizations.id })
    ).length;

    const existingServers = await tx
      .select()
      .from(servers)
      .where(
        inArray(
          servers.id,
          data.servers.map((row) => row.id),
        ),
      )
      .for("update");
    assertIdentity(existingServers, data.servers, ["slug", "ownerId", "organizationId"]);
    if (options.repairDemoMedia) {
      for (const row of existingServers) {
        const legacy = LEGACY_SERVER_MEDIA[row.id];
        if (!legacy) continue;
        const values: {
          bannerUrl?: null;
          logoUrl?: null;
        } = {};
        if (row.bannerUrl === legacy.bannerUrl) {
          values.bannerUrl = null;
        }
        if (row.logoUrl === legacy.logoUrl) {
          values.logoUrl = null;
        }
        if (Object.keys(values).length > 0) {
          await tx
            .update(servers)
            .set(values)
            .where(eq(servers.id, row.id));
          repairedMedia++;
        }
      }
    }
    inserted += (
      await tx
        .insert(servers)
        .values(data.servers)
        .onConflictDoNothing({ target: servers.id })
        .returning({ id: servers.id })
    ).length;

    const existingProducts = await tx
      .select()
      .from(products)
      .where(
        inArray(
          products.id,
          data.products.map((row) => row.id),
        ),
      )
      .for("update");
    assertIdentity(existingProducts, data.products, ["slug", "authorId", "organizationId"]);
    if (options.repairDemoMedia) {
      for (const row of existingProducts) {
        const legacy = LEGACY_PRODUCT_MEDIA[row.id];
        if (!legacy) continue;
        const values: {
          thumbnailUrl?: null;
          screenshots?: string[];
        } = {};
        if (row.thumbnailUrl === legacy.thumbnailUrl) {
          values.thumbnailUrl = null;
        }
        if (
          isLegacySingleScreenshot(
            row.screenshots,
            legacy.screenshot,
          )
        ) {
          values.screenshots = [];
        }
        if (Object.keys(values).length > 0) {
          await tx
            .update(products)
            .set(values)
            .where(eq(products.id, row.id));
          repairedMedia++;
        }
      }
    }
    inserted += (
      await tx
        .insert(products)
        .values(data.products)
        .onConflictDoNothing({ target: products.id })
        .returning({ id: products.id })
    ).length;

    const existingBuilds = await tx
      .select()
      .from(builds)
      .where(
        inArray(
          builds.id,
          data.builds.map((row) => row.id),
        ),
      )
      .for("update");
    assertIdentity(existingBuilds, data.builds, ["productId", "version", "storageKey", "scanner"]);
    for (const fixture of data.builds) {
      const existing = existingBuilds.find((row) => row.id === fixture.id);
      const product = existingProducts.find((row) => row.id === fixture.productId);
      if (
        !existing &&
        product &&
        (product.currentVersion !== fixture.version || product.status !== "published")
      ) {
        throw new Error(`Seed cannot add a demo build to modified product ${product.id}`);
      }
      if (
        existing &&
        (existing.sha256Hash !== fixture.sha256Hash ||
          existing.fileSizeBytes !== fixture.fileSizeBytes)
      ) {
        if (!options.repairDemoBuilds)
          throw new Error(
            `Seed metadata mismatch for ${fixture.id}; inspect it and use db:seed:repair for known demo fixtures`,
          );
        await tx
          .update(builds)
          .set({ sha256Hash: fixture.sha256Hash, fileSizeBytes: fixture.fileSizeBytes })
          .where(eq(builds.id, fixture.id));
        repairedBuilds++;
      }
    }
    inserted += (
      await tx
        .insert(builds)
        .values(data.builds)
        .onConflictDoNothing({ target: builds.id })
        .returning({ id: builds.id })
    ).length;

    const existingLicenses = await tx
      .select()
      .from(licenses)
      .where(
        inArray(
          licenses.id,
          data.licenses.map((row) => row.id),
        ),
      )
      .for("update");
    assertIdentity(existingLicenses, data.licenses, ["key", "productId", "userId", "serverId"]);
    inserted += (
      await tx
        .insert(licenses)
        .values(data.licenses)
        .onConflictDoNothing({ target: licenses.id })
        .returning({ id: licenses.id })
    ).length;

    const existingContent = await tx
      .select()
      .from(content)
      .where(
        inArray(
          content.id,
          data.content.map((row) => row.id),
        ),
      )
      .for("update");
    assertIdentity(existingContent, data.content, ["slug", "authorId"]);
    if (options.repairDemoMedia) {
      for (const row of existingContent) {
        const legacy = LEGACY_CONTENT_COVERS[row.id];
        if (legacy && row.coverImageUrl === legacy) {
          await tx
            .update(content)
            .set({ coverImageUrl: null })
            .where(eq(content.id, row.id));
          repairedMedia++;
        }
      }
    }
    inserted += (
      await tx
        .insert(content)
        .values(data.content)
        .onConflictDoNothing({ target: content.id })
        .returning({ id: content.id })
    ).length;

    if (inserted || repairedBuilds || repairedMedia) {
      await tx.insert(auditEvents).values({
        id: `aud_${randomUUID()}`,
        actorId: "usr_admin_001",
        actorType: "system",
        action: "database.seeded",
        targetId: "baseline:v1",
        targetType: "database",
        details: { inserted, repairedBuilds, repairedMedia },
      });
    }
    return { inserted, repairedBuilds, repairedMedia };
  });
}
