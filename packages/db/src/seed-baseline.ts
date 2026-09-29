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
    inserted += (
      await tx
        .insert(content)
        .values(data.content)
        .onConflictDoNothing({ target: content.id })
        .returning({ id: content.id })
    ).length;

    if (inserted || repairedBuilds) {
      await tx.insert(auditEvents).values({
        id: `aud_${randomUUID()}`,
        actorId: "usr_admin_001",
        actorType: "system",
        action: "database.seeded",
        targetId: "baseline:v1",
        targetType: "database",
        details: { inserted, repairedBuilds },
      });
    }
    return { inserted, repairedBuilds };
  });
}
