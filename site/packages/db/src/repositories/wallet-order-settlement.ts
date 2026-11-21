import { createHash } from "node:crypto";
import {
  AppError,
  buildWalletSpendPosting,
  type LedgerEntry,
  type LedgerPosting,
  NotFoundError,
  type WalletCurrency,
} from "@nexus/domain";
import { and, asc, eq, or, sql } from "drizzle-orm";
import { db } from "../client";
import {
  auditEvents,
  entitlements,
  ledgerEntries,
  orderItems,
  orders,
  payments,
  products,
  resourceAcquisitionEvents,
  users,
} from "../schema";
import { lockInitiatingSession } from "./initiating-session";
import { accountBalanceInTransaction, postLedgerBatchInTransaction } from "./ledger-posting";

export type WalletOrderSettlementResult = {
  orderId: string;
  paymentId: string;
  ledgerBatchId: string;
  status: "completed";
  totalAmount: number;
  currency: WalletCurrency;
  entries: LedgerEntry[];
  alreadySettled: boolean;
  entitlementIds: string[];
};

function walletSettleIds(orderId: string) {
  return {
    paymentId: `pay_wallet_${orderId}`,
    ledgerBatchId: `wspend_${orderId}`,
    userEntryId: `ldg_wspend_${orderId}_user`,
    marketplaceEntryId: `ldg_wspend_${orderId}_mkt`,
    auditId: `aud_wspend_${orderId}`,
  };
}

/**
 * Atomic wallet spend settlement for a pending paid buyer order.
 * Posts wallet_spend, records a completed wallet payment, marks the order
 * completed, and grants product.download entitlements for each line.
 */
export class WalletOrderSettlementRepository {
  async settle(input: {
    buyerId: string;
    currentToken: string;
    orderId: string;
  }): Promise<WalletOrderSettlementResult> {
    if (!input.currentToken) throw new AppError("Authentication required", 401, "UNAUTHORIZED");
    if (!/^[A-Za-z0-9_-]{1,128}$/u.test(input.orderId))
      throw new AppError("Order id is invalid", 400, "WALLET_ORDER_INVALID");

    const ids = walletSettleIds(input.orderId);

    return db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '5s'`);
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`wallet-settle:${input.orderId}`}))`,
      );

      const [order] = await tx
        .select({
          id: orders.id,
          buyerId: orders.buyerId,
          status: orders.status,
          totalAmount: orders.totalAmount,
          currency: orders.currency,
        })
        .from(orders)
        .where(eq(orders.id, input.orderId))
        .limit(1)
        .for("update");
      if (!order) throw new NotFoundError("Order", input.orderId);
      if (order.buyerId !== input.buyerId)
        throw new AppError("Order does not belong to buyer", 403, "FORBIDDEN");

