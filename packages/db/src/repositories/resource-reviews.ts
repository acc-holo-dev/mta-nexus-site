import { and, asc, count, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  AppError,
  ForbiddenError,
  NotFoundError,
  type ResourceReviewCommand,
  type ResourceReviewDecision,
  type ResourceReviewView,
} from "@nexus/domain";
import { db } from "../client";
import {
  auditEvents,
  builds,
  comments,
  organizations,
  organizationMembers,
  products,
  reports,
  users,
} from "../schema";
import { lockUserDownloadAccess, type ResourceTransaction } from "./entitlements";
import { safePublishedBuildCondition } from "./build-safety";
import { assertBuildModerationAuthority } from "./product-mutation-authority";
import { historyPageBounds } from "./history-pagination";

const conflict = () => new AppError("Review changed; reload it", 409, "REVIEW_CHANGED");
const target = (productId: string) =>
  and(eq(comments.productId, productId), isNull(comments.contentId));
const visible = (productId: string) =>
  and(target(productId), eq(comments.reviewStatus, "published"));
const publicFields = {
  id: comments.id,
  text: comments.text,
  rating: comments.rating,
  status: comments.reviewStatus,
  revision: comments.reviewRevision,
  accessSource: sql<string>`coalesce(${comments.reviewAccessSource}, 'legacy')`,
  createdAt: comments.createdAt,
  updatedAt: comments.reviewUpdatedAt,
  author: { username: users.username, displayName: users.displayName },
};
const productFields = {
  id: products.id,
  title: products.title,
  slug: products.slug,
  status: products.status,
  authorId: products.authorId,
  organizationId: products.organizationId,
};
type Product = typeof products.$inferSelect;
async function currentProduct(tx: ResourceTransaction, id: string, write = false) {
  const [product] = await tx
    .select(productFields)
    .from(products)
    .where(eq(products.id, id))
    .limit(1)
    .for(write ? "no key update" : "share");
  if (!product) throw new NotFoundError("Resource", id);
  return product;
}
async function available(tx: ResourceTransaction, product: Pick<Product, "id" | "status">) {
  if (product.status !== "published") return false;
  const [build] = await tx
    .select({ id: builds.id })
    .from(builds)
    .where(safePublishedBuildCondition(product.id))
    .limit(1)
    .for("share");
  return !!build;
}
/** Product -> organization -> user -> membership -> access, matching publisher writes. */
async function canReview(
  tx: ResourceTransaction,
  product: Pick<Product, "id" | "authorId" | "organizationId">,
  actorId: string,
) {
  const [organization] = product.organizationId
    ? await tx
        .select({ ownerId: organizations.ownerId })
        .from(organizations)
        .where(eq(organizations.id, product.organizationId))
        .limit(1)
        .for("share")
    : [];
  const [actor] = await tx
    .select({ role: users.role })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1)
    .for("share");
  if (!actor) throw new ForbiddenError();
  const [membership] =
    organization && product.organizationId
      ? await tx
          .select({ role: organizationMembers.role, permissions: organizationMembers.permissions })
          .from(organizationMembers)
          .where(
            and(
              eq(organizationMembers.organizationId, product.organizationId),
              eq(organizationMembers.userId, actorId),
            ),
          )
          .limit(1)
          .for("share")
      : [];
  if (
    product.authorId === actorId ||
    actor.role === "admin" ||
    organization?.ownerId === actorId ||
    (membership &&
      (["owner", "admin"].includes(membership.role) ||
        membership.permissions.includes("manage_products")))
  )
    return null;
  const access = await lockUserDownloadAccess(tx, actorId, product.id);
  return access && (!access.expiresAt || access.expiresAt.getTime() > Date.now()) ? access : null;
}
function recheck(
  access: Awaited<ReturnType<typeof lockUserDownloadAccess>>,
): asserts access is NonNullable<Awaited<ReturnType<typeof lockUserDownloadAccess>>> {
  if (!access || (access.expiresAt && access.expiresAt.getTime() <= Date.now()))
    throw new AppError("Current acquired access is required", 403, "REVIEW_ACCESS_REQUIRED");
}
async function aggregate(tx: ResourceTransaction, productId: string) {
  const [totals] = await tx
    .select({
      ratingCount: sql<number>`count(*)::int`,
      ratingAverage: sql<number>`coalesce(round(avg(${comments.rating}) * 10), 0)::int`,
    })
    .from(comments)
    .where(and(visible(productId), sql`${comments.rating} between 1 and 5`));
  const result = {
    ratingCount: totals?.ratingCount ?? 0,
    ratingAverage: totals?.ratingAverage ?? 0,
  };
  // Review activity does not invalidate the publisher's metadata revision.
  await tx.update(products).set(result).where(eq(products.id, productId));
  return result;
}
async function audit(
  tx: ResourceTransaction,
  actorId: string,
  auditId: string,
  action: string,
  id: string,
  details: Record<string, unknown>,
  staff = false,
) {
  await tx.insert(auditEvents).values({
    id: auditId,
    actorId,
    actorType: staff ? "admin" : "user",
    action,
    targetType: "review",
    targetId: id,
    details,
  });
}
const reportFields = {
  id: reports.id,
  targetId: reports.targetId,
  type: reports.type,
  reason: reports.reason,
  status: reports.status,
  createdAt: reports.createdAt,
  resolvedAt: reports.resolvedAt,
};
type ReportScope = { actorId: string; staff: boolean };

