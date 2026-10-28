import { and, desc, eq, gt, isNull, or, sql, type SQL } from "drizzle-orm";
import { db } from "../client";
import type { ResourceTransaction } from "../transaction";
import {
  builds,
  entitlements,
  licenses,
  products,
  resourceAcquisitionEvents,
  users,
} from "../schema";
import { safePublishedBuildCondition } from "./build-safety";
import { NotFoundError, UnauthorizedError, ValidationError } from "@nexus/domain";
import { lockInitiatingSession } from "./initiating-session";
import type {
  Entitlement,
  FreeResourceClaimResult,
  ResourceAcquisitionSource,
} from "@nexus/domain";

export type { ResourceTransaction } from "../transaction";

export async function lockResourceAcquisitionSession(
  tx: ResourceTransaction,
  userId: string,
  currentToken: string,
) {
  const [user] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .for("share");
  if (!user) throw new UnauthorizedError("Authentication required");
  await lockInitiatingSession(tx, userId, currentToken);
}

/** Existing effective download policy, held through a transactional command. */
export async function lockUserDownloadAccess(
  tx: ResourceTransaction,
  userId: string,
  productId: string,
  observedAt: Date | SQL = new Date(),
) {
  const [grant] = await tx
    .select({ id: entitlements.id, expiresAt: entitlements.expiresAt })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.subjectType, "user"),
        eq(entitlements.subjectId, userId),
        eq(entitlements.resourceId, productId),
        eq(entitlements.permission, "product.download"),
        or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, observedAt)),
      ),
    )
    .limit(1)
    .for("share");
  if (grant) return { source: "entitlement" as const, expiresAt: grant.expiresAt };
  const [license] = await tx
    .select({ id: licenses.id, expiresAt: licenses.expiresAt })
    .from(licenses)
    .where(
      and(
        eq(licenses.userId, userId),
        eq(licenses.productId, productId),
        eq(licenses.status, "active"),
        or(isNull(licenses.expiresAt), gt(licenses.expiresAt, observedAt)),
      ),
    )
    .limit(1)
    .for("share");
  return license ? { source: "license" as const, expiresAt: license.expiresAt } : null;
}

export async function assertFreeResourceAvailable(
  tx: ResourceTransaction,
  productId: string,
): Promise<void> {
  const productRows = await tx
    .select({ status: products.status, price: products.price })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1)
    .for("no key update");
  const product = productRows[0];

  if (product?.status !== "published") {
    throw new NotFoundError("Resource", productId);
  }
  if (product.price !== 0) {
    throw new ValidationError("Only free resources can be claimed without a payment provider");
  }

  const safeBuildRows = await tx
    .select({ id: builds.id })
    .from(builds)
    .where(safePublishedBuildCondition(productId))
    .limit(1)
    .for("share");
  if (!safeBuildRows[0]) {
    throw new ValidationError("Resource is not currently available for download");
  }
}