      const [buyer] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.id, input.buyerId))
        .limit(1)
        .for("share");
      if (!buyer) throw new AppError("Buyer unavailable", 404, "NOT_FOUND");
      await lockInitiatingSession(tx, input.buyerId, input.currentToken);

      const [existingPayment] = await tx
        .select({
          id: payments.id,
          status: payments.status,
          amount: payments.amount,
          currency: payments.currency,
          provider: payments.provider,
          providerTransactionId: payments.providerTransactionId,
        })
        .from(payments)
        .where(and(eq(payments.orderId, order.id), eq(payments.id, ids.paymentId)))
        .limit(1)
        .for("update");

      if (existingPayment?.status === "completed") {
        if (
          existingPayment.amount !== order.totalAmount ||
          existingPayment.currency !== order.currency ||
          existingPayment.provider !== "wallet" ||
          existingPayment.providerTransactionId !== ids.ledgerBatchId ||
          order.status !== "completed"
        ) {
          throw new AppError("Wallet settlement already recorded", 409, "WALLET_SETTLE_CONFLICT");
        }
        const entries = (await tx
          .select()
          .from(ledgerEntries)
          .where(eq(ledgerEntries.batchId, ids.ledgerBatchId))
          .orderBy(asc(ledgerEntries.id))) as LedgerEntry[];
        return {
          orderId: order.id,
          paymentId: existingPayment.id,
          ledgerBatchId: ids.ledgerBatchId,
          status: "completed" as const,
          totalAmount: order.totalAmount,
          currency: order.currency as WalletCurrency,
          entries,
          alreadySettled: true,
          entitlementIds: [],
        };
      }

      if (order.status !== "pending")
        throw new AppError("Order cannot accept wallet settlement", 409, "ORDER_NOT_PAYABLE");
      if (
        !Number.isSafeInteger(order.totalAmount) ||
        order.totalAmount <= 0 ||
        !["USD", "EUR", "RUB"].includes(order.currency)
      ) {
        throw new AppError(
          "Order is not a paid wallet settlement target",
          409,
          "ORDER_NOT_PAYABLE",
        );
      }
      if (existingPayment)
        throw new AppError("Wallet payment attempt is incomplete", 409, "WALLET_SETTLE_CONFLICT");

      const lines = await tx
        .select({
          id: orderItems.id,
          productId: orderItems.productId,
          unitPrice: orderItems.unitPrice,
          currency: orderItems.currency,
        })
        .from(orderItems)
        .where(eq(orderItems.orderId, order.id))
        .orderBy(asc(orderItems.productId));
      if (!lines.length) throw new AppError("Order has no line items", 409, "ORDER_NOT_PAYABLE");

      const accountId = `user:${input.buyerId}`;
      const currency = order.currency as WalletCurrency;
      const availableBalance = await accountBalanceInTransaction(tx, accountId, currency);
      const posting: LedgerPosting[] = buildWalletSpendPosting({
        accountId,
        amount: order.totalAmount,
        currency,
        orderId: order.id,
        availableBalance,
        userEntryId: ids.userEntryId,
        marketplaceEntryId: ids.marketplaceEntryId,
      });
      const entries = await postLedgerBatchInTransaction(tx, ids.ledgerBatchId, posting);

      const now = new Date();
      await tx.insert(payments).values({
        id: ids.paymentId,
        orderId: order.id,
        amount: order.totalAmount,
        currency: order.currency,
        provider: "wallet",
        providerTransactionId: ids.ledgerBatchId,
        status: "completed",
        createdAt: now,
        updatedAt: now,
      });

      const [updated] = await tx
        .update(orders)
        .set({ status: "completed", updatedAt: now })
        .where(and(eq(orders.id, order.id), eq(orders.status, "pending")))
        .returning({ id: orders.id });
      if (!updated) throw new AppError("Order settlement raced", 409, "ORDER_STATE_CHANGED");

      const granted: string[] = [];
      for (const line of lines) {
        const entitlementId = `ent_${createHash("sha256")
          .update(`wspend:${order.id}:${line.productId}`)
          .digest("hex")
          .slice(0, 32)}`;
        await tx
          .select({ id: products.id })
          .from(products)
          .where(eq(products.id, line.productId))
          .limit(1)
          .for("no key update");

        const [existingAccess] = await tx
          .select({ id: entitlements.id })
          .from(entitlements)
          .where(
            and(
              eq(entitlements.subjectType, "user"),
              eq(entitlements.subjectId, input.buyerId),
              eq(entitlements.resourceId, line.productId),
              eq(entitlements.permission, "product.download"),
              or(sql`${entitlements.expiresAt} is null`, sql`${entitlements.expiresAt} > ${now}`),
            ),
          )
          .limit(1);
        if (!existingAccess) {
          await tx.insert(entitlements).values({
            id: entitlementId,
            subjectType: "user",
            subjectId: input.buyerId,
            permission: "product.download",
            resourceId: line.productId,
            createdAt: now,
          });
          await tx.insert(resourceAcquisitionEvents).values({
            id: entitlementId,
            userId: input.buyerId,
            productId: line.productId,
            entitlementId,
            source: "direct",
            requestId: null,
            createdAt: now,
          });
          await tx
            .update(products)
            .set({ salesCount: sql`${products.salesCount} + 1` })
            .where(eq(products.id, line.productId));
          granted.push(entitlementId);
        }
      }

      await tx.insert(auditEvents).values({
        id: ids.auditId,
        actorId: input.buyerId,
        actorType: "user",
        action: "order.wallet_settled",
        targetId: order.id,
        targetType: "order",
        details: {
          paymentId: ids.paymentId,
          ledgerBatchId: ids.ledgerBatchId,
          totalAmount: order.totalAmount,
          currency: order.currency,
          entitlementCount: granted.length,
        },
      });

      return {
        orderId: order.id,
        paymentId: ids.paymentId,
        ledgerBatchId: ids.ledgerBatchId,
        status: "completed" as const,
        totalAmount: order.totalAmount,
        currency,
        entries,
        alreadySettled: false,
        entitlementIds: granted,
      };
    });
  }
}

export const walletOrderSettlementRepository = new WalletOrderSettlementRepository();