class ResourceReviewsRepository {
  async publicPage(productId: string, page = 1) {
    return db.transaction(
      async (tx) => {
        const product = await currentProduct(tx, productId);
        if (!(await available(tx, product))) throw new NotFoundError("Resource", productId);
        const [summary] = await tx
          .select({ total: count() })
          .from(comments)
          .where(visible(productId));
        const bounds = historyPageBounds(summary?.total ?? 0, page);
        const reviews = await tx
          .select(publicFields)
          .from(comments)
          .leftJoin(users, eq(users.id, comments.authorId))
          .where(visible(productId))
          .orderBy(desc(comments.createdAt), desc(comments.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { reviews: reviews as ResourceReviewView[], ...bounds };
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async ownDetail(actorId: string, productId: string) {
    return db.transaction(
      async (tx) => {
        const product = await currentProduct(tx, productId);
        const [review] = await tx
          .select({ ...publicFields, moderationReason: comments.reviewModerationReason })
          .from(comments)
          .leftJoin(users, eq(users.id, comments.authorId))
          .where(and(target(productId), eq(comments.authorId, actorId)))
          .limit(1);
        const ready = await available(tx, product);
        if (!ready && !review) throw new NotFoundError("Resource", productId);
        const access = await canReview(tx, product, actorId);
        return {
          product: {
            id: productId,
            title: ready ? product.title : null,
            slug: ready ? product.slug : null,
          },
          review: review
            ? { ...review, status: review.status as ResourceReviewView["status"] }
            : null,
          canReview:
            ready &&
            !!access &&
            (!access.expiresAt || access.expiresAt.getTime() > Date.now()) &&
            review?.status !== "removed",
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async ownPage(actorId: string, page = 1) {
    return db.transaction(
      async (tx) => {
        const condition = and(
          eq(comments.authorId, actorId),
          isNull(comments.contentId),
          sql`${comments.productId} is not null`,
        );
        const [summary] = await tx.select({ total: count() }).from(comments).where(condition);
        const bounds = historyPageBounds(summary?.total ?? 0, page);
        const ready = sql`(${products.status} = 'published' and exists (select 1 from ${builds} where ${safePublishedBuildCondition(products.id.getSQL())}))`;
        const items = await tx
          .select({
            id: comments.id,
            productId: products.id,
            text: comments.text,
            rating: comments.rating,
            status: comments.reviewStatus,
            createdAt: comments.createdAt,
            title: sql<string | null>`case when ${ready} then ${products.title} end`,
            slug: sql<string | null>`case when ${ready} then ${products.slug} end`,
          })
          .from(comments)
          .innerJoin(products, eq(products.id, comments.productId))
          .where(condition)
          .orderBy(desc(comments.createdAt), desc(comments.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { items, ...bounds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async command(input: {
    actorId: string;
    productId: string;
    reviewId: string;
    auditId: string;
    command: ResourceReviewCommand;
  }) {
    const command = input.command;
    if (
      !["save", "withdraw"].includes(command.action) ||
      !Number.isSafeInteger(command.expectedRevision) ||
      command.expectedRevision < 0 ||
      command.expectedRevision >= 2147483647 ||
      (command.action === "save" &&
        (typeof command.text !== "string" ||
          !Number.isInteger(command.rating) ||
          command.rating < 1 ||
          command.rating > 5 ||
          command.text.trim().length < 3 ||
          command.text.length > 4000))
    )
      throw new AppError("Invalid review", 400, "REVIEW_INVALID");
    return db.transaction(async (tx) => {
      const product = await currentProduct(tx, input.productId, true);
      // Locks authority even for withdrawal; a revoked account cannot write.
      const access = await canReview(tx, product, input.actorId);
      const [current] = await tx
        .select({
          id: comments.id,
          status: comments.reviewStatus,
          revision: comments.reviewRevision,
        })
        .from(comments)
        .where(and(target(product.id), eq(comments.authorId, input.actorId)))
        .limit(1)
        .for("update");
      if ((current?.revision ?? 0) !== command.expectedRevision) throw conflict();
      if (current?.status === "removed")
        throw new AppError("Removed reviews cannot be republished", 409, "REVIEW_MODERATED");
      if (command.action === "withdraw") {
        if (!current) throw new NotFoundError("Review");
        if (current.status === "withdrawn")
          return {
            id: current.id,
            revision: current.revision,
            status: "withdrawn",
            ...(await aggregate(tx, product.id)),
          };
        await tx
          .update(comments)
          .set({
            reviewStatus: "withdrawn",
            reviewRevision: current.revision + 1,
            reviewUpdatedAt: new Date(),
          })
          .where(eq(comments.id, current.id));
        await audit(tx, input.actorId, input.auditId, "product.review_withdrawn", current.id, {
          productId: product.id,
        });
        return {
          id: current.id,
          revision: current.revision + 1,
          status: "withdrawn",
          ...(await aggregate(tx, product.id)),
        };
      }
      if (!(await available(tx, product))) throw new NotFoundError("Resource", product.id);
      recheck(access);
      const values = {
        text: command.text.trim(),
        rating: command.rating,
        reviewStatus: "published",
        reviewAccessSource: access.source,
        isVerifiedPurchase: true,
        reviewRevision: (current?.revision ?? 0) + 1,
        reviewUpdatedAt: new Date(),
      };
      if (current) await tx.update(comments).set(values).where(eq(comments.id, current.id));
      else
        await tx.insert(comments).values({
          id: input.reviewId,
          productId: product.id,
          authorId: input.actorId,
          ...values,
        });
      const totals = await aggregate(tx, product.id);
      recheck(access);
      await audit(
        tx,
        input.actorId,
        input.auditId,
        current ? "product.review_edited" : "product.review_submitted",
        current?.id ?? input.reviewId,
        { productId: product.id, rating: values.rating, accessSource: access.source },
      );
      const [review] = await tx
        .select(publicFields)
        .from(comments)
        .leftJoin(users, eq(users.id, comments.authorId))
        .where(eq(comments.id, current?.id ?? input.reviewId))
        .limit(1);
      recheck(access);
      return {
        id: current?.id ?? input.reviewId,
        revision: values.reviewRevision,
        status: "published",
        review,
        ...totals,
      };
    });
  }
  async report(input: {
    actorId: string;
    productId: string;
    reviewId: string;
    id: string;
    auditId: string;
    type: string;
    reason: string;
  }) {
    if (
      !["spam", "abuse", "copyright", "other"].includes(input.type) ||
      input.reason.trim().length < 10 ||
      input.reason.length > 1000
    )
      throw new AppError("Invalid report", 400, "REVIEW_REPORT_INVALID");
    return db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`report:${input.actorId}:review:${input.reviewId}`}))`,
      );
      const product = await currentProduct(tx, input.productId);
      if (!(await available(tx, product))) throw new NotFoundError("Resource");
      const [review] = await tx
        .select({ authorId: comments.authorId })
        .from(comments)
        .where(and(visible(product.id), eq(comments.id, input.reviewId)))
        .limit(1)
        .for("share");
      const [actor] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.actorId))
        .limit(1)
        .for("share");
      if (!review || !actor) throw new NotFoundError("Review");
      if (review.authorId === input.actorId)
        throw new AppError("Own review", 422, "REPORT_OWN_TARGET");
      const [existing] = await tx
        .select({ id: reports.id })
        .from(reports)
        .where(
          and(
            eq(reports.targetType, "review"),
            eq(reports.targetId, input.reviewId),
            eq(reports.reporterId, input.actorId),
            inArray(reports.status, ["open", "under_review"]),
          ),
        )
        .limit(1);
      if (existing) return { id: existing.id, created: false };
      await tx.insert(reports).values({
        id: input.id,
        reporterId: input.actorId,
        targetType: "review",
        targetId: input.reviewId,
        type: input.type,
        reason: input.reason.trim(),
        status: "open",
      });
      await audit(tx, input.actorId, input.auditId, "product.review_reported", input.reviewId, {
        productId: product.id,
        reportId: input.id,
        type: input.type,
      });
      return { id: input.id, created: true };
    });
  }
  async reportsPage(scope: ReportScope, page = 1, view: "pending" | "history" = "pending") {
    return db.transaction(
      async (tx) => {
        if (scope.staff) await assertBuildModerationAuthority(tx, scope.actorId);
        const condition = and(
          eq(reports.targetType, "review"),
          scope.staff ? undefined : eq(reports.reporterId, scope.actorId),
          inArray(
            reports.status,
            view === "pending" ? ["open", "under_review"] : ["resolved", "dismissed"],
          ),
        );
        const [summary] = await tx.select({ total: count() }).from(reports).where(condition);
        const bounds = historyPageBounds(summary?.total ?? 0, page);
        const items = await tx
          .select(reportFields)
          .from(reports)
          .where(condition)
          .orderBy(
            ...(scope.staff && view === "pending"
              ? [asc(reports.createdAt), asc(reports.id)]
              : [desc(reports.createdAt), desc(reports.id)]),
          )
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { items, view, ...bounds };
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async reportDetail(scope: ReportScope, id: string) {
    return db.transaction(
      async (tx) => {
        if (scope.staff) await assertBuildModerationAuthority(tx, scope.actorId);
        const [report] = await tx
          .select({
            ...reportFields,
            ...(scope.staff ? { moderatorNotes: reports.moderatorNotes } : {}),
          })
          .from(reports)
          .where(
            and(
              eq(reports.id, id),
              eq(reports.targetType, "review"),
              scope.staff ? undefined : eq(reports.reporterId, scope.actorId),
            ),
          )
          .limit(1);
        if (!report) throw new NotFoundError("Report");
        const [review] = await tx
          .select({
            ...publicFields,
            productId: products.id,
            title: products.title,
            slug: products.slug,
          })
          .from(comments)
          .innerJoin(products, eq(products.id, comments.productId))
          .leftJoin(users, eq(users.id, comments.authorId))
          .where(
            and(
              eq(comments.id, report.targetId),
              isNull(comments.contentId),
              scope.staff
                ? undefined
                : and(
                    eq(comments.reviewStatus, "published"),
                    eq(products.status, "published"),
                    sql`exists (select 1 from ${builds} where ${safePublishedBuildCondition(products.id.getSQL())})`,
                  ),
            ),
          )
          .limit(1);
        return { ...report, review: review ?? null };
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async decide(input: {
    actorId: string;
    id: string;
    auditId: string;
    command: ResourceReviewDecision;
  }) {
    const command = input.command;
    if (
      !["review", "resolve", "dismiss", "remove_review"].includes(command.action) ||
      !["open", "under_review"].includes(command.expectedStatus) ||
      typeof command.notes !== "string" ||
      command.notes.trim().length < 3 ||
      command.notes.length > 2000 ||
      (command.action === "remove_review" &&
        (!Number.isSafeInteger(command.expectedRevision) || (command.expectedRevision ?? 0) < 1))
    )
      throw new AppError("Invalid report decision", 400, "REVIEW_REPORT_INVALID");
    return db.transaction(async (tx) => {
      // Resolve identity first; then lock product -> review -> report -> live actor.
      const [reference] = await tx
        .select({ targetId: reports.targetId, productId: comments.productId })
        .from(reports)
        .leftJoin(comments, eq(comments.id, reports.targetId))
        .where(and(eq(reports.id, input.id), eq(reports.targetType, "review")))
        .limit(1);
      if (!reference) throw new NotFoundError("Report");
      const product = reference.productId
        ? await currentProduct(tx, reference.productId, true)
        : null;
      const [review] = product
        ? await tx
            .select({
              id: comments.id,
              authorId: comments.authorId,
              revision: comments.reviewRevision,
              status: comments.reviewStatus,
            })
            .from(comments)
            .where(and(target(product.id), eq(comments.id, reference.targetId)))
            .limit(1)
            .for("update")
        : [];
      const [report] = await tx
        .select({ status: reports.status, targetId: reports.targetId })
        .from(reports)
        .where(and(eq(reports.id, input.id), eq(reports.targetType, "review")))
        .limit(1)
        .for("update");
      await assertBuildModerationAuthority(tx, input.actorId);
      const command = input.command;
      if (!report || report.targetId !== reference.targetId) throw new NotFoundError("Report");
      if (
        report.status !== command.expectedStatus ||
        !["open", "under_review"].includes(report.status)
      )
        throw new AppError("Report changed", 409, "REVIEW_REPORT_CHANGED");
      if (command.notes.trim().length < 3 || command.notes.length > 2000)
        throw new AppError("Reason required", 400, "REVIEW_REPORT_INVALID");
      if (command.action === "remove_review") {
        if (
          !product ||
          !review ||
          review.status !== "published" ||
          review.revision !== command.expectedRevision
        )
          throw conflict();
        if (review.authorId === input.actorId)
          throw new AppError("Independent review required", 403, "REVIEW_SELF_MODERATION");
        await tx
          .update(comments)
          .set({
            reviewStatus: "removed",
            reviewRevision: review.revision + 1,
            reviewUpdatedAt: new Date(),
            reviewModerationReason: command.notes.trim(),
          })
          .where(eq(comments.id, review.id));
        await aggregate(tx, product.id);
      }
      const status =
        command.action === "review"
          ? "under_review"
          : command.action === "dismiss"
            ? "dismissed"
            : "resolved";
      await tx
        .update(reports)
        .set({
          status,
          moderatorNotes: command.notes.trim(),
          resolvedAt: status === "under_review" ? null : new Date(),
        })
        .where(eq(reports.id, input.id));
      await audit(
        tx,
        input.actorId,
        input.auditId,
        "product.review_report_decided",
        report.targetId,
        {
          reportId: input.id,
          action: command.action,
          productId: product?.id ?? null,
          reason: command.notes.trim(),
        },
        true,
      );
      return { id: input.id, status, reviewRemoved: command.action === "remove_review" };
    });
  }
}
export const resourceReviewsRepository = new ResourceReviewsRepository();
