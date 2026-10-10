import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import {
  AppError,
  RESOURCE_CART_LIMIT,
  type ResourceCart,
  type ResourceCartAcquisition,
} from "@nexus/domain";
import { db } from "../client";
import {
  auditEvents,
  builds,
  entitlements,
  licenses,
  products,
  resourceCartItems,
  resourceCartAcquisitions,
} from "../schema";
import { trustedCleanScanCondition } from "./build-safety";
import {
  claimFreeResourceInTransaction,
  type ResourceTransaction,
} from "./entitlements";

async function lockCart(tx: ResourceTransaction, userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`resource-cart:${userId}`}))`);
}

export class ResourceCartRepository {
  async get(userId: string): Promise<ResourceCart> {
    const now = new Date();
    const available = sql<boolean>`(${products.status} = 'published' and ${products.price} = 0
      and exists (select 1 from ${builds} where ${builds.productId} = ${products.id}
        and ${builds.status} = 'published' and ${trustedCleanScanCondition()}))`;
    const rows = await db
      .select({
        productId: resourceCartItems.productId,
        // Withdrawn resources stay removable without leaking private metadata.
        title: sql<string | null>`case when ${available} then ${products.title} else null end`,
        slug: sql<string | null>`case when ${available} then ${products.slug} else null end`,
        version: sql<string | null>`case when ${available} then (
        select ${builds.version} from ${builds} where ${builds.productId} = ${products.id}
        and ${builds.status} = 'published' and ${trustedCleanScanCondition()}
        order by ${builds.createdAt} desc, ${builds.id} desc limit 1) else null end`,
        available,
        alreadyOwned: sql<boolean>`(exists (select 1 from ${entitlements}
        where ${entitlements.subjectType} = 'user' and ${entitlements.subjectId} = ${userId}
          and ${entitlements.resourceId} = ${products.id} and ${entitlements.permission} = 'product.download'
          and (${entitlements.expiresAt} is null or ${entitlements.expiresAt} > ${now}))
        or exists (select 1 from ${licenses} where ${licenses.userId} = ${userId}
          and ${licenses.productId} = ${products.id} and ${licenses.status} = 'active'
          and (${licenses.expiresAt} is null or ${licenses.expiresAt} > ${now})))`,
      })
      .from(resourceCartItems)
      .innerJoin(products, eq(products.id, resourceCartItems.productId))
      .where(eq(resourceCartItems.userId, userId))
      .orderBy(asc(resourceCartItems.createdAt), asc(resourceCartItems.productId))
      .limit(RESOURCE_CART_LIMIT);
    return { items: rows, limit: RESOURCE_CART_LIMIT };
  }

  async add(userId: string, productId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await lockCart(tx, userId);
      const [existing] = await tx
        .select({ productId: resourceCartItems.productId })
        .from(resourceCartItems)
        .where(
          and(eq(resourceCartItems.userId, userId), eq(resourceCartItems.productId, productId)),
        )
        .limit(1);
      if (existing) return;
      const [summary] = await tx
        .select({ total: count() })
        .from(resourceCartItems)
        .where(eq(resourceCartItems.userId, userId));
      if ((summary?.total ?? 0) >= RESOURCE_CART_LIMIT)
        throw new AppError("Resource cart is full", 409, "RESOURCE_CART_FULL");
      const [product] = await tx
        .select({ id: products.id })
        .from(products)
        .where(
          and(
            eq(products.id, productId),
            eq(products.status, "published"),
            eq(products.price, 0),
            sql`exists (select 1 from ${builds} where ${builds.productId} = ${products.id}
            and ${builds.status} = 'published' and ${trustedCleanScanCondition()})`,
          ),
        )
        .limit(1)
        .for("share");
      if (!product) throw new AppError("Resource is unavailable", 409, "RESOURCE_UNAVAILABLE");
      await tx.insert(resourceCartItems).values({ userId, productId }).onConflictDoNothing();
    });
  }

  async remove(userId: string, productId: string): Promise<void> {
    await db.transaction(async (tx) => {
      await lockCart(tx, userId);
      await tx
        .delete(resourceCartItems)
        .where(
          and(eq(resourceCartItems.userId, userId), eq(resourceCartItems.productId, productId)),
        );
    });
  }

  /** All-or-nothing free acquisition. Never creates orders, payments, or funds. */
  async acquire(input: {
    userId: string;
    requestId: string;
    productIds: string[];
    entitlementIds: string[];
    auditId: string;
  }): Promise<ResourceCartAcquisition> {
    const ids = [...input.productIds].sort();
    if (
      !ids.length ||
      ids.length > RESOURCE_CART_LIMIT ||
      new Set(ids).size !== ids.length ||
      input.entitlementIds.length !== ids.length
    ) {
      throw new AppError("Invalid cart acquisition", 400, "RESOURCE_CART_INVALID");
    }
    return db.transaction(async (tx) => {
      await lockCart(tx, input.userId);
      const [receipt] = await tx
        .select({
          productIds: resourceCartAcquisitions.productIds,
          result: resourceCartAcquisitions.result,
        })
        .from(resourceCartAcquisitions)
        .where(
          and(
            eq(resourceCartAcquisitions.userId, input.userId),
            eq(resourceCartAcquisitions.requestId, input.requestId),
          ),
        )
        .limit(1);
      if (receipt) {
        if (JSON.stringify(receipt.productIds) !== JSON.stringify(ids)) {
          throw new AppError(
            "Acquisition request ID was reused for another cart",
            409,
            "RESOURCE_CART_REQUEST_CONFLICT",
          );
        }
        return receipt.result;
      }
      const cart = await tx
        .select({ productId: resourceCartItems.productId })
        .from(resourceCartItems)
        .where(eq(resourceCartItems.userId, input.userId))
        .orderBy(asc(resourceCartItems.productId));
      // A changed cart must be reviewed; never silently include a second tab's items.
      const currentIds = cart.map(row => row.productId).sort();
      if (currentIds.length !== ids.length || currentIds.some((id, i) => id !== ids[i])) {
        throw new AppError("Cart changed; reload before acquiring", 409, "RESOURCE_CART_CHANGED");
      }
      // Acquire the exact same per-resource locks as individual claims first,
      // then product rows in stable ID order to avoid cross-cart deadlocks.
      for (const id of ids)
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`free-resource:${input.userId}:${id}`}))`,
        );
      await tx
        .select({ id: products.id })
        .from(products)
        .where(inArray(products.id, ids))
        .orderBy(asc(products.id))
        .for("no key update");
      const acquired: ResourceCartAcquisition["acquired"] = [];
      for (const [index, productId] of ids.entries()) {
        const result = await claimFreeResourceInTransaction(tx, {
          entitlementId: input.entitlementIds[index],
          userId: input.userId,
          productId,
          source: "cart",
          requestId: input.requestId,
        });
        acquired.push({ productId, alreadyClaimed: result.alreadyClaimed });
      }
      await tx
        .insert(auditEvents)
        .values({
          id: input.auditId,
          actorId: input.userId,
          actorType: "user",
          action: "resource.cart_acquired",
          targetId: input.userId,
          targetType: "resource_cart",
          details: {
            productIds: ids,
            newlyAcquired: acquired.filter((item) => !item.alreadyClaimed).length,
          },
        });
      await tx
        .delete(resourceCartItems)
        .where(
          and(
            eq(resourceCartItems.userId, input.userId),
            inArray(resourceCartItems.productId, ids),
          ),
        );
      const result: ResourceCartAcquisition = { kind: "free_resource_acquisition", acquired };
      await tx
        .insert(resourceCartAcquisitions)
        .values({ userId: input.userId, requestId: input.requestId, productIds: ids, result });
      return result;
    });
  }
}

export const resourceCartRepository = new ResourceCartRepository();
