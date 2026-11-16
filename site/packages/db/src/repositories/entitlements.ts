import type {
  Entitlement,
  FreeResourceClaimResult,
  ResourceAcquisitionSource,
} from "@nexus/domain";
import {
  NotFoundError,
  RESOURCE_CART_LIMIT,
  UnauthorizedError,
  ValidationError,
} from "@nexus/domain";
import { and, asc, desc, eq, gt, inArray, isNull, or, type SQL, sql } from "drizzle-orm";
import { db } from "../client";
import {
  builds,
  entitlements,
  licenses,
  products,
  resourceAcquisitionEvents,
  users,
} from "../schema";
import type { ResourceTransaction } from "../transaction";
import { safePublishedBuildCondition } from "./build-safety";
import { lockInitiatingSession } from "./initiating-session";

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

type FreeResourceClaim = {
  entitlementId: string;
  userId: string;
  productId: string;
  source?: ResourceAcquisitionSource;
  requestId?: string;
};

async function prepareFreeResourceClaim(tx: ResourceTransaction, input: FreeResourceClaim) {
  await assertFreeResourceAvailable(tx, input.productId);

  const observedAt = new Date();
  const existingRows = await tx
    .select()
    .from(entitlements)
    .where(
      and(
        eq(entitlements.subjectType, "user"),
        eq(entitlements.subjectId, input.userId),
        eq(entitlements.resourceId, input.productId),
        eq(entitlements.permission, "product.download"),
        or(isNull(entitlements.expiresAt), gt(entitlements.expiresAt, observedAt)),
      ),
    )
    .orderBy(desc(entitlements.expiresAt), desc(entitlements.createdAt), desc(entitlements.id))
    .limit(1)
    .for("share");
  const existing = existingRows[0];

  // Both paths preserve an active license's original expiry and revocation.
  // Select only access facts; never serialize license keys or runtime secrets.
  // A finite grant may expire while later locks wait. Lock its fallback before
  // the actor/session so expiry never introduces a session -> license lock edge.
  const [legacy] =
    existing?.expiresAt === null
      ? []
      : await tx
          .select({ productId: licenses.productId, expiresAt: licenses.expiresAt })
          .from(licenses)
          .where(
            and(
              eq(licenses.userId, input.userId),
              eq(licenses.productId, input.productId),
              eq(licenses.status, "active"),
              or(isNull(licenses.expiresAt), gt(licenses.expiresAt, observedAt)),
            ),
          )
          .orderBy(desc(licenses.expiresAt), desc(licenses.createdAt), desc(licenses.id))
          .limit(1)
          .for("share");
  return { input, existing, legacy };
}

async function writeFreeResourceClaim(
  tx: ResourceTransaction,
  prepared: Awaited<ReturnType<typeof prepareFreeResourceClaim>>,
  now: Date,
): Promise<FreeResourceClaimResult> {
  const { input, existing, legacy } = prepared;
  const isCurrent = (access: { expiresAt: Date | null }) =>
    access.expiresAt === null || access.expiresAt.getTime() > now.getTime();
  if (existing && isCurrent(existing)) {
    return {
      entitlement: existing as unknown as Entitlement,
      alreadyClaimed: true,
      accessSource: "entitlement",
    };
  }
  if (legacy && isCurrent(legacy))
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

/** Prepare every access lock before the one mandatory initiating-session check. */
export async function claimFreeResourcesInTransaction(
  tx: ResourceTransaction,
  input: {
    userId: string;
    currentToken: string;
    resources: { entitlementId: string; productId: string }[];
    source?: ResourceAcquisitionSource;
    requestId?: string;
  },
): Promise<FreeResourceClaimResult[]> {
  if (!input.currentToken) throw new UnauthorizedError("Authentication required");
  const ordered = [...input.resources].sort((a, b) =>
    a.productId < b.productId ? -1 : a.productId > b.productId ? 1 : 0,
  );
  if (
    !ordered.length ||
    ordered.length > RESOURCE_CART_LIMIT ||
    new Set(ordered.map((item) => item.productId)).size !== ordered.length
  )
    throw new ValidationError("Invalid free resource acquisition");
  for (const item of ordered) {
    const key = `free-resource:${input.userId}:${item.productId}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
  }
  // Hold all parent rows before any build or access row, in stable order.
  await tx
    .select({ id: products.id })
    .from(products)
    .where(
      inArray(
        products.id,
        ordered.map((item) => item.productId),
      ),
    )
    .orderBy(asc(products.id))
    .for("no key update");
  const prepared = [];
  for (const item of ordered)
    prepared.push(
      await prepareFreeResourceClaim(tx, {
        ...item,
        userId: input.userId,
        source: input.source,
        requestId: input.requestId,
      }),
    );
  await lockResourceAcquisitionSession(tx, input.userId, input.currentToken);
  // Re-evaluate finite grants after every access, actor and session wait.
  const now = new Date();
  const results = new Map<string, FreeResourceClaimResult>();
  for (const item of prepared)
    results.set(item.input.productId, await writeFreeResourceClaim(tx, item, now));
  return input.resources.map((item) => {
    const result = results.get(item.productId);
    if (!result) throw new Error("Missing prepared resource result");
    return result;
  });
}

/** Single-resource and cart commands share the same mandatory auth and grant rule. */
export async function claimFreeResourceInTransaction(
  tx: ResourceTransaction,
  input: FreeResourceClaim & { currentToken: string },
): Promise<FreeResourceClaimResult> {
  const [result] = await claimFreeResourcesInTransaction(tx, {
    userId: input.userId,
    currentToken: input.currentToken,
    resources: [{ entitlementId: input.entitlementId, productId: input.productId }],
    source: input.source,
    requestId: input.requestId,
  });
  if (!result) throw new Error("Missing resource claim result");
  return result;
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
