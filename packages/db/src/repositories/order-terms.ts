import {
  ForbiddenError,
  NotFoundError,
  type OrderTermsLine,
  type OrderTermsReport,
  readOrderLineTerms,
} from "@nexus/domain";
import { and, asc, eq, sql } from "drizzle-orm";
import { db } from "../client";
import { orderItems, orders, users } from "../schema";
import { historyPageBounds } from "./history-pagination";
export class OrderTermsRepository {
  async report(
    actorId: string,
    orderId: string,
    scope: "buyer" | "admin",
    page = 1,
  ): Promise<OrderTermsReport> {
    return db.transaction(
      async (tx) => {
        await tx.execute(sql`set local statement_timeout = '10s'`);
        await tx.execute(sql`set local lock_timeout = '5s'`);
        const [actor] = await tx
          .select({ id: users.id, role: users.role })
          .from(users)
          .where(eq(users.id, actorId))
          .limit(1)
          .for("share");
        if (!actor || (scope === "admin" && actor.role !== "admin")) throw new ForbiddenError();
        const [order] = await tx
          .select({
            id: orders.id,
            orderNumber: orders.orderNumber,
            status: orders.status,
            totalAmount: orders.totalAmount,
            currency: orders.currency,
            createdAt: orders.createdAt,
          })
          .from(orders)
          .where(
            and(
              eq(orders.id, orderId),
              scope === "buyer" ? eq(orders.buyerId, actorId) : undefined,
            ),
          )
          .limit(1);
        if (!order) throw new NotFoundError("Order", orderId);
        const totals = await tx.execute<{
          currency: string;
          value: string;
          lines: number;
          legacyLines: number;
          negative: boolean;
        }>(sql`
        SELECT currency,sum(unit_price)::text AS value,count(*)::int AS lines,
          count(*) FILTER (WHERE commercial_snapshot IS NULL)::int AS "legacyLines",bool_or(unit_price < 0) AS negative
        FROM ${orderItems} WHERE order_id = ${orderId} GROUP BY currency ORDER BY currency LIMIT 17`);
        // A corrupt legacy order with unbounded currency values cannot produce a bounded export.
        if (totals.length > 16) throw new RangeError("Too many order currencies");
        const total = totals.reduce((n, r) => n + Number(r.lines), 0),
          legacyLines = totals.reduce((n, r) => n + Number(r.legacyLines), 0),
          bounds = historyPageBounds(total, page);
        const rows = await tx
          .select({
            id: orderItems.id,
            productId: orderItems.productId,
            unitPrice: orderItems.unitPrice,
            currency: orderItems.currency,
            snapshot: orderItems.commercialSnapshot,
          })
          .from(orderItems)
          .where(eq(orderItems.orderId, orderId))
          .orderBy(asc(orderItems.id))
          .limit(bounds.pageSize)
          .offset(bounds.offset);
        const lines = rows.map((row): OrderTermsLine => {
          const parsed = readOrderLineTerms(row.snapshot),
            terms =
              parsed?.product.id === row.productId &&
              parsed.line.unitPrice === row.unitPrice &&
              parsed.line.currency === row.currency
                ? parsed
                : null;
          return {
            id: row.id,
            productId: row.productId,
            unitPrice: row.unitPrice,
            currency: row.currency,
            evidence: row.snapshot === null ? "legacy" : terms ? "recorded" : "unrecognized",
            terms,
          };
        });
        const currencyMismatch = totals.some((r) => r.currency !== order.currency),
          sum = totals
            .filter((r) => r.currency === order.currency)
            .reduce((n, r) => n + BigInt(r.value), 0n);
        return {
          order,
          observedAt: new Date(),
          lines,
          summary: {
            lines: total,
            legacyLines,
            recordedLines: total - legacyLines,
            totals: totals.map((r) => ({ currency: r.currency, value: r.value })),
            amountMismatch: currencyMismatch || sum !== BigInt(order.totalAmount),
            currencyMismatch,
            negativeValues: order.totalAmount < 0 || totals.some((r) => r.negative),
            unsupportedCurrency:
              !["USD", "EUR", "RUB"].includes(order.currency) ||
              totals.some((r) => !["USD", "EUR", "RUB"].includes(r.currency)),
          },
          ...bounds,
        };
      },
      { isolationLevel: "repeatable read" },
    );
  }
}
export const orderTermsRepository = new OrderTermsRepository();
