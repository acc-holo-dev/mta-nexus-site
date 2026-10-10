import { and, asc, count, desc, eq, sql } from "drizzle-orm";
import { ForbiddenError, NotFoundError } from "@nexus/domain";
import { db } from "../client";
import {
  ledgerEntries as ledger,
  organizationMembers,
  organizations,
  orders,
  payments,
  users,
} from "../schema";
import { historyPageBounds } from "./history-pagination";
import type { ResourceTransaction } from "./entitlements";

async function account(tx: ResourceTransaction, userId: string, organizationId?: string) {
  const [organization] = organizationId
    ? await tx
        .select({ id: organizations.id, ownerId: organizations.ownerId, name: organizations.name })
        .from(organizations)
        .where(eq(organizations.id, organizationId))
        .limit(1)
        .for("share")
    : [];
  const [actor] = await tx
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .for("share");
  if (!actor) throw new ForbiddenError();
  if (!organizationId) return { id: `user:${userId}`, name: null };
  if (!organization) throw new NotFoundError("Financial account", organizationId);
  if (organization.ownerId !== userId) {
    const [member] = await tx
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId),
          eq(organizationMembers.userId, userId),
        ),
      )
      .limit(1)
      .for("share");
    if (member?.role !== "owner" && member?.role !== "admin")
      throw new NotFoundError("Financial account", organizationId);
  }
  return { id: `org:${organizationId}`, name: organization.name };
}
export class FinancialStatementsRepository {
  async scopes(userId: string, page = 1) {
    const condition = sql`${organizations.ownerId} = ${userId} OR EXISTS (SELECT 1 FROM ${organizationMembers}
      WHERE ${organizationMembers.organizationId} = ${organizations.id} AND ${organizationMembers.userId} = ${userId} AND ${organizationMembers.role} IN ('owner', 'admin'))`;
    return db.transaction(
      async (tx) => {
        const [total] = await tx.select({ total: count() }).from(organizations).where(condition);
        const bounds = historyPageBounds(total?.total ?? 0, page);
        const scopes = await tx
          .select({ id: organizations.id, name: organizations.name })
          .from(organizations)
          .where(condition)
          .orderBy(asc(organizations.name), asc(organizations.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return { scopes, ...bounds };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async statement(userId: string, page = 1, currency?: string, organizationId?: string) {
    return db.transaction(
      async (tx) => {
        const scope = await account(tx, userId, organizationId);
        const condition = and(
          eq(ledger.accountId, scope.id),
          currency ? eq(ledger.currency, currency) : undefined,
        );
        const totals = await tx
          .select({
            currency: ledger.currency,
            balance: sql<string>`sum(${ledger.amount})::text`,
            credits: sql<string>`coalesce(sum(${ledger.amount}) filter (where ${ledger.amount} > 0), 0)::text`,
            debits: sql<string>`coalesce(sum(${ledger.amount}) filter (where ${ledger.amount} < 0), 0)::text`,
            entries: count(),
            legacyEntries: sql<number>`count(*) filter (where ${ledger.batchId} is null)::integer`,
          })
          .from(ledger)
          .where(condition)
          .groupBy(ledger.currency)
          .orderBy(asc(ledger.currency));
        const total = totals.reduce((sum, row) => sum + Number(row.entries), 0),
          bounds = historyPageBounds(total, page);
        const entries = await tx
          .select({
            id: ledger.id,
            amount: ledger.amount,
            currency: ledger.currency,
            referenceType: ledger.referenceType,
            referenceId: ledger.referenceId,
            balanceAfter: ledger.balanceAfter,
            createdAt: ledger.createdAt,
            journal: sql<boolean>`${ledger.batchId} is not null`,
          })
          .from(ledger)
          .where(condition)
          .orderBy(desc(ledger.createdAt), desc(ledger.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        // Neither legacy balances nor balanced postings prove payment/hold/payout eligibility.
        return {
          scope,
          totals: totals.map((row) => ({ ...row, held: null, available: null })),
          entries,
          availability: "unreconciled" as const,
          ...bounds,
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }
}
const reviewSource = sql`WITH review AS (SELECT ${orders.id} AS id, ${orders.orderNumber} AS "orderNumber", ${orders.status} AS status,
  ${orders.totalAmount} AS amount, ${orders.currency} AS currency, ${orders.createdAt} AS "createdAt",
  (${orders.currency} NOT IN ('USD','EUR','RUB') OR EXISTS (SELECT 1 FROM ${payments} WHERE ${payments.orderId} = ${orders.id} AND ${payments.currency} NOT IN ('USD','EUR','RUB'))) AS "unsupportedCurrency",
  EXISTS (SELECT 1 FROM ${payments} WHERE ${payments.orderId} = ${orders.id} AND (${payments.amount} <> ${orders.totalAmount} OR ${payments.currency} <> ${orders.currency})) AS "amountMismatch",
  (${orders.status} = 'completed' AND ${orders.totalAmount} > 0 AND NOT EXISTS (SELECT 1 FROM ${payments} WHERE ${payments.orderId} = ${orders.id} AND ${payments.status} IN ('completed','refunded','partially_refunded','disputed'))) AS "missingCapture",
  ((SELECT count(*) FROM ${payments} WHERE ${payments.orderId} = ${orders.id} AND ${payments.status} IN ('completed','refunded','partially_refunded','disputed')) > 1) AS "multipleCaptures",
  (${orders.status} = 'cancelled' AND (EXISTS (SELECT 1 FROM ${payments} WHERE ${payments.orderId} = ${orders.id}) OR EXISTS (SELECT 1 FROM ${ledger} WHERE ${ledger.referenceId} = ${orders.id}))) AS "cancelledReferences",
  EXISTS (SELECT 1 FROM ${ledger} WHERE ${ledger.referenceId} = ${orders.id} GROUP BY ${ledger.currency} HAVING sum(${ledger.amount}) <> 0) AS "unbalancedLedger",
  (${orders.status} = 'completed' AND ${orders.totalAmount} > 0 AND NOT EXISTS (SELECT 1 FROM ${ledger} WHERE ${ledger.referenceId} = ${orders.id})) AS "missingLedger"
  FROM ${orders})`;
export type FinancialReviewRow = {
  id: string;
  orderNumber: string;
  status: string;
  amount: number;
  currency: string;
  createdAt: Date;
  unsupportedCurrency: boolean;
  amountMismatch: boolean;
  missingCapture: boolean;
  multipleCaptures: boolean;
  cancelledReferences: boolean;
  unbalancedLedger: boolean;
  missingLedger: boolean;
};
export class FinancialReviewRepository {
  async page(actorId: string, page = 1, filter: "all" | "review" = "review") {
    return db.transaction(
      async (tx) => {
        // Financial evidence is restricted to current admins, not general moderators.
        const [actor] = await tx
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, actorId))
          .limit(1)
          .for("share");
        if (actor?.role !== "admin") throw new ForbiddenError();
        const condition =
          filter === "all"
            ? sql`true`
            : sql`"unsupportedCurrency" OR "amountMismatch" OR "missingCapture" OR "multipleCaptures" OR "cancelledReferences" OR "unbalancedLedger" OR "missingLedger"`;
        const [total] = await tx.execute<{ total: number }>(
          sql`${reviewSource} SELECT count(*)::integer AS total FROM review WHERE ${condition}`,
        );
        const bounds = historyPageBounds(Number(total?.total ?? 0), page);
        const rows = await tx.execute<FinancialReviewRow>(
          sql`${reviewSource} SELECT * FROM review WHERE ${condition} ORDER BY "createdAt" DESC, id DESC LIMIT ${bounds.pageSize} OFFSET ${bounds.offset}`,
        );
        return { orders: rows, filter, ...bounds };
      },
      { isolationLevel: "repeatable read" },
    );
  }
  async detail(actorId: string, orderId: string, page = 1) {
    return db.transaction(
      async (tx) => {
        const [actor] = await tx
          .select({ role: users.role })
          .from(users)
          .where(eq(users.id, actorId))
          .limit(1)
          .for("share");
        if (actor?.role !== "admin") throw new ForbiddenError();
        const [order] = await tx.execute<FinancialReviewRow>(
          sql`${reviewSource} SELECT * FROM review WHERE id = ${orderId}`,
        );
        if (!order) throw new NotFoundError("Order", orderId);
        const [total] = await tx
          .select({ total: count() })
          .from(payments)
          .where(eq(payments.orderId, orderId));
        const bounds = historyPageBounds(total?.total ?? 0, page);
        const attempts = await tx
          .select({
            id: payments.id,
            provider: payments.provider,
            status: payments.status,
            amount: payments.amount,
            currency: payments.currency,
            createdAt: payments.createdAt,
          })
          .from(payments)
          .where(eq(payments.orderId, orderId))
          .orderBy(desc(payments.createdAt), desc(payments.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        const ledgerTotals = await tx
          .select({
            currency: ledger.currency,
            entries: count(),
            net: sql<string>`sum(${ledger.amount})::text`,
          })
          .from(ledger)
          .where(eq(ledger.referenceId, orderId))
          .groupBy(ledger.currency)
          .orderBy(asc(ledger.currency));
        return { order, attempts, ledgerTotals, ...bounds };
      },
      { isolationLevel: "repeatable read" },
    );
  }
}
export const financialStatementsRepository = new FinancialStatementsRepository();
export const financialReviewRepository = new FinancialReviewRepository();
