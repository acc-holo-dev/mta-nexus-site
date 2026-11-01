import { and, eq } from "drizzle-orm";
import { AppError, NotFoundError } from "@nexus/domain";
import type { db } from "../client";
import { builds, products, resourceDeliveryReceipts, supportCases, users } from "../schema";
import { lockUserDownloadAccess } from "./entitlements";
import { assertProductMutationAuthority } from "./product-mutation-authority";

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type SupportObjectContext = {
  productId: string;
  buildId?: string;
  receiptId?: string;
};

export type VerifiedSupportObjectContext = {
  relatedType: "product";
  relatedId: string;
  buildId?: string;
  receiptId?: string;
};

export async function supportActor(tx: Transaction, actorId: string | null, lock = true) {
  if (!actorId) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  const query = tx
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, actorId));
  const [actor] = await (lock ? query.for("share") : query).limit(1);
  if (!actor) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
  return { ...actor, staff: ["admin", "moderator"].includes(actor.role) };
}

export async function supportAccess(
  tx: Transaction,
  id: string,
  actorId: string | null,
  lock = true,
) {
  const actor = await supportActor(tx, actorId, lock);
  const query = tx.select().from(supportCases).where(eq(supportCases.id, id));
  const [supportCase] = await (lock ? query.for("update") : query).limit(1);
  if (!supportCase || (!actor.staff && supportCase.requesterId !== actor.id))
    throw new AppError("Support case not found", 404, "NOT_FOUND");
  return { actor, supportCase };
}

/**
 * Verifies resource/build/receipt context against the live actor situation.
 * Fail closed with NOT_FOUND so private object existence is not leaked.
 */
export async function assertSupportObjectContext(
  tx: Transaction,
  actorId: string,
  context: SupportObjectContext,
): Promise<VerifiedSupportObjectContext> {
  const [product] = await tx
    .select({
      id: products.id,
      authorId: products.authorId,
      organizationId: products.organizationId,
    })
    .from(products)
    .where(eq(products.id, context.productId))
    .limit(1)
    .for("share");
  if (!product) throw new NotFoundError("Support context", context.productId);

  let allowed = false;
  try {
    await assertProductMutationAuthority(tx, product, actorId);
    allowed = true;
  } catch (error) {
    if (!(error instanceof NotFoundError)) throw error;
    const access = await lockUserDownloadAccess(tx, actorId, product.id);
    if (access) allowed = true;
  }

  let receiptBuildId: string | undefined;
  if (context.receiptId) {
    const [receipt] = await tx
      .select({
        id: resourceDeliveryReceipts.id,
        resourceId: resourceDeliveryReceipts.resourceId,
        buildId: resourceDeliveryReceipts.buildId,
      })
      .from(resourceDeliveryReceipts)
      .where(
        and(
          eq(resourceDeliveryReceipts.id, context.receiptId),
          eq(resourceDeliveryReceipts.userId, actorId),
        ),
      )
      .limit(1)
      .for("share");
    if (!receipt || receipt.resourceId !== product.id)
      throw new NotFoundError("Support context", context.receiptId);
    if (context.buildId && receipt.buildId !== context.buildId)
      throw new NotFoundError("Support context", context.buildId);
    receiptBuildId = receipt.buildId;
    allowed = true;
  }

  if (!allowed) throw new NotFoundError("Support context", context.productId);

  const buildId = context.buildId ?? receiptBuildId;
  if (buildId) {
    const [build] = await tx
      .select({ id: builds.id, productId: builds.productId })
      .from(builds)
      .where(eq(builds.id, buildId))
      .limit(1)
      .for("share");
    if (!build || build.productId !== product.id)
      throw new NotFoundError("Support context", buildId);
  }

  return {
    relatedType: "product",
    relatedId: product.id,
    ...(buildId ? { buildId } : {}),
    ...(context.receiptId ? { receiptId: context.receiptId } : {}),
  };
}
