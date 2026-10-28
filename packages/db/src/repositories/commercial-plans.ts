import {
  AppError,
  type CommercialPlan,
  type CommercialPlanCommand,
  type CommercialPlanTerms,
  commercialPlanTransition,
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
} from "@nexus/domain";
import { and, count, desc, eq } from "drizzle-orm";
import { db } from "../client";
import {
  auditEvents,
  commercialPlans as plans,
  users,
  commercialPlanRevisions as versions,
} from "../schema";
import type { ResourceTransaction } from "./entitlements";
import { historyPageBounds } from "./history-pagination";
import { lockInitiatingSession } from "./initiating-session";

async function administrator(tx: ResourceTransaction, actorId: string) {
  const [actor] = await tx
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(eq(users.id, actorId))
    .limit(1)
    .for("share");
  if (actor?.role !== "admin")
    throw new ForbiddenError("Commercial administrator privilege is required");
}
const selection = {
  id: plans.id,
  slug: plans.slug,
  scope: plans.scope,
  status: plans.status,
  revision: plans.revision,
  updatedAt: plans.updatedAt,
  terms: versions.terms,
};
type PlanRow = {
  id: string;
  slug: string;
  scope: "user" | "organization";
  status: CommercialPlan["status"];
  revision: number;
  updatedAt: Date;
  terms: CommercialPlanTerms;
};
function projection(row: PlanRow): CommercialPlan {
  // Only documented terms cross the public boundary, never arbitrary future JSON.
  return {
    id: row.id,
    slug: row.slug,
    scope: row.scope,
    status: row.status,
    revision: row.revision,
    updatedAt: row.updatedAt,
    titleRu: row.terms.titleRu,
    titleEn: row.terms.titleEn,
    descriptionRu: row.terms.descriptionRu,
    descriptionEn: row.terms.descriptionEn,
    price: row.terms.price,
    currency: row.terms.currency,
    durationDays: row.terms.durationDays,
    commissionBps: row.terms.commissionBps,
  };
}
const currentVersion = and(eq(versions.planId, plans.id), eq(versions.revision, plans.revision));
const fail = (code: string) =>
  new AppError("Commercial plan operation cannot be applied", 409, code);

