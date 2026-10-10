import { and, count, desc, eq, sql } from "drizzle-orm";
import {
  AppError,
  NotFoundError,
  type OrderCancellationCommand,
  type OrderCancellationReceipt,
} from "@nexus/domain";
import { db } from "../client";
import {
  auditEvents,
  ledgerEntries,
  orderCancellationReceipts as receipts,
  orders,
  payments,
} from "../schema";
import { historyPageBounds } from "./history-pagination";

const fail = (code: string) =>
  new AppError("Order operation cannot be applied without reconciliation", 409, code);
export class OrderOperationsRepository {
  async buyerDetail(buyerId: string, orderId: string, page = 1) {
    return db.transaction(
      async (tx) => {
        const [order] = await tx
          .select({
            id: orders.id,
            orderNumber: orders.orderNumber,
            status: orders.status,
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
    orderId: string;
    command: OrderCancellationCommand;
    auditId: string;
  }): Promise<OrderCancellationReceipt> {
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
      return {
        kind: "unpaid_order_cancelled",
        orderId: order.id,
        requestId: command.requestId,
        cancelledAt: cancelled.updatedAt,
      };
    });
  }
}
export const orderOperationsRepository = new OrderOperationsRepository();
