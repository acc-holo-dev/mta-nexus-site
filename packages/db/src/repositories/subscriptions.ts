import { createHash } from "node:crypto";
import {
  type AccountSubscription,
  AppError,
  BASE_COMMISSION_BPS,
  type CommercialCurrency,
  commercialFeeEstimate,
  effectiveSubscriptionStatus,
  FREE_SUBSCRIPTION_LIMIT,
  INITIAL_HOLD_DAYS,
  NotFoundError,
  readPlanReviewTerms,
  readSubscriptionSnapshot,
  type SubscriptionCommand,
  type SubscriptionReceipt,
  UnauthorizedError,
} from "@nexus/domain";
import { subscriptionCommandSchema } from "@nexus/validation";
import { and, count, desc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import {
  auditEvents,
  commercialPlans as plans,
  subscriptionReceipts as receipts,
  accountSubscriptions as subscriptions,
  commercialPlanRevisions as versions,
} from "../schema";
import type { ResourceTransaction } from "./entitlements";
import { lockFinancialAccountAuthority } from "./financial-statements";
import { historyPageBounds } from "./history-pagination";
import { lockInitiatingSession } from "./initiating-session";

const fail = (code: string) => new AppError("Subscription operation unavailable", 409, code);
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
type SubscriptionRow = typeof subscriptions.$inferSelect;
type ReceiptRow = typeof receipts.$inferSelect;
const account = (actorId: string, organizationId?: string) =>
  and(
    eq(subscriptions.subjectType, organizationId ? "organization" : "user"),
    eq(subscriptions.subjectId, organizationId ?? actorId),
  );
async function limits(tx: ResourceTransaction) {
  await tx.execute(sql`set local lock_timeout = '5s'`);
  await tx.execute(sql`set local statement_timeout = '10s'`);
}
async function clock(tx: ResourceTransaction) {
  const [row] = await tx
    .select({ observedAt: sql<string>`date_trunc('milliseconds',clock_timestamp())::text` })
    .from(sql`(select 1) as subscription_clock`);
  const observedAt = new Date(row?.observedAt ?? "");
  if (!Number.isFinite(observedAt.getTime())) throw fail("SUBSCRIPTION_TIME_UNKNOWN");
  return observedAt;
}
function projection(row: SubscriptionRow, observedAt?: Date): AccountSubscription {
  const subscription = readSubscriptionSnapshot({
    version: 1,
    id: row.id,
    subjectType: row.subjectType,
    subjectId: row.subjectId,
    planId: row.planId,
    planRevision: row.planRevision,
    terms: row.termsSnapshot,
    startedAt: row.startedAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    cancelledAt: row.cancelledAt?.toISOString() ?? null,
    status: row.status,
  });
  if (!subscription) throw fail("SUBSCRIPTION_TERMS_UNKNOWN");
  const status = observedAt
    ? effectiveSubscriptionStatus(row.status, row.expiresAt, observedAt)
    : row.status;
  if (!status) throw fail("SUBSCRIPTION_TERMS_UNKNOWN");
  return { ...subscription, status };
}
export function subscriptionReceipt(row: ReceiptRow): SubscriptionReceipt {
  const subscription = readSubscriptionSnapshot(row.snapshot);
  if (
    !subscription ||
    subscription.id !== row.subscriptionId ||
    (row.action === "activate"
      ? subscription.status !== "active"
      : row.action !== "cancel" || subscription.status !== "cancelled")
  )
    throw fail("SUBSCRIPTION_TERMS_UNKNOWN");
  return { id: row.id, action: row.action, createdAt: row.createdAt, subscription };
}
function assertScope(subscription: AccountSubscription, actorId: string, organizationId?: string) {
  if (
    subscription.subjectType !== (organizationId ? "organization" : "user") ||
    subscription.subjectId !== (organizationId ?? actorId)
  )
    throw new NotFoundError("Subscription");
}
function conflictCode(error: unknown): string | null {
  let current: unknown = error;
  for (let depth = 0; current && typeof current === "object" && depth < 5; depth++) {
    const e = current as Record<string, unknown>;
    if (
      e.code === "23505" &&
      (e.constraint_name ?? e.constraint) === "account_subscriptions_active_idx"
    )
      return "SUBSCRIPTION_ALREADY_ACTIVE";
    if (e.code === "23514" && String(e.where).includes("account_subscription_guard"))
      return "SUBSCRIPTION_STATE_CHANGED";
    current = e.cause;
  }
  return null;
}
export class SubscriptionsRepository {
  async command(actorId: string, input: SubscriptionCommand, currentToken: string) {
    if (!currentToken) throw new UnauthorizedError();
    const parsed = subscriptionCommandSchema.safeParse(input);
    if (!parsed.success)
      throw new AppError("Invalid subscription command", 400, "SUBSCRIPTION_INVALID");
    const command = parsed.data,
      requestId = command.requestId.toLowerCase(),
      subjectType = command.organizationId ? ("organization" as const) : ("user" as const),
      subjectId = command.organizationId ?? actorId;
    const binding =
      command.action === "activate"
        ? {
            action: command.action,
            subjectType,
            subjectId,
            planId: command.planId,
            expectedRevision: command.expectedRevision,
          }
        : {
            action: command.action,
            subjectType,
            subjectId,
            subscriptionId: command.subscriptionId,
          };
    const digest = hash(binding),
      key = hash({ actorId, requestId });
    try {
      return await db.transaction(
        async (tx) => {
          await limits(tx);
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`subscription-request:${actorId}:${requestId}`}))`,
          );
          // Account-wide serialization also covers concurrent organization administrators.
          await tx.execute(
            sql`select pg_advisory_xact_lock(hashtext(${`subscription-account:${subjectType}:${subjectId}`}))`,
          );
          await lockFinancialAccountAuthority(tx, actorId, command.organizationId);
          const [prior] = await tx
            .select()
            .from(receipts)
            .where(and(eq(receipts.actorId, actorId), eq(receipts.requestId, requestId)))
            .limit(1);
          if (prior) {
            await lockInitiatingSession(tx, actorId, currentToken);
            if (prior.commandDigest !== digest) throw fail("SUBSCRIPTION_REQUEST_CONFLICT");
            const receipt = subscriptionReceipt(prior);
            assertScope(receipt.subscription, actorId, command.organizationId);
            return { receipt, replayed: true };
          }
          let saved: SubscriptionRow | undefined;
          if (command.action === "activate") {
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
              throw fail("SUBSCRIPTION_PLAN_CHANGED");
            const [version] = await tx
              .select({ terms: versions.terms, status: versions.status })
              .from(versions)
              .where(and(eq(versions.planId, plan.id), eq(versions.revision, plan.revision)))
              .limit(1);
            const terms = readPlanReviewTerms(version?.terms);
            if (!terms || version?.status !== "published") throw fail("SUBSCRIPTION_PLAN_CHANGED");
            if (terms.price !== 0) throw fail("SUBSCRIPTION_PAYMENT_REQUIRED");
            const [current] = await tx
              .select()
              .from(subscriptions)
              .where(
                and(account(actorId, command.organizationId), eq(subscriptions.status, "active")),
              )
              .limit(1)
              .for("update");
            // Lock the session after resource locks, matching plan administration.
            // Revocation or expiry during either wait must prevent every write.
            await lockInitiatingSession(tx, actorId, currentToken);
            const observedAt = await clock(tx);
            if (current) {
              if (projection(current, observedAt).status === "active")
                throw fail("SUBSCRIPTION_ALREADY_ACTIVE");
              await tx
                .update(subscriptions)
                .set({ status: "expired" })
                .where(eq(subscriptions.id, current.id));
              await tx.insert(auditEvents).values({
                id: `aud_expired_${current.id}`,
                actorId,
                actorType: "user",
                action: "commerce.subscription_expired",
                targetId: current.id,
                targetType: "subscription",
                details: { expiresAt: current.expiresAt.toISOString() },
              });
            }
            const [total] = await tx
              .select({ total: count() })
              .from(subscriptions)
              .where(account(actorId, command.organizationId));
            if ((total?.total ?? 0) >= FREE_SUBSCRIPTION_LIMIT) throw fail("SUBSCRIPTION_LIMIT");
            [saved] = await tx
              .insert(subscriptions)
              .values({
                id: `sub_${key}`,
                actorId,
                subjectType,
                subjectId,
                planId: plan.id,
                planRevision: plan.revision,
              })
              .returning();
          } else {
            const [current] = await tx
              .select()
              .from(subscriptions)
              .where(
                and(
                  eq(subscriptions.id, command.subscriptionId),
                  account(actorId, command.organizationId),
                ),
              )
              .limit(1)
              .for("update");
            if (!current) throw new NotFoundError("Subscription");
            await lockInitiatingSession(tx, actorId, currentToken);
            const observedAt = await clock(tx);
            if (projection(current, observedAt).status !== "active")
              throw fail("SUBSCRIPTION_STATE_CHANGED");
            [saved] = await tx
              .update(subscriptions)
              .set({ status: "cancelled" })
              .where(eq(subscriptions.id, current.id))
              .returning();
          }
          if (!saved) throw fail("SUBSCRIPTION_STATE_CHANGED");
          const [record] = await tx
            .insert(receipts)
            .values({
              id: `srec_${key}`,
              actorId,
              requestId,
              subscriptionId: saved.id,
              action: command.action,
              commandDigest: digest,
            })
            .returning();
          if (!record) throw fail("SUBSCRIPTION_TERMS_UNKNOWN");
          const receipt = subscriptionReceipt(record);
          assertScope(receipt.subscription, actorId, command.organizationId);
          await tx.insert(auditEvents).values({
            id: `aud_sub_${key}`,
            actorId,
            actorType: "user",
            action: `commerce.subscription_${command.action === "activate" ? "activated_free" : "cancelled"}`,
            targetId: saved.id,
            targetType: "subscription",
            details: {
              planId: saved.planId,
              planRevision: saved.planRevision,
              receiptId: record.id,
              subjectType,
              subjectId,
              price: 0,
            },
          });
          return { receipt, replayed: false };
        },
        { isolationLevel: "read committed" },
      );
    } catch (error) {
      const code = conflictCode(error);
      if (code) throw fail(code);
      throw error;
    }
  }
  async dashboard(actorId: string, organizationId?: string) {
    return db.transaction(
      async (tx) => {
        await limits(tx);
        const scope = await lockFinancialAccountAuthority(tx, actorId, organizationId),
          observedAt = await clock(tx);
        const [row] = await tx
          .select()
          .from(subscriptions)
          .where(account(actorId, organizationId))
          .orderBy(desc(subscriptions.startedAt), desc(subscriptions.id))
          .limit(1);
        const subscription = row ? projection(row, observedAt) : null;
        return {
          scope,
          observedAt,
          subscription,
          commissionBps:
            subscription?.status === "active"
              ? subscription.terms.commissionBps
              : BASE_COMMISSION_BPS,
          initialHoldDays: INITIAL_HOLD_DAYS,
          automaticRenewal: false as const,
          freeActivationAvailable: true as const,
          paidActivationAvailable: false as const,
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async estimate(
    actorId: string,
    organizationId: string | undefined,
    amount: number,
    currency: CommercialCurrency,
  ) {
    const context = await this.dashboard(actorId, organizationId);
    return {
      observedAt: context.observedAt,
      scope: context.scope,
      subscriptionId: context.subscription?.status === "active" ? context.subscription.id : null,
      estimate: commercialFeeEstimate(amount, currency, context.commissionBps),
    };
  }
  async history(
    actorId: string,
    organizationId?: string,
    page = 1,
    days: 7 | 30 | 90 | 365 | "all" = "all",
  ) {
    return db.transaction(
      async (tx) => {
        await limits(tx);
        const scope = await lockFinancialAccountAuthority(tx, actorId, organizationId),
          observedAt = await clock(tx);
        const condition = and(
          account(actorId, organizationId),
          sql`${receipts.createdAt} <= ${observedAt}`,
          days === "all"
            ? undefined
            : sql`${receipts.createdAt} >= ${new Date(observedAt.getTime() - days * 86400000)}`,
        );
        const [total] = await tx
          .select({ total: count() })
          .from(receipts)
          .innerJoin(subscriptions, eq(subscriptions.id, receipts.subscriptionId))
          .where(condition);
        const bounds = historyPageBounds(total?.total ?? 0, page);
        const rows = await tx
          .select({ receipt: receipts })
          .from(receipts)
          .innerJoin(subscriptions, eq(subscriptions.id, receipts.subscriptionId))
          .where(condition)
          .orderBy(desc(receipts.createdAt), desc(receipts.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return {
          scope,
          observedAt,
          ...bounds,
          receipts: rows.map((r) => {
            const receipt = subscriptionReceipt(r.receipt);
            return {
              id: receipt.id,
              action: receipt.action,
              createdAt: receipt.createdAt,
              subscriptionId: receipt.subscription.id,
              planId: receipt.subscription.planId,
              planRevision: receipt.subscription.planRevision,
              titleRu: receipt.subscription.terms.titleRu,
              titleEn: receipt.subscription.terms.titleEn,
            };
          }),
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async detail(actorId: string, receiptId: string, organizationId?: string) {
    return db.transaction(
      async (tx) => {
        await limits(tx);
        await lockFinancialAccountAuthority(tx, actorId, organizationId);
        const [row] = await tx
          .select({ receipt: receipts, subscription: subscriptions })
          .from(receipts)
          .innerJoin(subscriptions, eq(subscriptions.id, receipts.subscriptionId))
          .where(and(eq(receipts.id, receiptId), account(actorId, organizationId)))
          .limit(1);
        if (!row) throw new NotFoundError("Subscription receipt");
        const observedAt = await clock(tx),
          receipt = subscriptionReceipt(row.receipt);
        assertScope(receipt.subscription, actorId, organizationId);
        return { receipt, current: projection(row.subscription, observedAt), observedAt };
      },
      { isolationLevel: "repeatable read" },
    );
  }
}
export const subscriptionsRepository = new SubscriptionsRepository();