export class CommercialPlanRepository {
  async catalog(scope: "user" | "organization" = "user", page = 1) {
    return db.transaction(
      async (tx) => {
        const condition = and(
          eq(plans.scope, scope),
          eq(plans.status, "published"),
          eq(versions.status, "published"),
        );
        const [total] = await tx
          .select({ total: count() })
          .from(plans)
          .innerJoin(versions, currentVersion)
          .where(condition);
        const bounds = historyPageBounds(total?.total ?? 0, page);
        const rows = await tx
          .select(selection)
          .from(plans)
          .innerJoin(versions, currentVersion)
          .where(condition)
          .orderBy(desc(plans.createdAt), desc(plans.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { plans: rows.map(projection), ...bounds, scope };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async published(id: string) {
    const [row] = await db
      .select(selection)
      .from(plans)
      .innerJoin(versions, currentVersion)
      .where(and(eq(plans.id, id), eq(plans.status, "published"), eq(versions.status, "published")))
      .limit(1);
    return row ? projection(row) : null;
  }
  async adminPage(actorId: string, page = 1, status?: CommercialPlan["status"]) {
    return db.transaction(async (tx) => {
      await administrator(tx, actorId);
      const condition = status ? eq(plans.status, status) : undefined;
      const [total] = await tx.select({ total: count() }).from(plans).where(condition);
      const bounds = historyPageBounds(total?.total ?? 0, page);
      const rows = await tx
        .select(selection)
        .from(plans)
        .innerJoin(versions, currentVersion)
        .where(condition)
        .orderBy(desc(plans.updatedAt), desc(plans.id))
        .limit(bounds.pageSize)
        .offset(bounds.offset);
      return { plans: rows.map(projection), ...bounds };
    });
  }
  async adminDetail(actorId: string, id: string, page = 1) {
    return db.transaction(
      async (tx) => {
        await administrator(tx, actorId);
        const [row] = await tx
          .select(selection)
          .from(plans)
          .innerJoin(versions, currentVersion)
          .where(eq(plans.id, id))
          .limit(1);
        if (!row) throw new NotFoundError("Commercial plan", id);
        const [total] = await tx
          .select({ total: count() })
          .from(versions)
          .where(eq(versions.planId, id));
        const bounds = historyPageBounds(total?.total ?? 0, page);
        const history = await tx
          .select({
            revision: versions.revision,
            status: versions.status,
            action: versions.action,
            reason: versions.reason,
            terms: versions.terms,
            createdAt: versions.createdAt,
          })
          .from(versions)
          .where(eq(versions.planId, id))
          .orderBy(desc(versions.revision))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { plan: projection(row), history, ...bounds };
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async command(input: {
    actorId: string;
    currentToken: string;
    planId: string;
    auditId: string;
    command: CommercialPlanCommand;
  }) {
    if (!input.currentToken) throw new UnauthorizedError();
    try {
      return await db.transaction(async (tx) => {
        // Existing plan -> live actor -> initiating session. Creates omit the plan lock.
        const [root] =
          input.command.action === "create"
            ? []
            : await tx
                .select()
                .from(plans)
                .where(eq(plans.id, input.planId))
                .limit(1)
                .for("no key update");
        await administrator(tx, input.actorId);
        await lockInitiatingSession(tx, input.actorId, input.currentToken);
        const command = input.command,
          now = new Date();
        if (command.action === "create") {
          await tx.insert(plans).values({
            id: input.planId,
            slug: command.slug,
            scope: command.scope,
            status: "draft",
            revision: 1,
            createdAt: now,
            updatedAt: now,
          });
          await tx.insert(versions).values({
            planId: input.planId,
            revision: 1,
            terms: command.terms,
            status: "draft",
            action: command.action,
            actorId: input.actorId,
            reason: command.reason,
            createdAt: now,
          });
        } else {
          if (!root) throw new NotFoundError("Commercial plan", input.planId);
          if (root.revision !== command.expectedRevision) throw fail("COMMERCIAL_PLAN_CONFLICT");
          const status = commercialPlanTransition(root.status, command.action);
          if (!status) throw fail("COMMERCIAL_PLAN_STATE_CHANGED");
          const [previous] = await tx
            .select({ terms: versions.terms })
            .from(versions)
            .where(and(eq(versions.planId, root.id), eq(versions.revision, root.revision)))
            .limit(1);
          if (!previous) throw fail("COMMERCIAL_PLAN_STATE_CHANGED");
          const terms = command.action === "save" ? command.terms : previous.terms;
          await tx.insert(versions).values({
            planId: root.id,
            revision: root.revision + 1,
            terms,
            status,
            action: command.action,
            actorId: input.actorId,
            reason: command.reason,
            createdAt: now,
          });
          await tx
            .update(plans)
            .set({ status, revision: root.revision + 1, updatedAt: now })
            .where(eq(plans.id, root.id));
        }
        await tx.insert(auditEvents).values({
          id: input.auditId,
          actorId: input.actorId,
          actorType: "admin",
          action: `commerce.plan_${command.action}`,
          targetId: input.planId,
          targetType: "commercial_plan",
          details: {
            revision: command.action === "create" ? 1 : command.expectedRevision + 1,
            reason: command.reason,
          },
        });
        const [row] = await tx
          .select(selection)
          .from(plans)
          .innerJoin(versions, currentVersion)
          .where(eq(plans.id, input.planId))
          .limit(1);
        if (!row) throw fail("COMMERCIAL_PLAN_STATE_CHANGED");
        return { plan: projection(row) };
      });
    } catch (error) {
      const cause = error && typeof error === "object" && "cause" in error ? error.cause : error;
      if (cause && typeof cause === "object" && "code" in cause && cause.code === "23505")
        throw fail("COMMERCIAL_PLAN_CONFLICT");
      throw error;
    }
  }
}
export const commercialPlanRepository = new CommercialPlanRepository();
