import { createHash } from "node:crypto";
import {
  AppError,
  commercialFeeEstimate,
  NotFoundError,
  type PlanReview,
  type PlanReviewCommand,
  type PlanReviewDetail,
  readPlanReviewTerms,
  UnauthorizedError,
} from "@nexus/domain";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import {
  auditEvents,
  commercialPlans as plans,
  commercialPlanReviews as reviews,
  commercialPlanRevisions as versions,
} from "../schema";
import type { ResourceTransaction } from "./entitlements";
import { lockFinancialAccountAuthority } from "./financial-statements";
import { historyPageBounds } from "./history-pagination";
import { lockInitiatingSession } from "./initiating-session";

const conflict = () => new AppError("Plan review request changed", 409, "PLAN_REVIEW_CONFLICT");
const changed = () => new AppError("Published plan changed", 409, "PLAN_REVIEW_PLAN_CHANGED");
type ReviewRow = typeof reviews.$inferSelect;
function projection(row: ReviewRow): PlanReview {
  const terms = readPlanReviewTerms(row.termsSnapshot);
  if (!terms) throw new AppError("Recorded terms unavailable", 409, "PLAN_REVIEW_TERMS_UNKNOWN");
  return {
    id: row.id,
    planId: row.planId,
    planRevision: row.planRevision,
    scope: row.subjectType,
    subjectId: row.subjectId,
    createdAt: row.createdAt,
    terms,
    estimate: commercialFeeEstimate(row.grossAmount, row.currency, terms.commissionBps),
  };
}
function account(actorId: string, organizationId?: string) {
  return and(
    eq(reviews.subjectType, organizationId ? "organization" : "user"),
    eq(reviews.subjectId, organizationId ?? actorId),
  );
}
async function limits(tx: ResourceTransaction) {
  await tx.execute(sql`set local lock_timeout = '5s'`);
  await tx.execute(sql`set local statement_timeout = '10s'`);
}
export class PlanReviewsRepository {
  async save(actorId: string, command: PlanReviewCommand, currentToken: string) {
    if (!currentToken) throw new UnauthorizedError();
    const requestId = command.requestId.toLowerCase();
    return db.transaction(
      async (tx) => {
        await limits(tx);
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`plan-review:${actorId}:${requestId}`}))`,
        );
        await lockFinancialAccountAuthority(tx, actorId, command.organizationId);
        const [prior] = await tx
          .select()
          .from(reviews)
          .where(and(eq(reviews.actorId, actorId), eq(reviews.requestId, requestId)))
          .limit(1);
        const subjectType = command.organizationId ? "organization" : "user",
          subjectId = command.organizationId ?? actorId;
        if (prior) {
          await lockInitiatingSession(tx, actorId, currentToken);
          if (
            prior.subjectType !== subjectType ||
            prior.subjectId !== subjectId ||
            prior.planId !== command.planId ||
            prior.planRevision !== command.expectedRevision ||
            prior.grossAmount !== command.grossAmount ||
            prior.currency !== command.currency
          )
            throw conflict();
          return { review: projection(prior), replayed: true };
        }
        const [plan] = await tx
          .select()
          .from(plans)
          .where(eq(plans.id, command.planId))
          .limit(1)
          .for("share");
        if (
          plan?.status !== "published" ||
          plan.scope !== subjectType ||
          plan.revision !== command.expectedRevision
        )
          throw changed();
        const [version] = await tx
          .select({ terms: versions.terms, status: versions.status })
          .from(versions)
          .where(and(eq(versions.planId, plan.id), eq(versions.revision, plan.revision)))
          .limit(1);
        if (version?.status !== "published" || !readPlanReviewTerms(version.terms)) throw changed();
        // Serialize the bounded review count across all administrators of the same account.
        await tx.execute(
          sql`select pg_advisory_xact_lock(hashtext(${`plan-review-account:${subjectType}:${subjectId}`}))`,
        );
        // All account, plan and advisory waits precede the final session check.
        await lockInitiatingSession(tx, actorId, currentToken);
        const [total] = await tx
          .select({ total: count() })
          .from(reviews)
          .where(account(actorId, command.organizationId));
        if ((total?.total ?? 0) >= 500)
          throw new AppError("Saved review limit reached", 409, "PLAN_REVIEW_LIMIT");
        const id = `prev_${createHash("sha256").update(`${actorId}:${requestId}`).digest("hex")}`;
        const [record] = await tx
          .insert(reviews)
          .values({
            id,
            actorId,
            requestId: requestId,
            subjectType,
            subjectId,
            planId: plan.id,
            planRevision: plan.revision,
            grossAmount: command.grossAmount,
            currency: command.currency,
          })
          .returning();
        if (!record) throw changed();
        await tx.insert(auditEvents).values({
          id: `aud_${id}`,
          actorId,
          actorType: "user",
          action: "commerce.plan_review_saved",
          targetId: id,
          targetType: "commercial_plan_review",
          details: { planId: plan.id, revision: plan.revision, subjectType, subjectId },
        });
        return { review: projection(record), replayed: false };
      },
      { isolationLevel: "read committed" },
    );
  }
  async page(
    actorId: string,
    organizationId?: string,
    page = 1,
    days: 7 | 30 | 90 | 365 | "all" = "all",
  ) {
    return db.transaction(
      async (tx) => {
        await limits(tx);
        const scope = await lockFinancialAccountAuthority(tx, actorId, organizationId),
          observedAt = new Date();
        const condition = and(
          account(actorId, organizationId),
          days === "all"
            ? undefined
            : sql`${reviews.createdAt} >= ${new Date(observedAt.getTime() - days * 86400000)}`,
          sql`${reviews.createdAt} <= ${observedAt}`,
        );
        const [total] = await tx.select({ total: count() }).from(reviews).where(condition),
          bounds = historyPageBounds(total?.total ?? 0, page);
        const rows = await tx
          .select()
          .from(reviews)
          .where(condition)
          .orderBy(desc(reviews.createdAt), desc(reviews.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { scope, observedAt, reviews: rows.map(projection), ...bounds };
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async detail(actorId: string, id: string, organizationId?: string): Promise<PlanReviewDetail> {
    return db.transaction(
      async (tx) => {
        await limits(tx);
        await lockFinancialAccountAuthority(tx, actorId, organizationId);
        const [row] = await tx
          .select()
          .from(reviews)
          .where(and(eq(reviews.id, id), account(actorId, organizationId)))
          .limit(1);
        if (!row) throw new NotFoundError("Plan review", id);
        const [current] = await tx
          .select({ revision: plans.revision, terms: versions.terms })
          .from(plans)
          .innerJoin(
            versions,
            and(eq(versions.planId, plans.id), eq(versions.revision, plans.revision)),
          )
          .where(
            and(
              eq(plans.id, row.planId),
              eq(plans.scope, row.subjectType),
              eq(plans.status, "published"),
              eq(versions.status, "published"),
            ),
          )
          .limit(1);
        const terms = readPlanReviewTerms(current?.terms);
        return {
          review: projection(row),
          observedAt: new Date(),
          state: !terms
            ? "unavailable"
            : current.revision === row.planRevision
              ? "current"
              : "changed",
          current: current && terms ? { revision: current.revision, terms } : null,
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }
}
export const planReviewsRepository = new PlanReviewsRepository();
