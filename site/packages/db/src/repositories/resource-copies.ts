import { createHash } from "node:crypto";
import {
  AppError,
  NotFoundError,
  RESOURCE_COPY_LIMIT,
  type ResourceCopyCommand,
  type ResourceCopyMetadata,
  type ResourceCopyPreview,
  type ResourceCopyReceipt,
  type User,
} from "@nexus/domain";
import { can } from "@nexus/security";
import { resourceCopyCommandSchema, resourceCopyMetadataSchema } from "@nexus/validation";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { auditEvents, resourceDraftCopies as copies, products, users } from "../schema";
import type { ResourceTransaction } from "./entitlements";
import { historyPageBounds } from "./history-pagination";
import { assertProductMutationAuthority } from "./product-mutation-authority";
import { managedProductCondition } from "./products";

type ProductRow = typeof products.$inferSelect;
type ReceiptRow = typeof copies.$inferSelect;
const fail = (code: string) => new AppError("Resource copy unavailable", 409, code);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
async function limits(tx: ResourceTransaction) {
  await tx.execute(sql`set local lock_timeout = '5s'`);
  await tx.execute(sql`set local statement_timeout = '10s'`);
}
async function managed(tx: ResourceTransaction, id: string, actorId: string) {
  const [row] = await tx.select().from(products).where(eq(products.id, id)).limit(1).for("share");
  if (!row) throw new NotFoundError("Resource", id);
  await assertProductMutationAuthority(tx, row, actorId);
  return row;
}
function metadata(row: ProductRow): ResourceCopyMetadata {
  // Explicit projection: legacy compatibility JSON may contain private extras.
  const compat = object(row.compatibility);
  if (!compat) throw fail("RESOURCE_COPY_METADATA_INVALID");
  const parsed = resourceCopyMetadataSchema.safeParse({
    description: row.description,
    shortDescription: row.shortDescription ?? "",
    type: row.type,
    tags: row.tags,
    compatibility: {
      ...(compat?.mtaMinVersion !== undefined ? { mtaMinVersion: compat.mtaMinVersion } : {}),
      dependencies: compat?.dependencies ?? [],
    },
  });
  if (!parsed.success) throw fail("RESOURCE_COPY_METADATA_INVALID");
  return parsed.data;
}
export function resourceCopyPreview(row: ProductRow): ResourceCopyPreview {
  if (row.price !== 0 || row.status === "suspended") throw fail("RESOURCE_COPY_SOURCE_RESTRICTED");
  const fields = metadata(row);
  return {
    source: {
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      updatedAt: row.updatedAt,
      scope: row.organizationId ? "organization" : "personal",
    },
    metadata: fields,
    reviewDigest: hash({
      id: row.id,
      title: row.title,
      slug: row.slug,
      status: row.status,
      updatedAt: row.updatedAt.toISOString(),
      authorId: row.authorId,
      organizationId: row.organizationId,
      metadata: fields,
    }),
  };
}
function object(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}
export function resourceCopyReceipt(row: ReceiptRow): ResourceCopyReceipt {
  const snapshot = object(row.snapshot),
    source = object(snapshot?.source),
    target = object(snapshot?.target);
  const parsed = resourceCopyMetadataSchema.safeParse(snapshot?.metadata);
  if (
    snapshot?.version !== 1 ||
    source?.id !== row.sourceProductId ||
    target?.id !== row.targetProductId ||
    typeof source?.title !== "string" ||
    source.title.length > 120 ||
    typeof target?.title !== "string" ||
    target.title.length > 120 ||
    typeof target?.slug !== "string" ||
    !/^[a-z0-9]+(?:-[a-z0-9]+)*$/u.test(target.slug) ||
    target.slug.length > 120 ||
    target.createdStatus !== "draft" ||
    !parsed.success
  )
    throw fail("RESOURCE_COPY_TERMS_UNKNOWN");
  return {
    id: row.id,
    createdAt: row.createdAt,
    source: { id: row.sourceProductId, title: source.title },
    target: {
      id: row.targetProductId,
      title: target.title,
      slug: target.slug,
      createdStatus: "draft",
    },
    metadata: parsed.data,
  };
}
function slugConflict(error: unknown): boolean {
  for (
    let depth = 0, current = object(error);
    current && depth < 5;
    depth++, current = object(current.cause)
  ) {
    if (
      current.code === "23505" &&
      ["products_slug_key", "products_slug_idx", "products_slug_unique"].includes(
        String(current.constraint_name ?? current.constraint),
      )
    )
      return true;
  }
  return false;
}
export class ResourceCopiesRepository {
  async preview(actorId: string, sourceId: string) {
    return db.transaction(
      async (tx) => {
        await limits(tx);
        return resourceCopyPreview(await managed(tx, sourceId, actorId));
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async create(actorId: string, sourceId: string, input: ResourceCopyCommand) {
    const parsed = resourceCopyCommandSchema.safeParse(input);
    if (!parsed.success) throw new AppError("Invalid copy command", 400, "RESOURCE_COPY_INVALID");
    const command = parsed.data,
      requestId = command.requestId.toLowerCase();
    const commandDigest = hash({
      sourceId,
      reviewDigest: command.reviewDigest,
      title: command.title,
      slug: command.slug,
    });
    try {
      return await db.transaction(
        async (tx) => {
          await limits(tx);
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`resource-copy:${actorId}:${requestId}`}))`,
          );
          const source = await managed(tx, sourceId, actorId);
          const [prior] = await tx
            .select()
            .from(copies)
            .where(and(eq(copies.actorId, actorId), eq(copies.requestId, requestId)))
            .limit(1);
          if (prior) {
            if (prior.sourceProductId !== sourceId || prior.commandDigest !== commandDigest)
              throw fail("RESOURCE_COPY_REQUEST_CONFLICT");
            await managed(tx, prior.targetProductId, actorId);
            return {
              receipt: resourceCopyReceipt(prior),
              replayed: true,
              publisherId: source.authorId,
            };
          }
          const [liveActor] = await tx
            .select()
            .from(users)
            .where(eq(users.id, actorId))
            .limit(1)
            .for("share");
          if (!liveActor || !can(liveActor as unknown as User, "product.create"))
            throw new AppError(
              "Resource creation permission required",
              403,
              "RESOURCE_COPY_CREATE_FORBIDDEN",
            );
          const preview = resourceCopyPreview(source);
          if (preview.reviewDigest !== command.reviewDigest)
            throw fail("RESOURCE_COPY_SOURCE_CHANGED");
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`resource-copy-source:${sourceId}`}))`,
          );
          const [total] = await tx
            .select({ total: count() })
            .from(copies)
            .where(eq(copies.sourceProductId, sourceId));
          if ((total?.total ?? 0) >= RESOURCE_COPY_LIMIT) throw fail("RESOURCE_COPY_LIMIT");
          const key = hash({ actorId, requestId }),
            targetId = `prd_copy_${key}`,
            receiptId = `rcopy_${key}`;
          await tx.insert(products).values({
            id: targetId,
            title: command.title,
            slug: command.slug,
            ...preview.metadata,
            authorId: source.authorId,
            organizationId: source.organizationId,
            status: "draft",
            metadataReviewRequired: true,
            price: 0,
            currency: "USD",
            licenseModel: "unlimited",
            currentVersion: "1.0.0",
            ratingAverage: 0,
            ratingCount: 0,
            salesCount: 0,
            isFeatured: false,
            thumbnailUrl: null,
            screenshots: [],
          });
          const [record] = await tx
            .insert(copies)
            .values({
              id: receiptId,
              actorId,
              requestId,
              sourceProductId: sourceId,
              targetProductId: targetId,
              commandDigest,
            })
            .returning();
          if (!record) throw fail("RESOURCE_COPY_TERMS_UNKNOWN");
          const receipt = resourceCopyReceipt(record);
          await tx.insert(auditEvents).values([
            {
              id: `aud_copy_target_${key}`,
              actorId,
              actorType: liveActor.role === "admin" ? "admin" : "user",
              action: "product.created",
              targetId,
              targetType: "product",
              details: { title: command.title, price: 0, sourceProductId: sourceId },
            },
            {
              id: `aud_copy_source_${key}`,
              actorId,
              actorType: liveActor.role === "admin" ? "admin" : "user",
              action: "product.draft_copied",
              targetId: sourceId,
              targetType: "product",
              details: { targetProductId: targetId, receiptId },
            },
          ]);
          return { receipt, replayed: false, publisherId: source.authorId };
        },
        { isolationLevel: "read committed" },
      );
    } catch (error) {
      if (slugConflict(error)) throw fail("RESOURCE_COPY_SLUG_TAKEN");
      throw error;
    }
  }
  async detail(actorId: string, sourceId: string, receiptId: string) {
    return db.transaction(
      async (tx) => {
        await limits(tx);
        await managed(tx, sourceId, actorId);
        const [row] = await tx
          .select()
          .from(copies)
          .where(and(eq(copies.id, receiptId), eq(copies.sourceProductId, sourceId)))
          .limit(1);
        if (!row) throw new NotFoundError("Copy", receiptId);
        const target = await managed(tx, row.targetProductId, actorId);
        return { receipt: resourceCopyReceipt(row), targetStatus: target.status };
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async page(
    actorId: string,
    sourceId: string,
    requestedPage = 1,
    days: 7 | 30 | 90 | 365 | "all" = "all",
  ) {
    return db.transaction(
      async (tx) => {
        await limits(tx);
        const source = await managed(tx, sourceId, actorId),
          observedAt = new Date();
        const condition = and(
          eq(copies.sourceProductId, sourceId),
          managedProductCondition({ id: actorId, role: "user" }),
          sql`${copies.createdAt} <= ${observedAt}`,
          days === "all"
            ? undefined
            : sql`${copies.createdAt} >= ${new Date(observedAt.getTime() - days * 86400000)}`,
        );
        const [total] = await tx
          .select({ total: count() })
          .from(copies)
          .innerJoin(products, eq(products.id, copies.targetProductId))
          .where(condition);
        const bounds = historyPageBounds(total?.total ?? 0, requestedPage);
        const rows = await tx
          .select({ row: copies, targetStatus: products.status })
          .from(copies)
          .innerJoin(products, eq(products.id, copies.targetProductId))
          .where(condition)
          .orderBy(desc(copies.createdAt), desc(copies.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return {
          source: { id: source.id, title: source.title },
          observedAt,
          ...bounds,
          copies: rows.map(({ row, targetStatus }) => {
            const receipt = resourceCopyReceipt(row);
            return {
              id: receipt.id,
              createdAt: receipt.createdAt,
              target: receipt.target,
              targetStatus,
            };
          }),
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }
}
export const resourceCopiesRepository = new ResourceCopiesRepository();
