import { and, asc, count, eq, inArray, sql } from "drizzle-orm";
import {
  AppError,
  RESOURCE_CART_LIMIT,
  type ResourceCart,
  type ResourceCartAcquisition,
  type ResourceCartReceiptItem,
  type ResourceCartReviewItem,
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
  users,
} from "../schema";
import { trustedCleanScanCondition } from "./build-safety";
import { claimFreeResourceInTransaction, type ResourceTransaction } from "./entitlements";
import { readResourceCartReview } from "./resource-cart-review";

async function lockCart(tx: ResourceTransaction, userId: string) {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`resource-cart:${userId}`}))`);
}

function assertReviewedItem(
  item: ResourceCartReviewItem | undefined,
): asserts item is ResourceCartReviewItem & {
  title: string;
  slug: string;
  buildId: string;
  version: string;
  sha256Hash: string;
  fileSizeBytes: number;
  dependencies: string[];
} {
  if (
    !item?.available ||
    typeof item.title !== "string" ||
    typeof item.slug !== "string" ||
    typeof item.buildId !== "string" ||
    typeof item.version !== "string" ||
    typeof item.sha256Hash !== "string" ||
    !/^[a-f0-9]{64}$/u.test(item.sha256Hash) ||
    typeof item.fileSizeBytes !== "number" ||
    !Number.isSafeInteger(item.fileSizeBytes) ||
    item.fileSizeBytes < 1 ||
    item.fileSizeBytes > 67108864 ||
    !Array.isArray(item.dependencies) ||
    item.dependencies.length > 25 ||
    item.dependencies.some((value) => typeof value !== "string" || value.length > 120)
  )
    throw new AppError(
      "Reviewed resource evidence is unavailable",
      409,
      "RESOURCE_CART_REVIEW_CHANGED",
    );
}

export class ResourceCartRepository {
  async review(userId: string) {
    return db.transaction((tx) => readResourceCartReview(tx, userId), {
      isolationLevel: "repeatable read",
      accessMode: "read only",
    });
  }
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
    reviewDigest: string;
  }): Promise<ResourceCartAcquisition> {
    const ids = [...input.productIds].sort();
    if (
      !ids.length ||
      ids.length > RESOURCE_CART_LIMIT ||
      new Set(ids).size !== ids.length ||
      input.entitlementIds.length !== ids.length ||
      !/^[a-f0-9]{64}$/u.test(input.reviewDigest ?? "")
    ) {
      throw new AppError("Invalid cart acquisition", 400, "RESOURCE_CART_INVALID");
    }
    return db.transaction(async (tx) => {
      await lockCart(tx, input.userId);
      const [receipt] = await tx
        .select({
          productIds: resourceCartAcquisitions.productIds,
          result: resourceCartAcquisitions.result,
          reviewDigest: resourceCartAcquisitions.reviewDigest,
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
        if (
          JSON.stringify(receipt.productIds) !== JSON.stringify(ids) ||
          receipt.reviewDigest !== input.reviewDigest
        ) {
          throw new AppError(
            "Acquisition request ID was reused for another cart",
            409,
            "RESOURCE_CART_REQUEST_CONFLICT",
          );
        }
        return { ...receipt.result, requestId: input.requestId };
      }
      const cart = await tx
        .select({ productId: resourceCartItems.productId })
        .from(resourceCartItems)
        .where(eq(resourceCartItems.userId, input.userId))
        .orderBy(asc(resourceCartItems.productId));
      // A changed cart must be reviewed; never silently include a second tab's items.
      const currentIds = cart.map((row) => row.productId).sort();
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
      const [user] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.userId))
        .limit(1)
        .for("share");
      if (!user) throw new AppError("Account is unavailable", 401, "UNAUTHORIZED");
      // Publication/removal commands take the same parent locks. Hold exact
      // selected builds too, then recompute the review under those locks before
      // issuing any grant. The client digest is never a source of authority.
      const observed = await readResourceCartReview(tx, input.userId);
      if (!observed.reviewDigest || observed.reviewDigest !== input.reviewDigest)
        throw new AppError("Reviewed resources changed", 409, "RESOURCE_CART_REVIEW_CHANGED");
      for (const item of observed.items) assertReviewedItem(item);
      await tx
        .select({ id: builds.id })
        .from(builds)
        .where(
          inArray(
            builds.id,
            observed.items.flatMap((item) => (item.buildId ? [item.buildId] : [])),
          ),
        )
        .orderBy(asc(builds.id))
        .for("share");
      const checked = await readResourceCartReview(tx, input.userId);
      if (checked.reviewDigest !== input.reviewDigest)
        throw new AppError("Reviewed resources changed", 409, "RESOURCE_CART_REVIEW_CHANGED");
      const acquired: ResourceCartAcquisition["acquired"] = [];
      const reviewSnapshot: ResourceCartReceiptItem[] = [];
      for (const [index, productId] of ids.entries()) {
        const item = checked.items.find((row) => row.productId === productId);
        assertReviewedItem(item);
        const result = await claimFreeResourceInTransaction(tx, {
          entitlementId: input.entitlementIds[index],
          userId: input.userId,
          productId,
          source: "cart",
          requestId: input.requestId,
        });
        acquired.push({ productId, alreadyClaimed: result.alreadyClaimed });
        reviewSnapshot.push({
          productId,
          title: item.title,
          slug: item.slug,
          buildId: item.buildId,
          version: item.version,
          sha256Hash: item.sha256Hash,
          fileSizeBytes: item.fileSizeBytes,
          mtaMinVersion: item.mtaMinVersion,
          dependencies: item.dependencies,
          alreadyClaimed: result.alreadyClaimed,
          accessSource: result.accessSource,
          recordedExpiresAt:
            (result.accessSource === "license"
              ? result.license.expiresAt
              : result.entitlement.expiresAt
            )?.toISOString() ?? null,
        });
      }
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.userId,
        actorType: "user",
        action: "resource.cart_acquired",
        targetId: input.userId,
        targetType: "resource_cart",
        details: {
          productIds: ids,
          requestId: input.requestId,
          reviewDigest: input.reviewDigest,
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
      const result: ResourceCartAcquisition = {
        kind: "free_resource_acquisition",
        acquired,
        requestId: input.requestId,
      };
      await tx.insert(resourceCartAcquisitions).values({
        userId: input.userId,
        requestId: input.requestId,
        productIds: ids,
        result,
        reviewDigest: input.reviewDigest,
        reviewSnapshot,
      });
      return result;
    });
  }
}

export const resourceCartRepository = new ResourceCartRepository();
