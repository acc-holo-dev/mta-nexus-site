import { eq, sql } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { User } from "@nexus/domain";
import { auditEvents, products, users } from "../packages/db/src/schema";
import { productRepository } from "../packages/db/src/repositories/products";
import { ProductService } from "../apps/web/src/lib/services/product-service";
import { expect, it } from "vitest";
import { db } from "../packages/db/src/client";
import { managedProductCondition } from "../packages/db/src/repositories/products";

it("enforces author and organization authority in PostgreSQL, including revocation", async () => {
  await db.transaction(async (tx) => {
    await tx.execute(
      sql`CREATE TEMP TABLE products (id text, author_id text, organization_id text) ON COMMIT DROP`,
    );
    await tx.execute(sql`CREATE TEMP TABLE organizations (id text, owner_id text) ON COMMIT DROP`);
    await tx.execute(
      sql`CREATE TEMP TABLE organization_members (organization_id text, user_id text, role text, permissions jsonb) ON COMMIT DROP`,
    );
    // Shadow users so admin scope rechecks the fixture row, not production users.
    await tx.execute(sql`CREATE TEMP TABLE users (id text, role text) ON COMMIT DROP`);
    await tx.execute(sql`INSERT INTO organizations VALUES ('org', 'org-owner')`);
    await tx.execute(
      sql`INSERT INTO products VALUES ('personal', 'author', null), ('team', 'author', 'org'), ('other', 'other', null)`,
    );
    await tx.execute(
      sql`INSERT INTO organization_members VALUES ('org', 'manager', 'member', '["manage_products"]'), ('org', 'reader', 'member', '[]'), ('org', 'org-admin', 'admin', '[]')`,
    );
    await tx.execute(
      sql`INSERT INTO users VALUES ('author', 'developer'), ('org-owner', 'developer'), ('manager', 'developer'), ('org-admin', 'developer'), ('reader', 'developer'), ('unrelated', 'admin'), ('other', 'developer')`,
    );
    const accessible = async (
      id: string,
      role: "developer" | "moderator" | "admin" = "developer",
    ) => {
      const rows = await tx.execute(
        sql`select id from products where ${managedProductCondition({ id, role })} order by id`,
      );
      return rows.map((row) => row.id);
    };
    expect(await accessible("author")).toEqual(["personal"]);
    expect(await accessible("org-owner")).toEqual(["team"]);
    expect(await accessible("manager")).toEqual(["team"]);
    expect(await accessible("org-admin")).toEqual(["team"]);
    expect(await accessible("reader")).toEqual([]);
    // Live users.role wins: claimed moderator still sees admin scope for 'unrelated'.
    expect(await accessible("unrelated", "moderator")).toEqual(["other", "personal", "team"]);
    expect(await accessible("unrelated", "admin")).toEqual(["other", "personal", "team"]);
    // Claimed admin must not short-circuit when the live row is not admin.
    await tx.execute(sql`UPDATE users SET role = 'developer' WHERE id = 'unrelated'`);
    expect(await accessible("unrelated", "admin")).toEqual([]);
    await tx.execute(
      sql`UPDATE organization_members SET permissions = '[]' WHERE user_id = 'manager'`,
    );
    expect(await accessible("manager")).toEqual([]);
  });
});


it("atomically rejects concurrent and stale metadata revisions without extra audits or scope leaks", async () => {
  const fixture = randomUUID().replaceAll("-", "");
  const actor = { id: `usr_revision_${fixture}`, role: "developer" } as User;
  const productId = `prd_revision_${fixture}`;
  const service = new ProductService();
  const initial = { title: "Initial", shortDescription: "Initial summary", description: "Initial description", tags: ["initial"] };
  const first = { title: "First editor", shortDescription: "First summary", description: "First description", tags: ["first"] };
  const second = { title: "Second editor", shortDescription: "Second summary", description: "Second description", tags: ["second"] };
  try {
    await db.insert(users).values({ id: actor.id, email: `${fixture}@example.invalid`, username: `rev_${fixture}`,
      displayName: "Revision fixture", role: actor.role });
    await db.insert(products).values({ id: productId, authorId: actor.id, slug: `revision-${fixture}`, type: "script", ...initial,
      // Exercise PostgreSQL microseconds and force monotonic revisions ahead of wall time.
      updatedAt: sql`'2099-01-01T00:00:00.123456Z'::timestamptz` });
    const before = await productRepository.findManaged(productId, actor);
    expect(before).not.toBeNull();
    if (!before) throw new Error("Expected managed product fixture");
    const base = before.updatedAt;
    expect(base.toISOString()).toBe("2099-01-01T00:00:00.123Z");
    const outcomes = await Promise.allSettled([
      service.updateProductDetails(productId, first, actor, base),
      service.updateProductDetails(productId, second, actor, base),
    ]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const failed = outcomes.find((result) => result.status === "rejected");
    expect(failed?.status === "rejected" && failed.reason).toMatchObject({ statusCode: 409, code: "PRODUCT_METADATA_CONFLICT" });
    const saved = await productRepository.findManaged(productId, actor);
    expect(saved).not.toBeNull();
    if (!saved) throw new Error("Expected updated managed product");
    expect(saved.updatedAt.getTime()).toBe(base.getTime() + 1);
    const expected = saved.title === first.title ? first : second;
    expect(saved).toMatchObject(expected);
    const events = async () => db.select().from(auditEvents).where(eq(auditEvents.targetId, productId));
    expect(await events()).toHaveLength(1);
    await expect(service.updateProductDetails(productId, initial, actor, base)).rejects.toMatchObject({
      statusCode: 409, code: "PRODUCT_METADATA_CONFLICT",
    });
    // Both a valid and a stale revision remain indistinguishable from missing data outside scope.
    const stranger = { id: "unrelated-revision-actor", role: "developer" } as User;
    for (const revision of [base, saved.updatedAt]) {
      await expect(service.updateProductDetails(productId, initial, stranger, revision)).rejects.toMatchObject({
        statusCode: 404, code: "NOT_FOUND",
      });
    }
    expect(await productRepository.findManaged(productId, actor)).toEqual(saved);
    expect(await events()).toHaveLength(1);
    // The new revision permits another write and advances even while ahead of wall time.
    const next = await service.updateProductDetails(productId, initial, actor, saved.updatedAt);
    expect(next.updatedAt.getTime()).toBe(saved.updatedAt.getTime() + 1);
    expect(await events()).toHaveLength(2);
  } finally {
    await db.delete(auditEvents).where(eq(auditEvents.targetId, productId));
    await db.delete(products).where(eq(products.id, productId));
    await db.delete(users).where(eq(users.id, actor.id));
  }
});