/** The cart and single-resource path use the same grants and replay lock. */
export async function claimFreeResourceInTransaction(
  tx: ResourceTransaction,
  input: {
    entitlementId: string;
    userId: string;
    productId: string;
    currentToken: string;
    source?: ResourceAcquisitionSource;
    requestId?: string;
  },
): Promise<FreeResourceClaimResult> {
  const lockKey = `free-resource:${input.userId}:${input.productId}`;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${lockKey}))`);

  await assertFreeResourceAvailable(tx, input.productId);

  const now = new Date();
  const existingRows = await tx
    .select()
    .from(entitlements)
    .where(
      and(
        eq(entitlements.subjectType, "user"),
        eq(entitlements.subjectId, input.userId),
        eq(entitlements.resourceId, input.productId),
        eq(entitlements.permission, "product.download"),
        or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, now)),
      ),
    )
    .limit(1)
    .for("share");

  if (existingRows[0]) {
    await lockResourceAcquisitionSession(tx, input.userId, input.currentToken);
    return {
      entitlement: existingRows[0] as unknown as Entitlement,
      alreadyClaimed: true,
      accessSource: "entitlement",
    };
  }

  // Both paths preserve an active license's original expiry and revocation.
  // Select only access facts; never serialize license keys or runtime secrets.
  const [legacy] = await tx
    .select({ productId: licenses.productId, expiresAt: licenses.expiresAt })
    .from(licenses)
    .where(
      and(
        eq(licenses.userId, input.userId),
        eq(licenses.productId, input.productId),
        eq(licenses.status, "active"),
        or(isNull(licenses.expiresAt), gt(licenses.expiresAt, now)),
      ),
    )
    .orderBy(desc(licenses.expiresAt), desc(licenses.createdAt), desc(licenses.id))
    .limit(1)
    .for("share");
  // Recheck after the availability and access-row waits, including replay.
  await lockResourceAcquisitionSession(tx, input.userId, input.currentToken);
  if (legacy)
    return { entitlement: null, alreadyClaimed: true, accessSource: "license", license: legacy };

  const rows = await tx
    .insert(entitlements)
    .values({
      id: input.entitlementId,
      subjectType: "user",
      subjectId: input.userId,
      permission: "product.download",
      resourceId: input.productId,
      createdAt: now,
    })
    .returning();

  await tx.insert(resourceAcquisitionEvents).values({
    id: input.entitlementId,
    userId: input.userId,
    productId: input.productId,
    entitlementId: input.entitlementId,
    source: input.source ?? "direct",
    requestId: input.source === "cart" ? input.requestId : null,
    createdAt: now,
  });

  await tx
    .update(products)
    .set({
      salesCount: sql`${products.salesCount} + 1`,
    })
    .where(eq(products.id, input.productId));

  return {
    entitlement: rows[0] as unknown as Entitlement,
    alreadyClaimed: false,
    accessSource: "entitlement",
  };
}

export class EntitlementRepository {
  async hasEntitlement(
    subject: { type: "user" | "server" | "organization"; id: string },
    resourceId: string,
    permission: string,
  ): Promise<boolean> {
    const rows = await db
      .select({ id: entitlements.id })
      .from(entitlements)
      .where(
        and(
          eq(entitlements.subjectType, subject.type),
          eq(entitlements.subjectId, subject.id),
          eq(entitlements.resourceId, resourceId),
          eq(entitlements.permission, permission),
          or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, new Date())),
        ),
      )
      .limit(1);

    if (rows.length > 0) return true;

    if (subject.type !== "user") return false;

    // Legacy active licenses implicitly grant download/update. Other
    // permissions must match *some* active license, not whichever row
    // PostgreSQL happens to return first with LIMIT 1.
    const implicitLegacyPermission =
      permission === "product.download" || permission === "product.update";
    const matchingLicenses = await db
      .select({ id: licenses.id })
      .from(licenses)
      .where(
        and(
          eq(licenses.userId, subject.id),
          eq(licenses.productId, resourceId),
          eq(licenses.status, "active"),
          or(isNull(licenses.expiresAt), gt(licenses.expiresAt, new Date())),
          implicitLegacyPermission
            ? undefined
            : sql`${licenses.entitlements} @> ${JSON.stringify([permission])}::jsonb`,
        ),
      )
      .limit(1);

    return matchingLicenses.length > 0;
  }

  async listBySubject(subject: {
    type: "user" | "server" | "organization";
    id: string;
  }): Promise<Entitlement[]> {
    const rows = await db
      .select()
      .from(entitlements)
      .where(
        and(
          eq(entitlements.subjectType, subject.type),
          eq(entitlements.subjectId, subject.id),
          or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, new Date())),
        ),
      );
    return rows as unknown as Entitlement[];
  }

  async create(data: Omit<Entitlement, "createdAt">): Promise<Entitlement> {
    const values = {
      ...data,
      createdAt: new Date(),
    };

    const rows = await db.insert(entitlements).values(values).returning();
    return rows[0] as unknown as Entitlement;
  }

  async claimFreeResource(input: {
    entitlementId: string;
    userId: string;
    productId: string;
    currentToken: string;
  }): Promise<FreeResourceClaimResult> {
    if (!input.currentToken) throw new UnauthorizedError("Authentication required");
    return db.transaction(async (tx) => {
      return claimFreeResourceInTransaction(tx, input);
    });
  }
}

export const entitlementRepository = new EntitlementRepository();
