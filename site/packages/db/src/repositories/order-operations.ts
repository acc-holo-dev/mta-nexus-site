import {
  AppError,
  NotFoundError,
  type OrderCancellationCommand,
  type OrderCancellationReceipt,
  UnauthorizedError,
} from "@nexus/domain";
import { and, asc, count, desc, eq, lte, notExists, sql } from "drizzle-orm";
import { db } from "../client";
import {
  auditEvents,
  ledgerEntries,
  orders,
  payments,
  orderCancellationReceipts as receipts,
  users,
} from "../schema";
import { historyPageBounds } from "./history-pagination";
import { lockInitiatingSession } from "./initiating-session";

const fail = (code: string) =>
  new AppError("Order operation cannot be applied without reconciliation", 409, code);

export type StaleUnpaidOrderExpiry = {
  id: string;
  orderNumber: string;
  buyerId: string;
  status: "cancelled";
  totalAmount: number;
  currency: string;
  createdAt: Date;
  cancelledAt: Date;
};

export class OrderOperationsRepository {
  async buyerDetail(buyerId: string, orderId: string, page = 1) {
    return db.transaction(
      async (tx) => {
        const [order] = await tx
          .select({
            id: orders.id,
            orderNumber: orders.orderNumber,
            status: orders.status,
            totalAmount: orders.totalAmount,
            currency: orders.currency,
            updatedAt: orders.updatedAt,
          })
          .from(orders)
          .where(and(eq(orders.id, orderId), eq(orders.buyerId, buyerId)))
          .limit(1);
        if (!order) throw new NotFoundError("Order", orderId);
        const [total] = await tx
          .select({ total: count() })
          .from(payments)
          .where(eq(payments.orderId, orderId));
        const [ledger] = await tx
          .select({ id: ledgerEntries.id })
          .from(ledgerEntries)
          .where(eq(ledgerEntries.referenceId, orderId))
          .limit(1);
        const bounds = historyPageBounds(total?.total ?? 0, page);
        const attempts = await tx
          .select({
            id: payments.id,
            provider: payments.provider,
            status: payments.status,
            amount: payments.amount,
            currency: payments.currency,
            createdAt: payments.createdAt,
            updatedAt: payments.updatedAt,
          })
          .from(payments)
          .where(eq(payments.orderId, orderId))
          .orderBy(desc(payments.createdAt), desc(payments.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        return {
          order,
          attempts,
          canCancel: order.status === "pending" && bounds.total === 0 && !ledger,
          ...bounds,
        };
      },
      { isolationLevel: "repeatable read", accessMode: "read only" },
    );
  }
  async cancel(input: {
    buyerId: string;
    currentToken: string;
    orderId: string;
    command: OrderCancellationCommand;
    auditId: string;
  }): Promise<OrderCancellationReceipt> {
    if (!input.currentToken) throw new UnauthorizedError();
    return db.transaction(async (tx) => {
      const command = input.command;
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`order-cancel:${input.buyerId}:${command.requestId}`}))`,
      );
      const [order] = await tx
        .select({ id: orders.id, status: orders.status, updatedAt: orders.updatedAt })
        .from(orders)
        .where(and(eq(orders.id, input.orderId), eq(orders.buyerId, input.buyerId)))
        .limit(1)
        .for("no key update");
      if (!order) throw new NotFoundError("Order", input.orderId);
      const [buyer] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.buyerId))
        .for("share");
      if (!buyer) throw new UnauthorizedError();
      await lockInitiatingSession(tx, input.buyerId, input.currentToken);
      const [receipt] = await tx
        .select({
          orderId: receipts.orderId,
          expectedUpdatedAt: receipts.expectedUpdatedAt,
          reason: receipts.reason,
          cancelledAt: receipts.cancelledAt,
        })
        .from(receipts)
        .where(and(eq(receipts.userId, input.buyerId), eq(receipts.requestId, command.requestId)))
        .limit(1);
      if (receipt) {
        if (
          receipt.orderId !== input.orderId ||
          receipt.reason !== command.reason ||
          receipt.expectedUpdatedAt.toISOString() !== command.expectedUpdatedAt
        )
          throw fail("ORDER_REQUEST_CONFLICT");
        await lockInitiatingSession(tx, input.buyerId, input.currentToken);
        return {
          kind: "unpaid_order_cancelled",
          orderId: receipt.orderId,
          requestId: command.requestId,
          cancelledAt: receipt.cancelledAt,
        };
      }
      if (order.status !== "pending") throw fail("ORDER_STATE_CHANGED");
      if (order.updatedAt.toISOString() !== command.expectedUpdatedAt)
        throw fail("ORDER_STATE_CHANGED");
      const [payment] = await tx
        .select({ id: payments.id })
        .from(payments)
        .where(eq(payments.orderId, order.id))
        .limit(1)
        .for("share");
      const [ledger] = await tx
        .select({ id: ledgerEntries.id })
        .from(ledgerEntries)
        .where(eq(ledgerEntries.referenceId, order.id))
        .limit(1)
        .for("share");
      if (payment || ledger) throw fail("ORDER_RECONCILIATION_REQUIRED");
      await lockInitiatingSession(tx, input.buyerId, input.currentToken);
      const [cancelled] = await tx
        .update(orders)
        .set({
          status: "cancelled",
          updatedAt: sql`greatest(date_trunc('milliseconds', clock_timestamp()), ${orders.updatedAt} + interval '1 millisecond')`,
        })
        .where(
          and(
            eq(orders.id, order.id),
            eq(orders.buyerId, input.buyerId),
            eq(orders.status, "pending"),
            sql`date_trunc('milliseconds', ${orders.updatedAt}) = ${new Date(command.expectedUpdatedAt)}`,
          ),
        )
        .returning({ updatedAt: orders.updatedAt });
      if (!cancelled) throw fail("ORDER_STATE_CHANGED");
      await tx.insert(receipts).values({
        userId: input.buyerId,
        requestId: command.requestId,
        orderId: order.id,
        expectedUpdatedAt: new Date(command.expectedUpdatedAt),
        reason: command.reason,
        cancelledAt: cancelled.updatedAt,
      });
      await tx.insert(auditEvents).values({
        id: input.auditId,
        actorId: input.buyerId,
        actorType: "user",
        action: "order.unpaid_cancelled",
        targetId: order.id,
        targetType: "order",
        details: { reason: command.reason, requestId: command.requestId },
      });
      await lockInitiatingSession(tx, input.buyerId, input.currentToken);
      return {
        kind: "unpaid_order_cancelled",
        orderId: order.id,
        requestId: command.requestId,
        cancelledAt: cancelled.updatedAt,
      };
    });
  }

  /**
   * Ops-expire stale unpaid pending orders: no payments, no ledger rows.
   * Mirrors buyer unpaid cancel guards without cancellation receipts.
   * Limited per invocation; empty batch is a successful no-op.
   */
  /** Read-only count of unpaid pending orders the next expireStaleUnpaid batch would process. */
  async countEligibleStaleUnpaid(input: { olderThanIso: string; limit?: number }): Promise<number> {
    const olderThan = new Date(input.olderThanIso);
    if (!Number.isFinite(olderThan.getTime())) {
      throw new AppError("Stale order timestamp is invalid", 400, "WALLET_INTENT_STALE_INVALID");
    }
    const bounded = Math.min(
      Math.max(Number.isSafeInteger(input.limit) ? (input.limit as number) : 20, 1),
      50,
    );
    const rows = await db
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.status, "pending"),
          lte(orders.createdAt, olderThan),
          notExists(
            db.select({ id: payments.id }).from(payments).where(eq(payments.orderId, orders.id)),
          ),
          notExists(
            db
              .select({ id: ledgerEntries.id })
              .from(ledgerEntries)
              .where(eq(ledgerEntries.referenceId, orders.id)),
          ),
        ),
      )
      .orderBy(asc(orders.createdAt), asc(orders.id))
      .limit(bounded);
    return rows.length;
  }

  async expireStaleUnpaid(input: {
    actorId: string;
    olderThanIso: string;
    limit?: number;
  }): Promise<StaleUnpaidOrderExpiry[]> {
    const olderThan = new Date(input.olderThanIso);
    if (!Number.isFinite(olderThan.getTime())) {
      throw new AppError("Stale order timestamp is invalid", 400, "WALLET_INTENT_STALE_INVALID");
    }
    const bounded = Math.min(
      Math.max(Number.isSafeInteger(input.limit) ? (input.limit as number) : 20, 1),
      50,
    );
    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      const candidates = await tx
        .select({
          id: orders.id,
          orderNumber: orders.orderNumber,
          buyerId: orders.buyerId,
          totalAmount: orders.totalAmount,
          currency: orders.currency,
          createdAt: orders.createdAt,
        })
        .from(orders)
        .where(
          and(
            eq(orders.status, "pending"),
            lte(orders.createdAt, olderThan),
            notExists(
              tx.select({ id: payments.id }).from(payments).where(eq(payments.orderId, orders.id)),
            ),
            notExists(
              tx
                .select({ id: ledgerEntries.id })
                .from(ledgerEntries)
                .where(eq(ledgerEntries.referenceId, orders.id)),
            ),
          ),
        )
        .orderBy(asc(orders.createdAt), asc(orders.id))
        .limit(bounded)
        .for("update");
      const expired: StaleUnpaidOrderExpiry[] = [];
      for (const current of candidates) {
        const [cancelled] = await tx
          .update(orders)
          .set({
            status: "cancelled",
            updatedAt: sql`greatest(date_trunc('milliseconds', clock_timestamp()), ${orders.updatedAt} + interval '1 millisecond')`,
          })
          .where(and(eq(orders.id, current.id), eq(orders.status, "pending")))
          .returning({ updatedAt: orders.updatedAt });
        if (!cancelled) continue;
        await tx.insert(auditEvents).values({
          id: `aud_worder_expire_${current.id}`,
          actorId: input.actorId,
          actorType: "user",
          action: "order.unpaid_cancelled",
          targetId: current.id,
          targetType: "order",
          details: {
            reason: "ops_stale_expire",
            olderThanIso: input.olderThanIso,
            orderNumber: current.orderNumber,
          },
        });
        expired.push({
          id: current.id,
          orderNumber: current.orderNumber,
          buyerId: current.buyerId,
          status: "cancelled",
          totalAmount: current.totalAmount,
          currency: current.currency,
          createdAt: current.createdAt,
          cancelledAt: cancelled.updatedAt,
        });
      }
      return expired;
    });
  }
}
export const orderOperationsRepository = new OrderOperationsRepository();
